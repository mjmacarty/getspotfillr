// app/preferences/[memberId]/page.tsx
// Public, no-login page a member reaches via a link in their notification
// emails. Lets them set their own phone number and SMS opt-in without ever
// needing an account -- writes go through update_member_preferences(), a
// narrow RPC that can only touch phone/sms_opt_in, not the rest of the row.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface PreferencesPageProps {
  params: Promise<{ memberId: string }>
  searchParams: Promise<{ saved?: string; error?: string }>
}

export default async function PreferencesPage({ params, searchParams }: PreferencesPageProps) {
  const { memberId } = await params
  const { saved, error: saveError } = await searchParams
  const supabase = await createClient()

  const { data: memberRows } = await supabase.rpc('get_member_preferences', { p_member_id: memberId })
  const member = memberRows?.[0] || null

  async function savePreferencesAction(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const id = formData.get('member_id') as string
    const phone = (formData.get('phone') as string) || null
    const smsOptIn = formData.get('sms_opt_in') === 'on'

    const { error } = await supabase.rpc('update_member_preferences', {
      p_member_id: id,
      p_phone: phone,
      p_sms_opt_in: smsOptIn,
    })

    if (error) {
      console.error('Error updating member preferences:', error)
      redirect(`/preferences/${id}?error=1`)
    }

    redirect(`/preferences/${id}?saved=1`)
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
            <p className="text-xs text-emerald-400 font-medium">Preferences saved.</p>
          </div>
        )}
        {saveError && (
          <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl px-4 py-2.5">
            <p className="text-xs text-rose-400 font-medium">Something went wrong saving that. Please try again.</p>
          </div>
        )}

        <form action={savePreferencesAction} className="space-y-4">
          <input type="hidden" name="member_id" value={member.id} />

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              defaultValue={member.phone || ''}
              placeholder="+1 555-0199"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">Needed if you want text alerts.</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="sms_opt_in"
              id="sms_opt_in"
              defaultChecked={!!member.sms_opt_in}
              className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
            />
            <label htmlFor="sms_opt_in" className="text-sm text-slate-300">
              Text me when a slot opens (in addition to email)
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-bold text-sm text-white rounded-xl transition"
          >
            Save Preferences
          </button>
        </form>

        <p className="text-[11px] text-slate-500 text-center">
          You&apos;ll always get email alerts regardless of this setting.
        </p>
      </div>
    </div>
  )
}
