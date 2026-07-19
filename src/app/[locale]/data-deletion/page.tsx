import Link from 'next/link'

export default function DataDeletionPage({ params: { locale } }: { params: { locale: string } }) {
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
        <h1 className="text-4xl font-bold text-white mb-8">User Data Deletion Request</h1>
        <p className="text-slate-500 text-sm mb-8">Last updated: July 19, 2026</p>

        <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">Option 1: Self-Service Deletion</h2>
          <p className="mb-4">You can delete your account and associated data directly from your account settings:</p>
          <ol className="list-decimal pl-6 space-y-2">
            <li>Log in to your CallCrafter AI account</li>
            <li>Go to <strong>Settings &rarr; Account</strong></li>
            <li>Click <strong>&quot;Delete Account&quot;</strong></li>
            <li>Confirm the deletion</li>
          </ol>
          <p className="mt-4 text-sm text-slate-500">Your data will be permanently deleted within 30 days. During this period, you can cancel the deletion by logging back in.</p>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">Option 2: Email Request</h2>
          <p className="mb-4">Send a data deletion request to our privacy team. Include the email address associated with your account:</p>
          <div className="bg-slate-700/50 rounded-lg p-4 mt-4">
            <p className="text-sm font-mono text-indigo-300">
              To: <a href="mailto:privacy@callcrafter.com.tr?subject=Data%20Deletion%20Request" className="text-indigo-400 hover:text-indigo-300">privacy@callcrafter.com.tr</a><br />
              Subject: Data Deletion Request<br /><br />
              I request the deletion of all data associated with my account.<br />
              Account Email: [your-email@example.com]<br />
              Reason (optional): [your reason]
            </p>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">What Gets Deleted</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Personal information (name, email, phone number)</li>
            <li>Conversation history and transcripts</li>
            <li>AI agent configurations</li>
            <li>Billing history (anonymized for legal compliance)</li>
            <li>Training documents and uploaded files</li>
          </ul>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">What Retained (Legal Obligations)</h2>
          <p>Some information may be retained as required by applicable law:</p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>Invoice records (retained for 5 years per Turkish tax law)</li>
            <li>Transaction logs (retained for 2 years)</li>
            <li>Information subject to ongoing legal proceedings</li>
          </ul>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
          <h2 className="text-2xl font-semibold text-white mb-4">WhatsApp Data</h2>
          <p>If you have connected a WhatsApp Business account:</p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>WhatsApp messages and conversation history will be deleted</li>
            <li>WhatsApp account connection will be removed</li>
            <li>Data stored on Meta servers (WhatsApp) is subject to <a href="https://www.facebook.com/privacy/policy" className="text-indigo-400 hover:text-indigo-300" target="_blank" rel="noopener noreferrer">Meta's Privacy Policy</a></li>
          </ul>
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
