'use client';

import { useState } from 'react';
import WhatsAppConversationsPage from './conversations/page';
import WhatsAppAccountsPage from './accounts/page';
import { MessageCircle, Settings2 } from 'lucide-react';

type Tab = 'inbox' | 'accounts';

export default function WhatsAppPage() {
  const [tab, setTab] = useState<Tab>('inbox');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">WhatsApp</h1>
        <p className="text-slate-400 mt-1 text-sm">
          WhatsApp konuşmalarını yönetin ve hesap ayarlarını yapılandırın.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('inbox')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            tab === 'inbox'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          Inbox
        </button>
        <button
          onClick={() => setTab('accounts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            tab === 'accounts'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          Hesaplar
        </button>
      </div>

      {tab === 'inbox' ? <WhatsAppConversationsPage /> : <WhatsAppAccountsPage />}
    </div>
  );
}
