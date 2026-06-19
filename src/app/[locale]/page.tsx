import { useTranslations } from 'next-intl';
import Link from 'next/link';

const features = [
  {
    titleKey: 'ai_agents',
    descriptionKey: 'ai_agents_desc',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    )
  },
  {
    titleKey: 'multi_channel',
    descriptionKey: 'multi_channel_desc',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    )
  },
  {
    titleKey: 'smart_routing',
    descriptionKey: 'smart_routing_desc',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
      </svg>
    )
  },
  {
    titleKey: 'analytics',
    descriptionKey: 'analytics_desc',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    )
  }
];

const socialProof = [
  { number: '10.000+', label: 'processed_calls', color: 'from-indigo-400 to-indigo-600' },
  { number: '98.5%', label: 'uptime', color: 'from-emerald-400 to-emerald-600' },
  { number: '4.9/5', label: 'avg_rating', color: 'from-amber-400 to-amber-600' },
  { number: '50+', label: 'countries', color: 'from-rose-400 to-rose-600' },
];

const pricingPlans = [
  {
    name: 'starter',
    price: '$29',
    period: '/month',
    features: ['1 AI agent', '500 min/month', 'Voice + Chat', 'Email support'],
    highlighted: false,
  },
  {
    name: 'professional',
    price: '$99',
    period: '/month',
    features: ['5 AI agents', '5000 min/month', 'All channels', 'Priority support', 'Training docs'],
    highlighted: true,
  },
  {
    name: 'enterprise',
    price: '$299',
    period: '/month',
    features: ['Unlimited agents', 'Unlimited minutes', 'Custom integration', 'Dedicated support', 'SLA guarantee'],
    highlighted: false,
  },
];

export default function HomePage() {
  const t = useTranslations();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <header className="border-b border-slate-700/50 backdrop-blur-sm fixed w-full top-0 z-50 bg-slate-900/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CC</span>
            </div>
            <span className="text-white font-bold text-xl">CallCrafter AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/en/auth/login"
              className="text-slate-300 hover:text-white transition-colors"
            >
              {t('auth.login')}
            </Link>
            <Link
              href="/en/auth/register"
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500 transition-colors"
            >
              {t('auth.registerButton')}
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-16">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-300 text-sm font-medium mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            AI-Powered Call Center Solution
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold text-white mb-6 leading-tight">
            Transform Your
            <span className="bg-gradient-to-r from-indigo-400 to-amber-400 bg-clip-text text-transparent"> Customer Experience</span>
            <br />with AI
          </h1>
          <p className="text-xl text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed">
            CallCrafter AI handles your incoming calls intelligently — never miss a customer again.
            Multi-channel support, smart routing, and real-time analytics.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/en/auth/register"
              className="bg-indigo-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
            >
              Start Free Trial
            </Link>
            <Link
              href="#demo"
              className="border border-slate-500 text-slate-300 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-slate-700 transition-colors"
            >
              Watch Demo
            </Link>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {socialProof.map((stat, i) => (
              <div key={i} className="text-center">
                <div className={`text-4xl font-bold bg-gradient-to-br ${stat.color} bg-clip-text text-transparent mb-2`}>
                  {stat.number}
                </div>
                <p className="text-slate-400 text-sm">{t(`landing.${stat.label}`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Why CallCrafter AI?
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            Everything you need to provide exceptional customer service
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-indigo-500/50 transition-all hover:shadow-lg hover:shadow-indigo-500/5 group">
                <div className="text-indigo-400 mb-4 group-hover:scale-110 transition-transform">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{t(`landing.${feature.titleKey}`)}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{t(`landing.${feature.descriptionKey}`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            Start with a free trial. No credit card required.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, i) => (
              <div
                key={i}
                className={`rounded-2xl p-8 ${
                  plan.highlighted
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-400/20 scale-105'
                    : 'bg-slate-800/50 text-slate-300 border border-slate-700'
                }`}
              >
                {plan.highlighted && (
                  <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full mb-4 inline-block">
                    Most Popular
                  </span>
                )}
                <h3 className="text-2xl font-bold mb-2 capitalize">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-white'}`}>
                    {plan.price}
                  </span>
                  <span className={plan.highlighted ? 'text-indigo-200' : 'text-slate-500'}>
                    {plan.period}
                  </span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <svg className={`w-4 h-4 ${plan.highlighted ? 'text-indigo-200' : 'text-indigo-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/en/auth/register"
                  className={`block text-center py-3 rounded-xl font-semibold transition-colors ${
                    plan.highlighted
                      ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center" id="demo">
          <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Transform Your Communication?
            </h2>
            <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
              Join thousands of businesses using CallCrafter AI to provide exceptional customer service.
            </p>
            <Link
              href="/en/auth/register"
              className="inline-block bg-indigo-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/25"
            >
              Start Your Free Trial
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-700/50 py-12">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">CC</span>
              </div>
              <span className="text-white font-bold text-lg">CallCrafter AI</span>
            </div>
            <p className="text-slate-500 text-sm">AI-powered call center solution.</p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Product</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><Link href="#" className="hover:text-slate-300">Features</Link></li>
              <li><Link href="#" className="hover:text-slate-300">Pricing</Link></li>
              <li><Link href="#" className="hover:text-slate-300">Integrations</Link></li>
              <li><Link href="#" className="hover:text-slate-300">API</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Company</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><Link href="#" className="hover:text-slate-300">About</Link></li>
              <li><Link href="#" className="hover:text-slate-300">Blog</Link></li>
              <li><Link href="#" className="hover:text-slate-300">Careers</Link></li>
              <li><Link href="#" className="hover:text-slate-300">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><Link href="#" className="hover:text-slate-300">Privacy</Link></li>
              <li><Link href="#" className="hover:text-slate-300">Terms</Link></li>
              <li><Link href="#" className="hover:text-slate-300">GDPR</Link></li>
              <li><Link href="#" className="hover:text-slate-300">Security</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-8 pt-8 border-t border-slate-700/50 text-center text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} CallCrafter AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}