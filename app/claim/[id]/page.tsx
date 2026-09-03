// app/claim/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic' // Never cache — a claim's success depends on always reading current status

interface ClaimPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ memberId?: string; claimError?: string; debugMsg?: string }>
}

export default async function ClaimSlotPage({ params, searchParams }: ClaimPageProps) {
  const { id: slotId } = await params
  const { memberId, claimError, debugMsg } = await searchParams
  const supabase = await createClient()

  // 1. Fetch slot details via a narrow RPC — returns only this one slot,
  // regardless of login state, without granting broad table-wide read
  // access to anonymous visitors.
  const { data: slotRows } = await supabase.rpc('get_claimable_slot', { p_slot_id: slotId })
  const slot = slotRows?.[0] || null

  // 2. Look up the linked member via a narrow RPC — returns only this one
  // member's name, never phone/email or the rest of the roster. Every real
  // notification link SpotFillr generates always includes memberId, so
  // there's no legitimate case where this is missing.
  let linkedMember: { id: string; name: string } | null = null
  if (memberId) {
    const { data } = await supabase.rpc('get_member_name', { p_member_id: memberId })
    linkedMember = data?.[0] || null
  }

  // SERVER ACTION: Claim the slot
  async function claimSlotAction(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const claimingMemberId = formData.get('claiming_member_id') as string

    if (!claimingMemberId) return

    // Atomic update: only claim if status is still 'open' (prevents race conditions)
    // NOTE: temporarily not using .select() here — testing whether asking
    // PostgREST to return the updated row requires read access we don't
    // grant anonymous visitors, separate from the write itself succeeding.
    const { error, count } = await supabase
      .from('canceled_lessons')
      .update({
        status: 'claimed',
        claimed_by_member_id: claimingMemberId,
        claimed_at: new Date().toISOString(),
      }, { count: 'exact' })
      .eq('id', slotId)
      .eq('status', 'open')

    if (error) {
      redirect(`/claim/${slotId}?memberId=${claimingMemberId}&claimError=1&debugMsg=${encodeURIComponent(error.message || 'unknown error')}`)
    }

    if (!count || count === 0) {
      redirect(`/claim/${slotId}?memberId=${claimingMemberId}&claimError=1&debugMsg=${encodeURIComponent(`0 rows. slotId="${slotId}" (len ${slotId.length})`)}`)
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

  if (!linkedMember) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-bold text-rose-400">Invalid Link</h1>
          <p className="text-sm text-slate-400">
            This claim link is missing some information. Please use the link exactly as it appeared in your email or text.
          </p>
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

        {/* Temporary diagnostic — comparing the URL's slotId against what the RPC read actually returned */}
        <div className="text-[10px] font-mono text-slate-600 break-words space-y-0.5">
          <div>URL slotId: &quot;{slotId}&quot; (len {slotId.length})</div>
          <div>RPC slot.id: &quot;{slot.id}&quot; (len {String(slot.id).length})</div>
          <div>RPC slot.status: &quot;{slot.status}&quot;</div>
          <div>Match: {String(slot.id) === slotId ? 'YES' : 'NO'}</div>
        </div>

        {/* Status / Claim Form */}
        {isClaimedByMe ? (
          <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-4 text-center space-y-1">
            <p className="text-emerald-400 font-bold text-sm">
              You&apos;re confirmed, {linkedMember.name}!
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
            {claimError && (
              <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-3 text-center space-y-1">
                <p className="text-rose-400 text-xs font-medium">
                  Something went wrong claiming this slot. Please try again.
                </p>
                {debugMsg && (
                  <p className="text-rose-300/70 text-[10px] font-mono break-words">
                    Debug: {debugMsg}
                  </p>
                )}
              </div>
            )}
            <p className="text-sm text-slate-300 text-center">
              Claiming for <span className="font-semibold text-white">{linkedMember.name}</span>
            </p>
            <input type="hidden" name="claiming_member_id" value={linkedMember.id} />

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