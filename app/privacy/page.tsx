import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | SpotFillr',
}

export default function PrivacyPage() {
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-xs text-slate-500">Effective {effectiveDate}</p>
        </header>

        <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Overview</h2>
            <p>
              SpotFillr (&quot;we,&quot; &quot;us&quot;) provides a tool coaches use to notify their club
              members when a private lesson slot opens up due to a cancellation. This policy
              describes what information we collect, how we use it, and the choices you have.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Information We Collect</h2>
            <p>We collect two categories of information:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <span className="text-white font-medium">Coach account information:</span> name,
                email address, and club details provided when creating a SpotFillr account.
              </li>
              <li>
                <span className="text-white font-medium">Club member information:</span> name,
                email address, and (optionally) phone number, entered by the coach or provided
                directly by the member when managing their own alert preferences.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">How We Use Information</h2>
            <p>Member contact information is used solely to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Send email notifications when a lesson slot opens up.</li>
              <li>Send SMS text notifications, but only to members who have explicitly opted in.</li>
              <li>Let a member manage their own notification preferences via a personal link.</li>
            </ul>
            <p>
              We do not use member data for advertising, do not build profiles for marketing
              purposes, and do not contact members for any reason unrelated to the lesson-slot
              notification service the coach has set up.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">What We Never Do</h2>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>We never sell or rent member lists or contact information to anyone.</li>
              <li>We never contact members on behalf of anyone other than their own club&apos;s coach.</li>
              <li>We never share member data with other clubs or coaches using SpotFillr.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">SMS Communications</h2>
            <p>
              Phone numbers are only used to send SMS alerts to members who have opted in through
              their personal preferences link. Message and data rates may apply. A member can opt
              out at any time by returning to their preferences link and disabling text alerts.
              Opting out of SMS does not affect email notifications.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Data Storage &amp; Security</h2>
            <p>
              Data is encrypted in transit and at rest, and stored with a managed database
              provider. Access is restricted to what each coach needs to operate their own club
              roster; coaches cannot see or access another club&apos;s member data.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Third-Party Services</h2>
            <p>
              We use third-party providers to operate SpotFillr, including hosting, database, email
              delivery, and SMS delivery providers. These providers process data only as necessary
              to deliver the service and are not permitted to use it for their own purposes.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Data Retention &amp; Deletion</h2>
            <p>
              Member data is retained for as long as a coach&apos;s account is active. A coach can
              remove a member from their roster at any time, which deletes that member&apos;s
              contact information from SpotFillr.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Contact</h2>
            <p>
              Questions about this policy can be sent to{' '}
              <a href="mailto:privacy@getspotfillr.com" className="text-blue-400 hover:underline">
                privacy@getspotfillr.com
              </a>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be reflected by
              updating the effective date above.
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
