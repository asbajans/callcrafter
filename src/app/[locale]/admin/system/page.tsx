'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Settings, Server, Database, HardDrive, RefreshCw, CheckCircle, XCircle, Eye, EyeOff, Globe } from 'lucide-react';

interface EnvVar {
  key: string;
  value: string;
  masked: boolean;
}

interface SystemService {
  name: string;
  icon: React.ReactNode;
  status: 'healthy' | 'degraded' | 'down';
}

export default function AdminSystemPage() {
  const t = useTranslations();
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const envVars: EnvVar[] = [
    { key: 'DATABASE_URI', value: 'postgresql://****@localhost:5432/callcrafter', masked: true },
    { key: 'REDIS_URL', value: 'redis://****@localhost:6379', masked: true },
    { key: 'PAYLOAD_SECRET', value: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6', masked: true },
    { key: 'STRIPE_SECRET_KEY', value: 'sk_live_****ENiF', masked: true },
    { key: 'STRIPE_WEBHOOK_SECRET', value: 'whsec_****abc123', masked: true },
    { key: 'TWILIO_ACCOUNT_SID', value: 'AC****abc123', masked: true },
    { key: 'TWILIO_AUTH_TOKEN', value: '****', masked: true },
    { key: 'NEXT_PUBLIC_APP_URL', value: 'https://app.callcrafter.com', masked: false },
  ];

  const services: SystemService[] = [
    { name: 'Database', icon: <Database className="w-5 h-5" />, status: 'healthy' },
    { name: 'Redis', icon: <HardDrive className="w-5 h-5" />, status: 'healthy' },
    { name: 'Payload API', icon: <Server className="w-5 h-5" />, status: 'healthy' },
  ];

  const webhooks = [
    { url: 'https://api.callcrafter.com/api/webhooks/stripe', source: 'Stripe', status: 'active' },
    { url: 'https://api.callcrafter.com/api/webhooks/twilio', source: 'Twilio', status: 'active' },
    { url: 'https://api.callcrafter.com/api/webhooks/elevenlabs', source: 'ElevenLabs', status: 'active' },
  ];

  function handleClearCache() {
    setClearing(true);
    setCleared(false);
    setTimeout(() => {
      setClearing(false);
      setCleared(true);
      setTimeout(() => setCleared(false), 3000);
    }, 1500);
  }

  function maskValue(value: string, key: string): string {
    if (revealed[key]) return value;
    if (value.length <= 4) return '****';
    return value.slice(0, 3) + '****' + value.slice(-4);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('admin.system')}</h1>
        <p className="text-slate-500 mt-1">System settings and configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-slate-900">Environment Variables</h2>
            </div>
            <span className="text-xs text-slate-400">{envVars.length} variables</span>
          </div>
          <div className="divide-y divide-slate-100">
            {envVars.map((env) => (
              <div key={env.key} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700 font-mono">{env.key}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                    {maskValue(env.value, env.key)}
                  </p>
                </div>
                {env.masked && (
                  <button
                    onClick={() => setRevealed((prev) => ({ ...prev, [env.key]: !prev[env.key] }))}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0 ml-2"
                    title={revealed[env.key] ? 'Hide' : 'Reveal'}
                  >
                    {revealed[env.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-slate-900">System Health</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {services.map((service) => (
                <div key={service.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={service.status === 'healthy' ? 'text-emerald-500' : 'text-red-500'}>
                      {service.icon}
                    </span>
                    <span className="text-sm text-slate-700">{service.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {service.status === 'healthy' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className={`text-xs font-medium ${service.status === 'healthy' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {service.status === 'healthy' ? 'Connected' : 'Down'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-slate-900">Webhook URLs</h2>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {webhooks.map((webhook, i) => (
                <div key={i} className="px-6 py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700">{webhook.source}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">{webhook.url}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 shrink-0 ml-2">
                    {webhook.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Cache Management</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-700">Application Cache</p>
              <p className="text-xs text-slate-400 mt-0.5">Clear all cached data and reload fresh content</p>
            </div>
            <button
              onClick={handleClearCache}
              disabled={clearing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${clearing ? 'animate-spin' : ''}`} />
              {clearing ? 'Clearing...' : cleared ? 'Cleared!' : 'Clear Cache'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
