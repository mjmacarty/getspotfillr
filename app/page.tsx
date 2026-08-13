// app/page.tsx
import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 md:p-10">
      
      {/* Header / Nav */}
<header className="max-w-6xl w-full mx-auto pb-4 border-b border-slate-800">
  <div className="flex items-center justify-between gap-4">
    <Link href="/" className="hover:opacity-90 transition">
      <div className="text-xl font-bold tracking-tight text-white">
        Spot<span className="text-blue-500">Fillr</span>
      </div>
    </Link>

    <nav className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm font-medium">
      <a href="#features" className="text-slate-400 hover:text-white transition">Features</a>
      <a href="#pricing" className="text-slate-400 hover:text-white transition">Pricing</a>
      <Link 
        href="/login" 
        className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition"
      >
        Sign In
      </Link>
      <Link 
        href="/register?plan=solo" 
        className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition shadow-sm"
      >
        Sign Up
      </Link>
    </nav>
  </div>
</header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 max-w-5xl mx-auto py-16 sm:py-20 space-y-20">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-400 bg-blue-950/60 border border-blue-800 px-3 py-1 rounded-full mb-6 inline-block">
            Automated Slot Recovery
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6">
            Fill Canceled Lessons <br />
            <span className="text-blue-500">With a Single Click</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mb-8 leading-relaxed mx-auto">
            SpotFillr automatically notifies your members when private lesson slots open up due to late cancellations—rescheduling your coaches instantly.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/register?plan=solo"
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 font-bold text-sm text-white rounded-xl transition cursor-pointer shadow-lg shadow-blue-950/50"
            >
              Start 14-Day Free Trial
            </Link>
            <a
              href="#pricing"
              className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 font-semibold text-sm text-slate-300 rounded-xl transition"
            >
              View Pricing Plans
            </a>
          </div>
        </div>

        {/* Features Section */}
        <section id="features" className="w-full space-y-12 pt-12 border-t border-slate-900 text-left">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Built specifically for private lesson schedules</h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              Stop wasting prime training hours when fencers cancel last minute.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-6 space-y-3">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">Step 01</span>
              <h3 className="font-bold text-base text-white">Spot Opens</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Coach reports an unexpected opening for today or tomorrow right from their dashboard or phone.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-6 space-y-3">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">Step 02</span>
              <h3 className="font-bold text-base text-white">Instant Broadcast</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                SpotFillr broadcasts a dedicated magic claim link to your roster via email or SMS.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-6 space-y-3">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">Step 03</span>
              <h3 className="font-bold text-base text-white">One-Tap Claim</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                First parent/member to tap "Claim" locks the slot. Revenue is saved, and the slot automatically closes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <div className="bg-slate-900 border border-slate-800/60 rounded-xl p-5 space-y-2">
              <h4 className="font-semibold text-sm text-white">Frictionless Parent Claiming</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Members don't need an account or password. Clicking the link lets them select their fencer name and secure the lesson instantly.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800/60 rounded-xl p-5 space-y-2">
              <h4 className="font-semibold text-sm text-white">Simple Member Sync & Update</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Drag and drop your club software generated member list. Automatic email matching ensures roster contacts stay current without duplicates.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800/60 rounded-xl p-5 space-y-2">
              <h4 className="font-semibold text-sm text-white">Revenue Recovery Dashboard</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track open vs. recovered slots and dollar amounts in real time.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800/60 rounded-xl p-5 space-y-2">
              <h4 className="font-semibold text-sm text-white">Flexible Duration & Timezone Controls</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Configure default 20, 25, or 30-minute lesson blocks mapped directly to your local club timezone.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="w-full space-y-8 pt-12 border-t border-slate-900 text-left">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Simple, ROI-focused pricing</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Recover just 1 to 2 lesson cancellations a month and SpotFillr completely pays for itself.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold">Solo Coach</h3>
                  <p className="text-xs text-slate-400 mt-1">For independent coaches running a focused private lesson book.</p>
                </div>
                <div className="text-3xl font-extrabold">$69<span className="text-xs font-normal text-slate-400">/mo</span></div>
                <ul className="space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-blue-500 font-bold">✓</span> 1 Coach Account
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-500 font-bold">✓</span> Up to 50 Active Roster Members
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-500 font-bold">✓</span> Instant Email & Broadcast Alerts
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-500 font-bold">✓</span> Bulk CSV Import & Auto-Upsert
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-500 font-bold">✓</span> 14-Day Free Trial
                  </li>
                </ul>
              </div>
              <Link
                href="/register?plan=solo"
                className="w-full py-3 text-center bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold text-xs text-white rounded-lg transition"
              >
                Start 14-Day Free Trial
              </Link>
            </div>

            <div className="bg-slate-900 border-2 border-blue-500 rounded-2xl p-6 flex flex-col justify-between space-y-6 relative shadow-xl shadow-blue-950/30">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-extrabold uppercase px-3 py-0.5 rounded-full tracking-wider">
                Most Popular
              </span>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold">Club Roster</h3>
                  <p className="text-xs text-slate-400 mt-1">Multi-coach coordination for clubs and fencing academies.</p>
                </div>
                <div className="text-3xl font-extrabold">$119<span className="text-xs font-normal text-slate-400">/mo</span></div>
                <ul className="space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-blue-500 font-bold">✓</span> Includes 2 Coach Accounts
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-500 font-bold">✓</span> Unlimited Roster Members
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-500 font-bold">✓</span> Add extra coaches for +$39/mo each
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-500 font-bold">✓</span> Shared Club Roster & One-Click Claiming
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-500 font-bold">✓</span> 14-Day Free Trial
                  </li>
                </ul>
              </div>
              <Link
                href="/register?plan=club"
                className="w-full py-3 text-center bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white rounded-lg transition shadow-md shadow-blue-950/50"
              >
                Start 14-Day Free Trial
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* Footer Branding */}
      <footer className="text-center text-xs text-slate-600 max-w-6xl w-full mx-auto pt-4 border-t border-slate-900">
        &copy; {new Date().getFullYear()} SpotFillr. All rights reserved.
      </footer>

    </div>
  )
}