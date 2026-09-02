// app/claim/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

interface ClaimPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ memberId?: string }>
}

export default async function ClaimSlotPage({ params, searchParams }: ClaimPageProps) {
  const { id: slotId } = await params
  const { memberId } = await searchParams
  const supabase = await createClient()

  // 1. Fetch slot details via a narrow RPC — returns only this one slot,
  // regardless of login state, without granting broad table-wide read
  // access to anonymous visitors.
  const { data: slotRows } = await supabase.rpc('get_claimable_slot', { p_slot_id: slotId })
  const slot = slotRows?.[0] || null

  // 2. If the link identifies a member (personalized notification link), look
  // them up so we can skip the dropdown entirely. Only fall back to fetching
  // the full member list if we don't know who's clicking.
  let linkedMember: { id: string; name: string } | null = null
  if (memberId) {
    const { data } = await supabase
      .from('members')
      .select('id, name')
      .eq('id', memberId)
      .single()
    linkedMember = data
  }

  const { data: members } = linkedMember
    ? { data: null }
    : await supabase.from('members').select('id, name').order('name', { ascending: true })

  // SERVER ACTION: Claim the slot
  async function claimSlotAction(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const claimingMemberId = formData.get('claiming_member_id') as string

    if (!claimingMemberId) return

    // Atomic update: only claim if status is still 'open' (prevents race conditions)
    const { error } = await supabase
      .from('canceled_lessons')
      .update({
        status: 'claimed',
        claimed_by_member_id: claimingMemberId,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', slotId)
      .eq('status', 'open')

    if (error) {
      console.error('Error claiming slot:', error)
    }

    revalidatePath('/dashboard')
    // Redirect (not just revalidate) so the page re-fetches fresh data and
    // can tell "you just claimed this" apart from "someone beat you to it".
    redirect(`/claim/${slotId}?memberId=${claimingMemberId}`)
  }

  if (!slot) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-bold text-rose-400">Slot Not Found</h1>
          <p className="text-sm text-slate-400">This lesson offer may have been deleted or the link is invalid.</p>
        </div>
      </div>
    )
  }

  const isClaimed = slot.status === 'claimed'
  const isClaimedByMe = isClaimed && !!memberId && slot.claimed_by_member_id === memberId
  const isClaimedByOther = isClaimed && !isClaimedByMe

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 md:p-8">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl">
        
        {/* Header */}
        <div className="text-center space-y-1">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">SpotFillr Alert</span>
          <h1 className="text-2xl font-extrabold text-white">Open Lesson Slot</h1>
          <p className="text-xs text-slate-400">Coach {slot.coach_name || 'Staff'}</p>
        </div>

        {/* Slot Details Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Date</span>
            <span className="font-semibold text-white">{slot.lesson_date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Time</span>
            <span className="font-semibold text-emerald-400">
              {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Open Slot From</span>
            <span className="text-slate-300">{slot.canceling_member_name || 'Cancellation'}</span>
          </div>
        </div>

        {/* Status / Claim Form */}
        {isClaimedByMe ? (
          <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-4 text-center space-y-1">
            <p className="text-emerald-400 font-bold text-sm">
              You&apos;re confirmed{linkedMember ? `, ${linkedMember.name}` : ''}!
            </p>
            <p className="text-xs text-slate-400">This lesson slot is booked for you.</p>
          </div>
        ) : isClaimedByOther ? (
          <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 text-center space-y-1">
            <p className="text-amber-400 font-bold text-sm">Slot Already Claimed!</p>
            <p className="text-xs text-slate-400">Another member grabbed this lesson slot first.</p>
          </div>
        ) : (
          <form action={claimSlotAction} className="space-y-4">
            {linkedMember ? (
              <>
                <p className="text-sm text-slate-300 text-center">
                  Claiming for <span className="font-semibold text-white">{linkedMember.name}</span>
                </p>
                <input type="hidden" name="claiming_member_id" value={linkedMember.id} />
              </>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Select Your Name / Fencer Name
                </label>
                <select
                  name="claiming_member_id"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Choose Member --</option>
                  {members?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 font-bold text-sm text-white rounded-xl transition shadow-lg shadow-emerald-950 cursor-pointer"
            >
              Claim This Lesson Slot
            </button>
          </form>
        )}

      </div>
    </div>
  )
}