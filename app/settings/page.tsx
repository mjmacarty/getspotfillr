// app/settings/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

// -----------------------------------------------------------------------------
// Server Actions
// -----------------------------------------------------------------------------

async function signOutAction() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

async function updateDefaultsAction(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const default_duration = parseInt(formData.get('default_duration') as string) || 25
  const start_time_increment = parseInt(formData.get('start_time_increment') as string) || 15
  const timezone = (formData.get('timezone') as string) || 'America/New_York'

  await supabase
    .from('coaches')
    .update({
      default_lesson_duration: default_duration,
      start_time_increment: start_time_increment,
      timezone: timezone,
    })
    .eq('id', user.id)

  revalidatePath('/settings')
  revalidatePath('/dashboard')
}

async function inviteCoachAction(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const name = formData.get('coach_name') as string
  const email = formData.get('coach_email') as string

  if (!email || !name) return

  const { error } = await supabase
    .from('coaches')
    .insert({ name, email, status: 'invited' })

  if (error) {
    console.error('Error inviting coach:', error)
  }

  revalidatePath('/settings')
}

// -----------------------------------------------------------------------------
// Page Component
// -----------------------------------------------------------------------------

export default async function SettingsPage() {
  const supabase = await createClient()

  // 1. Check Auth State
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    redirect('/login')
  }

  // 2. Fetch coach & club details
  const { data: coach } = await supabase
    .from('coaches')
    .select('*')
    .eq('id', user.id)
    .single()

  // 3. Fetch all coaches in the club
  const { data: allCoaches } = await supabase
    .from('coaches')
    .select('*')
    .order('name', { ascending: true })

  const coachCount = allCoaches?.length || 1
  const additionalCoachFee = Math.max(0, (coachCount - 1) * 29)
  const totalMonthlyFee = 99 + additionalCoachFee

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Navigation Bar Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-800 gap-4">
          <div className="flex items-center gap-6">
            <div>
              <Link href="/dashboard" className="text-2xl font-bold tracking-tight hover:text-slate-200 transition">
                SpotFillr
              </Link>
              <p className="text-sm text-slate-400 mt-0.5">Account & System Settings</p>
            </div>

            <nav className="hidden md:flex items-center gap-4 text-sm font-medium border-l border-slate-800 pl-6">
              <Link href="/dashboard" className="text-slate-400 hover:text-white transition">
                Dashboard
              </Link>
              <Link href="/members" className="text-slate-400 hover:text-white transition">
                Members
              </Link>
              <Link href="/settings" className="text-emerald-400 font-semibold">
                Settings
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <form action={signOutAction}>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition cursor-pointer"
              >
                Sign Out
              </button>
            </form>
          </div>
        </header>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Lesson Defaults & Timezone Section */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Lesson & Timezone Preferences</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure default durations, booking increments, and primary timezone for slot expiration.
                </p>
              </div>

              <form action={updateDefaultsAction} className="space-y-4 pt-2 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  
                  {/* Duration Selector */}
                  <div>
                    <label htmlFor="default_duration" className="text-xs text-slate-400 font-medium block mb-1">
                      Lesson Duration
                    </label>
                    <select
                      id="default_duration"
                      name="default_duration"
                      defaultValue={coach?.default_lesson_duration || 25}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value={15}>15 Minutes</option>
                      <option value={20}>20 Minutes</option>
                      <option value={25}>25 Minutes</option>
                      <option value={30}>30 Minutes</option>
                      <option value={45}>45 Minutes</option>
                      <option value={60}>60 Minutes</option>
                    </select>
                  </div>

                  {/* Start Increment Selector */}
                  <div>
                    <label htmlFor="start_time_increment" className="text-xs text-slate-400 font-medium block mb-1">
                      Time Increments
                    </label>
                    <select
                      id="start_time_increment"
                      name="start_time_increment"
                      defaultValue={coach?.start_time_increment || 15}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value={5}>Every 5 minutes</option>
                      <option value={15}>Every 15 minutes</option>
                      <option value={30}>Every 30 minutes</option>
                    </select>
                  </div>

                  {/* Timezone Selector */}
                  <div>
                    <label htmlFor="timezone" className="text-xs text-slate-400 font-medium block mb-1">
                      Club Timezone
                    </label>
                    <select
                      id="timezone"
                      name="timezone"
                      defaultValue={coach?.timezone || 'America/New_York'}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    </select>
                  </div>

                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition cursor-pointer"
                  >
                    Save Preferences
                  </button>
                </div>
              </form>
            </section>

            {/* Coach Staff Roster */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Coach Staff Roster</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Invite additional coaches so they can post cancellations for their own private schedules.
                </p>
              </div>

              {/* Invite Form */}
              <form action={inviteCoachAction} className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 space-y-3">
                <span className="text-xs font-semibold uppercase text-emerald-400 tracking-wider">
                  Invite New Coach
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    name="coach_name"
                    placeholder="Coach Full Name"
                    required
                    className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    name="coach_email"
                    type="email"
                    placeholder="coach@club.com"
                    required
                    className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition cursor-pointer"
                  >
                    Send Invitation
                  </button>
                </div>
              </form>

              {/* Staff List */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Active Staff</h3>
                <div className="divide-y divide-slate-800">
                  {allCoaches && allCoaches.length > 0 ? (
                    allCoaches.map((c) => (
                      <div key={c.id} className="py-3 flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-white">{c.name}</p>
                          <p className="text-xs text-slate-400">{c.email || 'No email associated'}</p>
                        </div>
                        <span className={`px-2.5 py-0.5 text-xs rounded-full border ${
                          c.status === 'invited' 
                            ? 'bg-amber-950/60 text-amber-400 border-amber-800/80' 
                            : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80'
                        }`}>
                          {c.status || 'Active'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 py-2">No other coaches registered.</p>
                  )}
                </div>
              </div>
            </section>

          </div>

          {/* Right Column: Billing */}
          <div className="space-y-6">
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <span className="text-xs font-semibold uppercase text-emerald-400 tracking-wider">
                  Current Subscription
                </span>
                <h2 className="text-xl font-bold mt-1">Club Plan</h2>
                <p className="text-xs text-slate-400 mt-1">
                  $99/mo base + $29/mo per additional coach slot
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Club Base Fee</span>
                  <span className="font-semibold text-white">$99.00 / mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Active Coach Seats ({coachCount})</span>
                  <span className="font-semibold text-white">
                    +${additionalCoachFee}.00 / mo
                  </span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-sm">
                  <span className="text-slate-300">Total Monthly</span>
                  <span className="text-emerald-400">
                    ${totalMonthlyFee}.00 / mo
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider block">
                  Available Tiers
                </span>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="p-3 border border-slate-800 rounded-lg bg-slate-950 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-white">Solo Coach Tier</p>
                      <p className="text-slate-400">1 Coach • Unlimited Slots</p>
                    </div>
                    <span className="font-bold text-slate-300">$69 / mo</span>
                  </div>
                  <div className="p-3 border border-emerald-800/80 bg-emerald-950/20 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-emerald-400">Club Tier (Active)</p>
                      <p className="text-slate-400">Multi-Coach • Roster Import</p>
                    </div>
                    <span className="font-bold text-emerald-400">$99 + $29/coach</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-500 font-semibold py-2.5 rounded-lg text-xs text-white transition cursor-pointer"
              >
                Manage Stripe Billing
              </button>
            </section>
          </div>

        </div>

      </div>
    </div>
  )
}