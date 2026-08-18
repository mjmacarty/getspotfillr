import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sendBroadcastNotification } from '@/lib/notifications'
import CancellationForm from '@/components/cancellation-form'
import Link from 'next/link'

export const dynamic = 'force-dynamic' // Force dynamic rendering to prevent stale page caches

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Check Auth State
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    redirect('/login')
  }

  // SERVER ACTION: Sign Out
  async function signOutAction() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  // 2. Fetch coach details INCLUDING club details (joined name)
  const { data: coach } = await supabase
    .from('coaches')
    .select(`
      id, 
      name, 
      club_id, 
      default_lesson_duration, 
      timezone,
      clubs!inner(name)
    `)
    .eq('id', user.id)
    .single()

  // Extract club name safely (handles join object)
  const clubsData = coach?.clubs as any;
  const clubName = Array.isArray(clubsData)
  ? clubsData[0]?.name
  : clubsData?.name;

  // 3. Fetch active members ONLY for this coach's club
  const { data: members } = await supabase
    .from('members')
    .select('id, name, email, phone')
    .eq('club_id', coach?.club_id)
    .order('name', { ascending: true })

  // 4. Calculate today's date in coach's preferred timezone
  const userTimezone = coach?.timezone || 'America/New_York'
  const today = new Date().toLocaleDateString('en-CA', { timeZone: userTimezone })

  // 5. Fetch canceled slots ONLY for coaches in this specific club
  const { data: allSlots } = await supabase
    .from('canceled_lessons')
    .select(`
      *,
      canceling_member:members!canceling_member_id(name),
      claimed_member:members!claimed_by_member_id(name),
      coaches!inner(club_id)
    `)
    .eq('coaches.club_id', coach?.club_id)
    .order('lesson_date', { ascending: true })
    .order('start_time', { ascending: true })

  // SERVER ACTION: Report cancellation & trigger broadcast
  async function postCancellation(
    _prevState: { status: 'idle' | 'success' | 'error'; count?: number; message?: string },
    formData: FormData
  ) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { status: 'error' as const, message: 'You must be signed in.' }

    // Get coach profile inside action to ensure correct club scoping
    const { data: activeCoach } = await supabase
      .from('coaches')
      .select('club_id')
      .eq('id', user.id)
      .single()

    const canceling_member_id = formData.get('canceling_member_id') as string
    const lesson_date = formData.get('lesson_date') as string
    const start_time = formData.get('start_time') as string
    const end_time = formData.get('end_time') as string

    const { data: newSlot, error: insertError } = await supabase
      .from('canceled_lessons')
      .insert({
        coach_id: user.id,
        canceling_member_id: canceling_member_id || null,
        lesson_date,
        start_time,
        end_time,
        status: 'open',
      })
      .select()
      .single()

    if (insertError || !newSlot) {
      console.error('Error creating slot:', insertError)
      return { status: 'error' as const, message: 'Could not save the cancellation. Please try again.' }
    }

    // Broadcast ONLY to members of THIS club
    const { data: clubMembers } = await supabase
      .from('members')
      .select('id, email, phone')
      .eq('club_id', activeCoach?.club_id)

    if (clubMembers && clubMembers.length > 0) {
      await Promise.all(
        clubMembers.map((m) =>
          sendBroadcastNotification({
            recipient: { id: m.id, email: m.email, phone: m.phone },
            slotId: newSlot.id,
            lessonDate: newSlot.lesson_date,
            startTime: newSlot.start_time,
            endTime: newSlot.end_time,
          })
        )
      )

      await supabase
        .from('canceled_lessons')
        .update({
          broadcast_sent: true,
          broadcast_sent_at: new Date().toISOString(),
        })
        .eq('id', newSlot.id)

      revalidatePath('/dashboard')
      return { status: 'success' as const, count: clubMembers.length }
    }

    revalidatePath('/dashboard')
    return { status: 'success' as const, count: 0, message: 'Slot saved, but there are no active members to notify.' }
  }

  // Metric Calculations
  const upcomingSlots = allSlots?.filter((s) => s.lesson_date >= today) || []
  const openCount = upcomingSlots.filter((s) => s.status === 'open').length
  const claimedCount = allSlots?.filter((s) => s.status === 'claimed').length || 0
  const expiredUnfilledCount = allSlots?.filter(
    (s) => s.lesson_date < today && s.status === 'open'
  ).length || 0

  // Reporting: fill rate & frequent cancellations, both over a rolling 30-day
  // window keyed on lesson_date (no extra queries — reuses allSlots).
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - 30)
  const windowStartStr = windowStart.toLocaleDateString('en-CA', { timeZone: userTimezone })
  const slotsInWindow = allSlots?.filter((s) => s.lesson_date >= windowStartStr) || []

  // Fill rate only counts *resolved* outcomes (claimed, or open-but-passed =
  // expired) — a slot that's still open and not yet due shouldn't count
  // against the rate just because it hasn't been claimed yet.
  const filledInWindow = slotsInWindow.filter((s) => s.status === 'claimed').length
  const expiredInWindow = slotsInWindow.filter((s) => s.status === 'open' && s.lesson_date < today).length
  const resolvedInWindow = filledInWindow + expiredInWindow
  const fillRate = resolvedInWindow > 0 ? Math.round((filledInWindow / resolvedInWindow) * 100) : null

  // Members with 3+ cancellations in the window
  const cancellationCounts = new Map<string, { name: string; count: number; mostRecent: string }>()
  slotsInWindow.forEach((s) => {
    if (!s.canceling_member_id) return
    const name = s.canceling_member?.name || 'Unknown'
    const existing = cancellationCounts.get(s.canceling_member_id)
    if (existing) {
      existing.count += 1
      if (s.lesson_date > existing.mostRecent) existing.mostRecent = s.lesson_date
    } else {
      cancellationCounts.set(s.canceling_member_id, { name, count: 1, mostRecent: s.lesson_date })
    }
  })
  const frequentCancellers = Array.from(cancellationCounts.values())
    .filter((m) => m.count >= 3)
    .sort((a, b) => b.count - a.count)

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
        
        {/* Header Section */}
        <header className="pb-4 border-b border-slate-800 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Link href="/dashboard" className="text-2xl sm:text-3xl font-bold tracking-tight hover:text-slate-200 transition">
                  Spot<span className="text-blue-500">Fillr</span>

                </Link>
                {clubName && (
                  <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 rounded-full">
                    {clubName}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Logged in as <span className="text-slate-200 font-medium">{coach?.name || user.email}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Desktop Nav Links */}
              <nav className="hidden md:flex items-center gap-4 text-sm font-medium border-r border-slate-800 pr-6">
                <Link href="/dashboard" className="text-emerald-400 font-semibold">
                  Dashboard
                </Link>
                <Link href="/members" className="text-slate-400 hover:text-white transition">
                  Members
                </Link>
                <Link href="/settings" className="text-slate-400 hover:text-white transition">
                  Settings
                </Link>
              </nav>

              <form action={signOutAction}>
                <button
                  type="submit"
                  className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition cursor-pointer"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>

          {/* Mobile Navigation Toolbar */}
          <nav className="flex md:hidden items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs font-medium">
            <Link 
              href="/dashboard" 
              className="flex-1 text-center py-2 bg-emerald-950/50 text-emerald-400 border border-emerald-800/80 rounded-lg font-semibold"
            >
              Dashboard
            </Link>
            <Link 
              href="/members" 
              className="flex-1 text-center py-2 bg-slate-900 text-slate-400 hover:text-white border border-slate-800 rounded-lg transition"
            >
              Members
            </Link>
            <Link 
              href="/settings" 
              className="flex-1 text-center py-2 bg-slate-900 text-slate-400 hover:text-white border border-slate-800 rounded-lg transition"
            >
              Settings
            </Link>
          </nav>
        </header>

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

        {/* Form: Post Canceled Slot */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-0.5 sm:mb-1">Report Cancellation</h2>
          <p className="text-xs text-slate-400 mb-4 sm:mb-6">
            Submitting this form will immediately send an alert to active members with a claim link.
          </p>

          <CancellationForm 
            members={members} 
            postCancellationAction={postCancellation} 
            defaultLessonDurationMinutes={coach?.default_lesson_duration || 25}
          />
        </section>

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

      </div>
    </div>
  )
}