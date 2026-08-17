// app/login/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const { message } = await searchParams
  const supabase = await createClient()

  // If already logged in, send straight to dashboard
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    redirect('/dashboard')
  }

  // SERVER ACTION: Login
  async function signIn(formData: FormData) {
    'use server'
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return redirect(`/login?message=${encodeURIComponent(error.message)}`)
    }

    return redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 md:p-10">
      
      {/* Header Section Matching Splash Brand */}
      <header className="max-w-6xl w-full mx-auto pb-4 border-b border-slate-800">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="hover:opacity-90 transition">
            <div className="text-2xl font-bold tracking-tight text-white">
              Spot<span className="text-blue-500">Fillr</span>
            </div>
          </Link>

          <Link 
            href="/" 
            className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition"
          >
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center py-12">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-6">
          
          <div className="text-center space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Coach Sign In</h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Enter your credentials to manage your lesson alerts and roster.
            </p>
          </div>

          {message && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg text-xs text-rose-300 text-center">
              {message}
            </div>
          )}

          <form action={signIn} className="space-y-4">
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
              Sign In to Dashboard
            </button>
          </form>

          {/* Registration Link for new users */}
          <div className="text-center text-xs text-slate-400 pt-4 border-t border-slate-800">
            Need an account?{' '}
            <Link href="/register?plan=solo" className="text-blue-400 hover:underline font-medium">
              Start Free Trial
            </Link>
          </div>

        </div>
      </main>

      {/* Footer Branding */}
      <footer className="text-center text-xs text-slate-600 max-w-6xl w-full mx-auto pt-4 border-t border-slate-900">
        &copy; {new Date().getFullYear()} SpotFillr. All rights reserved.
      </footer>

    </div>
  )
}