import Link from 'next/link'

export default function PrivacyPage({ params: { locale } }: { params: { locale: string } }) {
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
        <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mb-8">Last updated: July 19, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">1. Introduction</h2>
            <p>CallCrafter AI ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered call center platform.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">2. Information We Collect</h2>
            <h3 className="text-xl font-medium text-white mt-6 mb-2">Personal Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account Information:</strong> Name, email address, company name, phone number</li>
              <li><strong>Billing Information:</strong> Payment method details (processed securely via Stripe)</li>
              <li><strong>Profile Information:</strong> Avatar, preferences, communication settings</li>
            </ul>
            <h3 className="text-xl font-medium text-white mt-6 mb-2">Conversation Data</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Call recordings and transcripts (when using voice features)</li>
              <li>Chat messages and conversation history</li>
              <li>WhatsApp messages and metadata</li>
              <li>AI agent interactions and responses</li>
            </ul>
            <h3 className="text-xl font-medium text-white mt-6 mb-2">Technical Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>IP address, browser type, device information</li>
              <li>Usage patterns and analytics</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide and maintain our AI-powered call center services</li>
              <li>To process transactions and manage subscriptions</li>
              <li>To improve our AI models and service quality</li>
              <li>To communicate with you about updates, support, and promotional offers</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">4. Data Sharing and Disclosure</h2>
            <p>We may share your information with:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Service Providers:</strong> Stripe (payment processing), ElevenLabs (voice AI), OpenAI/Anthropic (AI processing)</li>
              <li><strong>Meta (WhatsApp):</strong> Messages sent via WhatsApp are processed through Meta's infrastructure</li>
              <li><strong>Legal Authorities:</strong> When required by law or to protect our rights</li>
            </ul>
            <p className="mt-4">We do not sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">5. Data Retention</h2>
            <p>We retain your information for as long as your account is active or as needed to provide services. Conversation data is retained for the duration of your subscription plus 90 days. You may request deletion of your data at any time.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">6. Data Security</h2>
            <p>We implement industry-standard security measures including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Encryption at rest and in transit (TLS 1.3)</li>
              <li>Role-based access control</li>
              <li>Regular security audits</li>
              <li>Secure data centers with ISO 27001 certification</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">7. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your data ("Right to be Forgotten")</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">8. Third-Party Services</h2>
            <p>Our platform integrates with third-party services:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Stripe:</strong> Payment processing. See <a href="https://stripe.com/privacy" className="text-indigo-400 hover:text-indigo-300" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a></li>
              <li><strong>Meta (WhatsApp):</strong> WhatsApp messaging. See <a href="https://www.facebook.com/privacy/policy" className="text-indigo-400 hover:text-indigo-300" target="_blank" rel="noopener noreferrer">Meta Privacy Policy</a></li>
              <li><strong>OpenAI/Anthropic:</strong> AI processing. See their respective privacy policies</li>
              <li><strong>ElevenLabs:</strong> Voice AI. See <a href="https://elevenlabs.io/privacy" className="text-indigo-400 hover:text-indigo-300" target="_blank" rel="noopener noreferrer">ElevenLabs Privacy Policy</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">9. Contact Us</h2>
            <p>For privacy-related inquiries, please contact us at:</p>
            <p className="mt-2">Email: <a href="mailto:privacy@callcrafter.com.tr" className="text-indigo-400 hover:text-indigo-300">privacy@callcrafter.com.tr</a></p>
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
