import Link from 'next/link'

export default function TermsPage({ params: { locale } }: { params: { locale: string } }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-slate-300">
      <header className="border-b border-slate-700/50 backdrop-blur-sm fixed w-full top-0 z-50 bg-slate-900/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CC</span>
            </div>
            <span className="text-white font-bold text-xl">CallCrafter AI</span>
          </Link>
          <Link href={`/${locale}`} className="text-slate-400 hover:text-white transition-colors text-sm">
            &larr; Back to Home
          </Link>
        </div>
      </header>

      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>
        <p className="text-slate-500 text-sm mb-8">Last updated: July 19, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">1. Acceptance of Terms</h2>
            <p>By accessing or using CallCrafter AI ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">2. Description of Service</h2>
            <p>CallCrafter AI provides an AI-powered call center platform that includes:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>AI voice agents for handling incoming calls</li>
              <li>Multi-channel messaging (WhatsApp, Instagram, Web Chat)</li>
              <li>Conversation analytics and reporting</li>
              <li>Integration with third-party services (Stripe, ElevenLabs, etc.)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">3. User Accounts</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You must provide accurate information when creating an account</li>
              <li>You are responsible for maintaining the confidentiality of your credentials</li>
              <li>You must not share your account with unauthorized users</li>
              <li>You must notify us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">4. Subscription and Billing</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Subscription plans and pricing are displayed on our website</li>
              <li>Billing is processed monthly via Stripe</li>
              <li>Cancel anytime — service continues until the end of the billing period</li>
              <li>Refunds are handled on a case-by-case basis</li>
              <li>We may change pricing with 30 days notice</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the Platform for illegal activities</li>
              <li>Harass, abuse, or harm others through the Platform</li>
              <li>Reverse engineer, decompile, or tamper with the Platform</li>
              <li>Attempt to bypass rate limits or security measures</li>
              <li>Use the Platform to send spam or unsolicited messages</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">6. AI-Generated Content</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>AI agents may generate responses that are not always accurate</li>
              <li>You are responsible for monitoring AI interactions</li>
              <li>We are not liable for damages caused by AI-generated content</li>
              <li>You must comply with all applicable laws regarding AI use</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">7. Data Privacy</h2>
            <p>Our data practices are described in our <Link href={`/${locale}/privacy`} className="text-indigo-400 hover:text-indigo-300">Privacy Policy</Link>. By using the Platform, you consent to our data practices.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, CallCrafter AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">9. Termination</h2>
            <p>We reserve the right to suspend or terminate accounts that violate these terms. You may terminate your account at any time. Upon termination, your data will be deleted within 90 days.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">10. Changes to Terms</h2>
            <p>We may update these terms with 30 days notice via email. Continued use after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">11. Governing Law</h2>
            <p>These terms are governed by the laws of the Republic of Turkey. Any disputes shall be resolved in the courts of Istanbul, Turkey.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">12. Contact</h2>
            <p>For questions about these terms, contact us at:</p>
            <p className="mt-2">Email: <a href="mailto:legal@callcrafter.com.tr" className="text-indigo-400 hover:text-indigo-300">legal@callcrafter.com.tr</a></p>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-700/50 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} CallCrafter AI. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
