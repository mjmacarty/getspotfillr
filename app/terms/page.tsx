import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service | SpotFillr',
}

export default function TermsPage() {
  const effectiveDate = 'August 18, 2026'

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-10">
        <header className="space-y-3 pb-6 border-b border-slate-800">
          <Link href="/" className="inline-block hover:opacity-90 transition">
            <div className="text-xl font-bold tracking-tight text-white">
              Spot<span className="text-blue-500">Fillr</span>
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-xs text-slate-500">Effective {effectiveDate}</p>
        </header>

        <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Agreement</h2>
            <p>
              By creating a SpotFillr account or using SpotFillr to notify your club members of
              open lesson slots, you agree to these terms. If you do not agree, please do not use
              the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">The Service</h2>
            <p>
              SpotFillr lets a coach report a canceled lesson slot and automatically notify their
              club roster by email and (for members who opt in) SMS text, with a link members can
              use to claim the open slot on a first-come, first-served basis.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Your Responsibilities</h2>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>You are responsible for the accuracy of the member roster you upload or enter.</li>
              <li>
                You must have a lawful basis to contact each member you add, and must honor a
                member&apos;s choice to opt out of SMS alerts.
              </li>
              <li>You may not use SpotFillr to send content unrelated to lesson-slot availability.</li>
              <li>You are responsible for keeping your account credentials secure.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Billing &amp; Cancellation</h2>
            <p>
              SpotFillr runs month-to-month. There is no long-term contract. You may cancel at any
              time from your settings page; your service will continue through the end of the
              current billing period and will not renew or be billed again after that.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Availability</h2>
            <p>
              We aim to keep SpotFillr available and reliable, but we do not guarantee
              uninterrupted access. We are not liable for a missed lesson-slot notification caused
              by factors outside our reasonable control, including third-party email/SMS delivery
              failures or carrier filtering.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Data</h2>
            <p>
              How we handle member and coach data is described in our{' '}
              <Link href="/privacy" className="text-blue-400 hover:underline">
                Privacy Policy
              </Link>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Termination</h2>
            <p>
              We may suspend or terminate an account that violates these terms, including misuse
              of the notification system to contact members outside its intended purpose.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Changes to These Terms</h2>
            <p>
              We may update these terms from time to time. Material changes will be reflected by
              updating the effective date above.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Contact</h2>
            <p>
              Questions about these terms can be sent to{' '}
              <a href="mailto:hello@getspotfillr.com" className="text-blue-400 hover:underline">
                hello@getspotfillr.com
              </a>.
            </p>
          </section>
        </div>

        <footer className="pt-6 border-t border-slate-900">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition">
            &larr; Back to SpotFillr
          </Link>
        </footer>
      </div>
    </div>
  )
}
