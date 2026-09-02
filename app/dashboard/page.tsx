import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sendBroadcastNotification } from '@/lib/notifications'
import CancellationForm from '@/components/cancellation-form'
import DashboardLive from '@/components/dashboard-live'
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
      .select('club_id, name, timezone')
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
      .select('id, email, phone, sms_opt_in')
      .eq('club_id', activeCoach?.club_id)

    if (clubMembers && clubMembers.length > 0) {
      await Promise.all(
        clubMembers.map((m) =>
          sendBroadcastNotification({
            supabase,
            // Everyone gets email; only members who've opted in get SMS.
            recipient: { id: m.id, email: m.email, phone: m.sms_opt_in ? m.phone : null },
            slotId: newSlot.id,
            lessonDate: newSlot.lesson_date,
            startTime: newSlot.start_time,
            endTime: newSlot.end_time,
            coachName: activeCoach?.name,
            timezone: activeCoach?.timezone,
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

  // Metric computation now lives entirely in <DashboardLive>, which uses the
  // same shared helper — no need to compute it twice.

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

        {/* Metrics, frequent cancellations, and activity feed — all live via
            Supabase Realtime, updating within ~1s of any change to
            canceled_lessons (a claim, a new cancellation, etc.) without
            requiring a page reload. */}
        <DashboardLive initialSlots={allSlots || []} today={today} />

      </div>
    </div>
  )
}