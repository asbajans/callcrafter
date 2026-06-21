'use client';

import { useState } from 'react';
import {
  MessageCircle, Instagram, Globe, Calendar, Database, Link2, Unlink,
  ExternalLink, Check, Loader2, AlertCircle,
} from 'lucide-react';

type Integration = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
  configurable: boolean;
  docsUrl?: string;
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Instagram DM mesajlarını alın ve yanıtlayın',
      icon: <Instagram className="w-5 h-5" />,
      connected: false,
      configurable: true,
      docsUrl: 'https://developers.facebook.com/docs/instagram-api',
    },
    {
      id: 'facebook',
      name: 'Facebook Messenger',
      description: 'Facebook sayfanızdan gelen mesajları yönetin',
      icon: <MessageCircle className="w-5 h-5" />,
      connected: false,
      configurable: true,
      docsUrl: 'https://developers.facebook.com/docs/messenger-platform',
    },
    {
      id: 'crm',
      name: 'CRM Entegrasyonu',
      description: 'Müşteri verilerinizi senkronize edin (HubSpot, Salesforce)',
      icon: <Database className="w-5 h-5" />,
      connected: false,
      configurable: true,
    },
    {
      id: 'calendar',
      name: 'Takvim Entegrasyonu',
      description: 'Randevuları otomatik planlayın (Google Calendar, Outlook)',
      icon: <Calendar className="w-5 h-5" />,
      connected: false,
      configurable: true,
    },
  ]);

  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = async (id: string) => {
    setConnecting(id);
    // Simulate connection delay
    await new Promise(r => setTimeout(r, 1500));
    setIntegrations(prev =>
      prev.map(i => i.id === id ? { ...i, connected: !i.connected } : i)
    );
    setConnecting(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Entegrasyonlar</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Uygulamanızı diğer servislerle bağlayın
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  integration.connected
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {integration.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{integration.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{integration.description}</p>
                </div>
              </div>
              {integration.connected && (
                <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                  <Check className="w-3 h-3" />
                  Bağlı
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleConnect(integration.id)}
                disabled={connecting === integration.id}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  integration.connected
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {connecting === integration.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : integration.connected ? (
                  <Unlink className="w-4 h-4" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                {connecting === integration.id ? 'Bağlanıyor...' : integration.connected ? 'Bağlantıyı Kes' : 'Bağlan'}
              </button>

              {integration.configurable && integration.connected && (
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] border border-slate-800 transition-all">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Ayarlar
                </button>
              )}

              {integration.docsUrl && (
                <a
                  href={integration.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Yakında Gelecek</h2>
        <p className="text-sm text-slate-400">
          Aşağıdaki entegrasyonlar üzerinde çalışıyoruz:
        </p>
        <ul className="mt-3 space-y-2 text-sm text-slate-500">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            Slack — Bildirimler ve raporlar
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            Shopify — E-ticaret sipariş takibi
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            Zapier — 5000+ uygulama ile entegrasyon
          </li>
        </ul>
      </div>
    </div>
  );
}
