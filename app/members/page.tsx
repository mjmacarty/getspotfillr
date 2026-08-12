// app/members/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

export default async function MembersPage() {
  const supabase = await createClient()

  // 1. Auth Guard
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    redirect('/login')
  }

  // 2. Fetch Coach Details
  const { data: coach } = await supabase
    .from('coaches')
    .select('id, name')
    .eq('id', user.id)
    .single()

  // 3. Fetch Active Member Roster
  const { data: members } = await supabase
    .from('members')
    .select('*')
    .order('name', { ascending: true })

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

    const { error: insertError } = await supabase
      .from('members')
      .insert({
        name,
        email: email || null,
        phone: phone || null,
      })

    if (insertError) console.error('Error adding member:', insertError)
    revalidatePath('/members')
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
      })
      .eq('id', id)

    if (updateError) console.error('Error updating member:', updateError)
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

  // SERVER ACTION: CSV Batch Upload with Upsert (Prevents duplicates)
  async function uploadCsvAction(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const file = formData.get('csv_file') as File

    if (!file || file.size === 0) return

    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)

    if (lines.length < 2) return // Requires header + at least 1 row

    // Parse header row
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''))
    const nameIdx = headers.findIndex((h) => h.includes('name'))
    const emailIdx = headers.findIndex((h) => h.includes('email'))
    const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('cell'))

    if (emailIdx === -1) return // Must have an email column for unique constraint matching

    const records = []

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/['"]/g, ''))
      const email = cols[emailIdx]
      if (!email) continue // Skip rows with blank email

      records.push({
        name: nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx] : 'Member',
        email: email.toLowerCase().trim(),
        phone: phoneIdx !== -1 && cols[phoneIdx] ? cols[phoneIdx] : null,
      })
    }

    if (records.length > 0) {
      // Upsert: Updates existing records by email conflict or inserts new ones
      const { error: batchError } = await supabase
        .from('members')
        .upsert(records, { onConflict: 'email' })

      if (batchError) console.error('Error upserting CSV members:', batchError)
    }

    revalidatePath('/members')
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
              {/* Desktop Nav Links */}
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
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white rounded-lg transition cursor-pointer"
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
                Upload a CSV containing columns for <code className="text-emerald-400">Name</code>, <code className="text-emerald-400">Email</code>, and <code className="text-emerald-400">Phone</code>. Existing emails will automatically update, while new entries are added.
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
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold text-xs text-white rounded-lg transition cursor-pointer"
              >
                Upload Roster (.csv)
              </button>
            </form>
          </section>

        </div>

        {/* Member Roster View & Edit */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold">Club Roster ({members?.length || 0})</h2>
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