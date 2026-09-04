import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

interface MembersPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const supabase = await createClient()
  const resolvedParams = await searchParams
  const pageError = resolvedParams?.error

  // 1. Auth Guard
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    redirect('/login')
  }

  // 2. Fetch Coach & Associated Club Details
  const { data: coach } = await supabase
    .from('coaches')
    .select('id, name, club_id, clubs(plan_tier)')
    .eq('id', user.id)
    .single()

  const clubId = coach?.club_id
  // Access plan_tier cleanly from joined relation
  const rawClub = coach?.clubs as unknown as { plan_tier: string } | null
  const planTier = rawClub?.plan_tier || 'solo'

  // 3. Fetch Active Member Roster for THIS Club
  const { data: members } = await supabase
    .from('members')
    .select('*')
    .eq('club_id', clubId)
    .order('name', { ascending: true })

  const memberCount = members?.length || 0
  const isSoloPlan = planTier === 'solo'
  const maxMembers = 50
  const percentageUsed = isSoloPlan ? Math.min(100, Math.round((memberCount / maxMembers) * 100)) : 0

  // SERVER ACTION: Sign Out
  async function signOutAction() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  // SERVER ACTION: Add Single Member
  async function addMemberAction(formData: FormData) {
    'use server'
    const supabase = await createClient()

    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const phone = formData.get('phone') as string

    if (!name) return

    // Fetch user/coach inside action context
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: coach } = await supabase
      .from('coaches')
      .select('club_id')
      .eq('id', user.id)
      .single()

    const { error: insertError } = await supabase
      .from('members')
      .insert({
        club_id: coach?.club_id,
        name,
        email: email || null,
        phone: phone || null,
        // SMS consent is deliberately NOT settable here. Consent must come
        // from the member themselves via their preferences link — a coach
        // ticking a box on someone's behalf isn't valid consent under TCPA.
        sms_opt_in: false,
      })

    if (insertError) {
      console.error('Error adding member:', insertError)
      if (insertError.message.includes('MEMBER_LIMIT_EXCEEDED')) {
        redirect('/members?error=limit_exceeded')
      }
      redirect('/members?error=add_failed')
    }

    revalidatePath('/members')
    redirect('/members')
  }

  // SERVER ACTION: Update Existing Member
  async function updateMemberAction(formData: FormData) {
    'use server'
    const supabase = await createClient()

    const id = formData.get('id') as string
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const phone = formData.get('phone') as string

    if (!id || !name) return

    const { error: updateError } = await supabase
      .from('members')
      .update({
        name,
        email: email || null,
        phone: phone || null,
        // sms_opt_in deliberately omitted — see addMemberAction.
      })
      .eq('id', id)

    if (updateError) console.error('Error updating member:', updateError)
    revalidatePath('/members')
  }

  // SERVER ACTION: Revoke a member's SMS consent.
  // Coaches may turn text alerts OFF for a member (e.g. a parent asks them
  // to stop), but never ON — granting consent has to come from the member
  // via their own preferences link.
  async function revokeSmsConsentAction(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const id = formData.get('id') as string
    if (!id) return

    const { error } = await supabase.rpc('coach_revoke_sms_consent', { p_member_id: id })
    if (error) console.error('Error revoking SMS consent:', error)
    revalidatePath('/members')
  }

  // SERVER ACTION: Delete Member
  async function deleteMemberAction(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const id = formData.get('id') as string

    if (!id) return

    const { error: deleteError } = await supabase
      .from('members')
      .delete()
      .eq('id', id)

    if (deleteError) console.error('Error deleting member:', deleteError)
    revalidatePath('/members')
  }

  // SERVER ACTION: CSV Batch Upload
  async function uploadCsvAction(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const file = formData.get('csv_file') as File

    if (!file || file.size === 0) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: coach } = await supabase
      .from('coaches')
      .select('club_id')
      .eq('id', user.id)
      .single()

    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)

    if (lines.length < 2) return

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''))
    const nameIdx = headers.findIndex((h) => h.includes('name'))
    const emailIdx = headers.findIndex((h) => h.includes('email'))
    const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('cell'))

    if (emailIdx === -1) return

    const records = []

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/['"]/g, ''))
      const email = cols[emailIdx]
      if (!email) continue

      records.push({
        club_id: coach?.club_id,
        name: nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx] : 'Member',
        email: email.toLowerCase().trim(),
        phone: phoneIdx !== -1 && cols[phoneIdx] ? cols[phoneIdx] : null,
      })
    }

    if (records.length > 0) {
      const { error: batchError } = await supabase
        .from('members')
        .upsert(records, { onConflict: 'email' })

      if (batchError) {
        console.error('Error upserting CSV members:', batchError)
        if (batchError.message.includes('MEMBER_LIMIT_EXCEEDED')) {
          redirect('/members?error=limit_exceeded')
        }
        redirect('/members?error=upload_failed')
      }
    }

    revalidatePath('/members')
    redirect('/members')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">

        {/* Header Section */}
        <header className="pb-4 border-b border-slate-800 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Link href="/dashboard" className="text-xl sm:text-2xl font-bold tracking-tight hover:text-slate-200 transition">
                SpotFillr
              </Link>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Logged in as <span className="text-slate-200 font-medium">{coach?.name || user.email}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <nav className="hidden md:flex items-center gap-4 text-sm font-medium border-r border-slate-800 pr-6">
                <Link href="/dashboard" className="text-slate-400 hover:text-white transition">
                  Dashboard
                </Link>
                <Link href="/members" className="text-emerald-400 font-semibold">
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
              className="flex-1 text-center py-2 bg-slate-900 text-slate-400 hover:text-white border border-slate-800 rounded-lg transition"
            >
              Dashboard
            </Link>
            <Link 
              href="/members" 
              className="flex-1 text-center py-2 bg-emerald-950/50 text-emerald-400 border border-emerald-800/80 rounded-lg font-semibold"
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

        {/* 🚀 Limit Exceeded Error Banner */}
        {pageError === 'limit_exceeded' && (
          <div className="p-4 bg-amber-950/80 border border-amber-800 text-amber-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Member Limit Reached</p>
              <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 bg-amber-900/60 border border-amber-700/80 rounded text-amber-300">
                Solo Plan
              </span>
            </div>
            <p className="text-xs text-amber-300/90">
              Your Solo plan is capped at 50 active members. Upgrade to the Club plan for unlimited members and extra coach seats!
            </p>
            <div className="pt-1">
              <Link
                href="/settings"
                className="inline-block px-3 py-1.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition"
              >
                Upgrade to Club Plan
              </Link>
            </div>
          </div>
        )}

        {/* Member Usage Progress Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Roster Capacity</h3>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">
                {planTier} plan
              </span>
            </div>
            <p className="text-sm font-bold text-white">
              {memberCount} {isSoloPlan ? `/ ${maxMembers}` : ''} Active Members
            </p>
          </div>

          <div className="w-full sm:w-64 space-y-1.5">
            <div className="flex justify-between text-[11px] font-medium text-slate-400">
              <span>{isSoloPlan ? 'Solo Plan Limit' : 'Club Tier'}</span>
              <span>{isSoloPlan ? `${percentageUsed}%` : 'Unlimited'}</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div 
                className={`h-full transition-all duration-500 ${
                  percentageUsed >= 100 
                    ? 'bg-rose-500' 
                    : percentageUsed >= 80 
                    ? 'bg-amber-500' 
                    : 'bg-emerald-500'
                }`}
                style={{ width: isSoloPlan ? `${percentageUsed}%` : '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Add / Import Section Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Single Add Form (2 Cols) */}
          <section className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-semibold">Add Single Member</h2>
              <p className="text-xs text-slate-400 mt-0.5">Quickly add an individual fencer or parent to your alert roster.</p>
            </div>

            <form action={addMemberAction} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-wider">Full Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Alex Morgan"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="alex@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-wider">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="+1 555-0199"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-3 pt-1">
                <p className="text-[11px] text-slate-500">
                  Members get email alerts automatically. Text alerts require the member to opt in
                  themselves &mdash; there&apos;s a link to do that at the bottom of every alert email.
                </p>
              </div>

              <div className="sm:col-span-3 pt-1">
                <button
                  type="submit"
                  disabled={isSoloPlan && memberCount >= maxMembers}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed font-bold text-xs text-white rounded-lg transition cursor-pointer"
                >
                  + Add Member
                </button>
              </div>
            </form>
          </section>

          {/* CSV Import Form (1 Col) */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-semibold">Bulk Upload CSV</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload a CSV containing columns for <code className="text-emerald-400">Name</code>, <code className="text-emerald-400">Email</code>, and <code className="text-emerald-400">Phone</code>. Existing emails will update automatically.
              </p>
            </div>

            <form action={uploadCsvAction} className="space-y-3">
              <input
                type="file"
                name="csv_file"
                accept=".csv"
                required
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
              />
              <button
                type="submit"
                disabled={isSoloPlan && memberCount >= maxMembers}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 disabled:text-slate-600 disabled:cursor-not-allowed border border-slate-700 font-bold text-xs text-white rounded-lg transition cursor-pointer"
              >
                Upload Roster (.csv)
              </button>
            </form>
          </section>

        </div>

        {/* Member Roster View & Edit */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold">Club Roster ({memberCount})</h2>
          </div>

          {members && members.length > 0 ? (
            <div className="space-y-3">
              {members.map((m) => (
                <div key={m.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 sm:p-4 transition hover:border-slate-700">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center">
                    
                    {/* Inline Update Form */}
                    <form action={updateMemberAction} id={`update-${m.id}`} className="sm:col-span-10 grid grid-cols-1 sm:grid-cols-6 gap-2 sm:gap-3 items-center">
                      <input type="hidden" name="id" value={m.id} />
                      
                      <div className="sm:col-span-2">
                        <label className="block text-[9px] font-medium text-slate-500 uppercase tracking-wider mb-0.5 sm:hidden">Name</label>
                        <input
                          type="text"
                          name="name"
                          defaultValue={m.name}
                          required
                          className="w-full bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[9px] font-medium text-slate-500 uppercase tracking-wider mb-0.5 sm:hidden">Email</label>
                        <input
                          type="email"
                          name="email"
                          defaultValue={m.email || ''}
                          placeholder="No email"
                          className="w-full bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[9px] font-medium text-slate-500 uppercase tracking-wider mb-0.5 sm:hidden">Phone</label>
                        <input
                          type="tel"
                          name="phone"
                          defaultValue={m.phone || ''}
                          placeholder="No phone"
                          className="w-full bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="sm:col-span-6 flex items-center gap-2 flex-wrap">
                        {m.sms_opt_in ? (
                          <>
                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded-full px-2 py-0.5">
                              Text alerts on
                            </span>
                            {m.sms_opt_in_at && (
                              <span className="text-[10px] text-slate-600">
                                since {new Date(m.sms_opt_in_at).toLocaleDateString()}
                              </span>
                            )}
                            <button
                              type="submit"
                              form={`revoke-sms-${m.id}`}
                              className="text-[10px] text-slate-500 hover:text-rose-400 underline transition cursor-pointer"
                            >
                              Turn off
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-600">
                            Email only &mdash; member can enable texts from their preferences link
                          </span>
                        )}
                      </div>
                    </form>

                    {/* Separate form so revoking isn't bundled into the edit form */}
                    <form action={revokeSmsConsentAction} id={`revoke-sms-${m.id}`} className="hidden">
                      <input type="hidden" name="id" value={m.id} />
                    </form>

                    {/* Action Buttons */}
                    <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-900">
                      <button
                        type="submit"
                        form={`update-${m.id}`}
                        className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-slate-300 rounded-md transition cursor-pointer"
                      >
                        Save
                      </button>

                      <form action={deleteMemberAction} className="flex-1 sm:flex-none">
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          type="submit"
                          className="w-full px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/60 text-[11px] font-semibold text-rose-400 rounded-md transition cursor-pointer"
                        >
                          Delete
                        </button>
                      </form>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-xs sm:text-sm">No members added yet.</p>
          )}
        </section>

      </div>
    </div>
  )
}