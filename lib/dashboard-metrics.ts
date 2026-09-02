// lib/dashboard-metrics.ts
// Pure computation, no I/O — shared by the server component's initial render
// and the client component's live-updated re-renders, so the two never drift
// apart in how they define "open", "fill rate", etc.

export interface DashboardSlot {
  id: string
  lesson_date: string
  start_time: string
  end_time: string
  status: string
  canceling_member_id: string | null
  canceling_member?: { name: string } | null
  claimed_member?: { name: string } | null
}

export interface DashboardMetrics {
  today: string
  upcomingSlots: DashboardSlot[]
  openCount: number
  claimedCount: number
  expiredUnfilledCount: number
  fillRate: number | null
  frequentCancellers: { name: string; count: number; mostRecent: string }[]
}

export function computeDashboardMetrics(
  allSlots: DashboardSlot[],
  today: string
): DashboardMetrics {
  const upcomingSlots = allSlots.filter((s) => s.lesson_date >= today)
  const openCount = upcomingSlots.filter((s) => s.status === 'open').length
  const claimedCount = allSlots.filter((s) => s.status === 'claimed').length
  const expiredUnfilledCount = allSlots.filter(
    (s) => s.lesson_date < today && s.status === 'open'
  ).length

  // Reporting: fill rate & frequent cancellations, both over a rolling
  // 30-day window keyed on lesson_date. Derived from the already-correct
  // `today` string (not `new Date()`) so this works identically regardless
  // of what timezone the server or the visitor's browser is in.
  const [ty, tm, td] = today.split('-').map(Number)
  const windowStart = new Date(Date.UTC(ty, tm - 1, td - 30))
  const windowStartStr = windowStart.toISOString().split('T')[0]
  const slotsInWindow = allSlots.filter((s) => s.lesson_date >= windowStartStr)

  const filledInWindow = slotsInWindow.filter((s) => s.status === 'claimed').length
  const expiredInWindow = slotsInWindow.filter(
    (s) => s.status === 'open' && s.lesson_date < today
  ).length
  const resolvedInWindow = filledInWindow + expiredInWindow
  const fillRate = resolvedInWindow > 0 ? Math.round((filledInWindow / resolvedInWindow) * 100) : null

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

  return { today, upcomingSlots, openCount, claimedCount, expiredUnfilledCount, fillRate, frequentCancellers }
}
