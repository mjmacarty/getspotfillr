// app/register/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; plan?: string }>
}) {
  const { message, plan } = await searchParams
  const selectedPlan = plan === 'club' ? 'club' : 'solo'
  const supabase = await createClient()

  // If already logged in, send straight to dashboard
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    redirect('/dashboard')
  }

  async function signUp(formData: FormData) {
    'use server'
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('fullName') as string
    const clubName = formData.get('clubName') as string
    const chosenPlan = formData.get('plan') as string

    const supabase = await createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          club_name: clubName,
          plan: chosenPlan,
        },
      },
    })

    if (error) {
      return redirect(`/register?plan=${chosenPlan}&message=${encodeURIComponent(error.message)}`)
    }

    return redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 md:p-10">
      <header className="max-w-6xl w-full mx-auto pb-4 border-b border-slate-800 flex justify-between items-center">
        <Link href="/" className="hover:opacity-90 transition">
          <div className="text-xl font-bold tracking-tight text-white">
            Spot<span className="text-blue-500">Fillr</span>
          </div>
        </Link>
        <Link 
          href="/login" 
          className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition"
        >
          Sign In
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center py-12">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Create Coach Account</h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Start your 14-day free trial to manage your lesson alerts.
            </p>
          </div>

          {message && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg text-xs text-rose-300 text-center">
              {message}
            </div>
          )}

          <form action={signUp} className="space-y-4">
            
            {/* Interactive Plan Selector Cards */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Select Your Plan
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/register?plan=solo"
                  className={`p-3 text-center border rounded-lg text-xs font-medium transition ${
                    selectedPlan === 'solo'
                      ? 'bg-blue-600/20 border-blue-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-sm font-bold text-white">Solo Coach</div>
                  <div className="text-[10px] text-slate-400">$69/mo</div>
                </Link>

                <Link
                  href="/register?plan=club"
                  className={`p-3 text-center border rounded-lg text-xs font-medium transition ${
                    selectedPlan === 'club'
                      ? 'bg-blue-600/20 border-blue-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-sm font-bold text-white">Club Roster</div>
                  <div className="text-[10px] text-slate-400">$119/mo</div>
                </Link>
              </div>
            </div>

            <input type="hidden" name="plan" value={selectedPlan} />

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                required
                placeholder="Coach Alex"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 sm:p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Club Name
              </label>
              <input
                type="text"
                name="clubName"
                required
                placeholder="Leo Fencing Club"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 sm:p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="coach@club.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 sm:p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 sm:p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-500 font-bold text-xs sm:text-sm text-white rounded-lg transition cursor-pointer"
            >
              Start 14-Day Free Trial
            </button>
          </form>

          <div className="text-center text-xs text-slate-400 pt-4 border-t border-slate-800">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-400 hover:underline font-medium">
              Sign In
            </Link>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-slate-600 max-w-6xl w-full mx-auto pt-4 border-t border-slate-900">
        &copy; {new Date().getFullYear()} SpotFillr. All rights reserved.
      </footer>
    </div>
  )
}