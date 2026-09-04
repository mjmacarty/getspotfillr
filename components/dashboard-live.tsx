// components/dashboard-live.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { computeDashboardMetrics, type DashboardSlot } from '@/lib/dashboard-metrics'

interface DashboardLiveProps {
  initialSlots: DashboardSlot[]
  today: string
}

export default function DashboardLive({ initialSlots, today }: DashboardLiveProps) {
  const [slots, setSlots] = useState<DashboardSlot[]>(initialSlots)

  // useState only uses `initialSlots` on first mount -- if the coach submits
  // the cancellation form and the server re-renders this page with fresh
  // data, that arrives as a new `initialSlots` prop, which this effect picks
  // up and syncs into state. Without this, only the Realtime subscription
  // below would ever update the UI, with no fallback if it hiccups.
  useEffect(() => {
    setSlots(initialSlots)
  }, [initialSlots])

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/slots', { cache: 'no-store' })
      if (!res.ok) return
      const { slots: fresh } = await res.json()
      setSlots(fresh)
    } catch (err) {
      console.error('Failed to refresh dashboard slots:', err)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function setupRealtime() {
      // Realtime's postgres_changes enforces RLS against whoever the socket
      // is authenticated as. With cookie-based sessions the socket can
      // connect before the session has loaded, authenticating as `anon` --
      // which has no SELECT policy on canceled_lessons, so no events are
      // ever delivered even though the subscription reports SUBSCRIBED.
      // Setting the token explicitly before subscribing avoids that race.
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return

      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token)
      }
      if (cancelled) return

      channel = supabase
        .channel('canceled_lessons-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'canceled_lessons' },
          () => {
            refetch()
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Dashboard] Realtime connected')
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('[Dashboard] Realtime subscription failed:', status)
          }
        })
    }

    setupRealtime()

    // Fallbacks so the dashboard can't go stale even if Realtime stops
    // delivering: refetch when the tab regains focus, and poll on a slow
    // timer as a safety net.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', onVisible)
    const pollId = setInterval(refetch, 30000)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(pollId)
      if (channel) supabase.removeChannel(channel)
    }
  }, [refetch])

  const { upcomingSlots, openCount, claimedCount, expiredUnfilledCount, fillRate, frequentCancellers } =
    computeDashboardMetrics(slots, today)

  return (
    <>
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-5">
          <span className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400 tracking-wider">Open Slots</span>
          <p className="text-2xl sm:text-3xl font-bold text-amber-400 mt-1 sm:mt-2">{openCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-5">
          <span className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400 tracking-wider">Recovered</span>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-400 mt-1 sm:mt-2">{claimedCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-5">
          <span className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400 tracking-wider">Expired</span>
          <p className="text-2xl sm:text-3xl font-bold text-rose-400 mt-1 sm:mt-2">{expiredUnfilledCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-5">
          <span className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400 tracking-wider">Total Active</span>
          <p className="text-2xl sm:text-3xl font-bold text-blue-400 mt-1 sm:mt-2">{upcomingSlots.length}</p>
        </div>
        <div className="bg-slate-900 border border-emerald-800/40 rounded-xl p-3 sm:p-5">
          <span className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400 tracking-wider">
            Fill Rate <span className="text-slate-600 normal-case">· 30d</span>
          </span>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-400 mt-1 sm:mt-2">
            {fillRate === null ? '—' : `${fillRate}%`}
          </p>
        </div>
      </div>

      {/* Frequent Cancellations — only shown when someone actually crosses the threshold */}
      {frequentCancellers.length > 0 && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-base sm:text-lg font-semibold">Frequent Cancellations</h2>
            <span className="text-[11px] text-slate-500">last 30 days</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">Members who canceled 3 or more lessons.</p>

          <div className="flex flex-col gap-2">
            {frequentCancellers.map((m) => (
              <div
                key={m.name}
                className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5"
              >
                <div>
                  <div className="text-sm font-medium text-white">{m.name}</div>
                  <div className="text-[11px] text-slate-500">most recent: {m.mostRecent}</div>
                </div>
                <span className="text-[11px] font-semibold text-amber-400 bg-amber-950/40 border border-amber-800/50 rounded-full px-2.5 py-1">
                  {m.count} cancellations
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Activity Feed Section */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Upcoming Canceled Slot Activity</h2>
        {upcomingSlots.length > 0 ? (
          <div className="-mx-4 sm:mx-0 overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] sm:text-xs text-slate-400 uppercase">
                  <th className="pl-4 sm:pl-0 pb-2.5 sm:pb-3 font-semibold">Canceled By</th>
                  <th className="px-2 pb-2.5 sm:pb-3 font-semibold">Date & Time</th>
                  <th className="px-2 pb-2.5 sm:pb-3 font-semibold">Status</th>
                  <th className="pr-4 sm:pr-0 pb-2.5 sm:pb-3 font-semibold">Claimed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {upcomingSlots.map((slot) => (
                  <tr key={slot.id} className="hover:bg-slate-950/50 transition">
                    <td className="pl-4 sm:pl-0 py-3 font-medium text-white text-[11px] sm:text-sm">
                      {slot.canceling_member?.name || 'Unknown'}
                    </td>
                    <td className="px-2 py-3 text-slate-300 text-[11px] sm:text-sm whitespace-nowrap">
                      <div>{slot.lesson_date}</div>
                      <div className="text-[10px] sm:text-xs text-slate-400 font-mono">
                        {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <span className={`inline-block px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full border ${
                        slot.status === 'open'
                          ? 'bg-amber-950/60 text-amber-400 border-amber-800/80'
                          : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80'
                      }`}>
                        {slot.status}
                      </span>
                    </td>
                    <td className="pr-4 sm:pr-0 py-3 text-slate-400 text-[11px] sm:text-sm">
                      {slot.status === 'claimed' ? (
                        <span className="text-emerald-400 font-medium">
                          {slot.claimed_member?.name || 'Member'}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 text-xs sm:text-sm">No upcoming canceled slots reported.</p>
        )}
      </section>
    </>
  )
}
