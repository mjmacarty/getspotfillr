// app/preferences/[memberId]/page.tsx
// Public, no-login page a member reaches from a link in their alert emails.
//
// Turning text alerts ON requires verifying the phone number with a code,
// so consent is provably from the person holding that phone. Turning them
// OFF never requires verification -- honoring a revocation is always
// allowed and should be as frictionless as possible.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toE164, maskPhone, sendVerificationCode, checkVerificationCode } from '@/lib/verify'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface PreferencesPageProps {
  params: Promise<{ memberId: string }>
  searchParams: Promise<{
    saved?: string
    optedOut?: string
    error?: string
    pending?: string
  }>
}

export default async function PreferencesPage({ params, searchParams }: PreferencesPageProps) {
  const { memberId } = await params
  const { saved, optedOut, error: errorMsg, pending } = await searchParams
  const supabase = await createClient()

  const { data: memberRows } = await supabase.rpc('get_member_preferences', {
    p_member_id: memberId,
  })
  const member = memberRows?.[0] || null

  // STEP 1: member submits a phone number -> send them a code
  async function requestCodeAction(formData: FormData) {
    'use server'
    const id = formData.get('member_id') as string
    const rawPhone = formData.get('phone') as string

    const phoneE164 = toE164(rawPhone || '')
    if (!phoneE164) {
      redirect(`/preferences/${id}?error=${encodeURIComponent("That doesn't look like a valid phone number.")}`)
    }

    const result = await sendVerificationCode(phoneE164)
    if (!result.ok) {
      redirect(`/preferences/${id}?error=${encodeURIComponent(result.error || 'Could not send a code.')}`)
    }

    redirect(`/preferences/${id}?pending=${encodeURIComponent(phoneE164)}`)
  }

  // STEP 2: member submits the code -> verify, then grant consent
  async function confirmCodeAction(formData: FormData) {
    'use server'
    const id = formData.get('member_id') as string
    const phoneE164 = formData.get('pending_phone') as string
    const code = (formData.get('code') as string || '').trim()

    if (!phoneE164 || !code) {
      redirect(`/preferences/${id}?pending=${encodeURIComponent(phoneE164)}&error=${encodeURIComponent('Please enter the code we sent.')}`)
    }

    const result = await checkVerificationCode(phoneE164, code)
    if (!result.ok) {
      redirect(`/preferences/${id}?pending=${encodeURIComponent(phoneE164)}&error=${encodeURIComponent(result.error || 'Invalid code.')}`)
    }

    // Verified. Grant consent using the service role client -- this write
    // is deliberately not reachable with the public publishable key, so
    // consent can't be granted without passing verification first.
    const admin = createAdminClient()
    const { error } = await admin.rpc('confirm_member_sms_opt_in', {
      p_member_id: id,
      p_phone: phoneE164,
    })

    if (error) {
      console.error('Error confirming SMS opt-in:', error)
      redirect(`/preferences/${id}?error=${encodeURIComponent('Something went wrong saving that. Please try again.')}`)
    }

    redirect(`/preferences/${id}?saved=1`)
  }

  // Turn text alerts off. No verification -- revocation is always allowed.
  async function optOutAction(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const id = formData.get('member_id') as string

    const { error } = await supabase.rpc('member_revoke_sms', { p_member_id: id })
    if (error) {
      console.error('Error revoking SMS consent:', error)
      redirect(`/preferences/${id}?error=${encodeURIComponent('Something went wrong. Please try again.')}`)
    }

    redirect(`/preferences/${id}?optedOut=1`)
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <p className="text-slate-400 text-sm">This preferences link is invalid or has expired.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <div className="text-2xl font-bold tracking-tight text-white">
            Spot<span className="text-blue-500">Fillr</span>
          </div>
          <h1 className="text-lg font-semibold mt-4">Alert Preferences</h1>
          <p className="text-xs text-slate-400 mt-1">
            Hi {member.name}, manage how you&apos;re notified when a lesson slot opens up.
          </p>
        </div>

        {saved && (
          <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl px-4 py-2.5">
            <p className="text-xs text-emerald-400 font-medium">
              Text alerts are on. You&apos;ll get a text next time a slot opens.
            </p>
          </div>
        )}
        {optedOut && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5">
            <p className="text-xs text-slate-300 font-medium">
              Text alerts are off. You&apos;ll still get email alerts.
            </p>
          </div>
        )}
        {errorMsg && (
          <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl px-4 py-2.5">
            <p className="text-xs text-rose-400 font-medium">{errorMsg}</p>
          </div>
        )}

        {member.sms_opt_in ? (
          /* Already opted in — show status and an easy way out */
          <div className="space-y-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
              <p className="text-sm text-white font-medium">Text alerts are on</p>
              <p className="text-xs text-slate-400">
                Sending to {member.phone ? maskPhone(member.phone) : 'your number'}
              </p>
            </div>

            <form action={optOutAction}>
              <input type="hidden" name="member_id" value={member.id} />
              <button
                type="submit"
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 font-semibold text-sm text-slate-300 rounded-xl transition"
              >
                Turn off text alerts
              </button>
            </form>
          </div>
        ) : pending ? (
          /* Step 2 — enter the code */
          <form action={confirmCodeAction} className="space-y-4">
            <input type="hidden" name="member_id" value={member.id} />
            <input type="hidden" name="pending_phone" value={pending} />

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Enter the code we texted to {maskPhone(pending)}
              </label>
              <input
                type="text"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                placeholder="123456"
                required
                autoFocus
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-lg tracking-widest text-center text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-bold text-sm text-white rounded-xl transition"
            >
              Confirm
            </button>

            <a
              href={`/preferences/${member.id}`}
              className="block text-center text-[11px] text-slate-500 hover:text-slate-300 transition"
            >
              Use a different number
            </a>
          </form>
        ) : (
          /* Step 1 — enter the phone number */
          <form action={requestCodeAction} className="space-y-4">
            <input type="hidden" name="member_id" value={member.id} />

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Mobile Number
              </label>
              <input
                type="tel"
                name="phone"
                defaultValue={member.phone || ''}
                placeholder="(617) 555-0199"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                We&apos;ll text you a code to confirm it&apos;s really you.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-bold text-sm text-white rounded-xl transition"
            >
              Text me a code
            </button>

            <p className="text-[10px] text-slate-500 leading-relaxed">
              By confirming, you agree to receive text alerts from SpotFillr when a lesson slot
              opens up at your club. Message and data rates may apply. You can turn these off any
              time from this page.
            </p>
          </form>
        )}

        <p className="text-[11px] text-slate-500 text-center">
          You&apos;ll always get email alerts regardless of this setting.
        </p>
      </div>
    </div>
  )
}
