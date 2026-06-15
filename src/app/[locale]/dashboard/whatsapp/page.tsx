'use client';

import { useState } from 'react';
import WhatsAppConversationsPage from './conversations/page';
import WhatsAppAccountsPage from './accounts/page';

type Tab = 'inbox' | 'accounts';

export default function WhatsAppPage() {
  const [tab, setTab] = useState<Tab>('inbox');

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200">
        <div className="flex gap-4">
          <button
            onClick={() => setTab('inbox')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'inbox' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Inbox
          </button>
          <button
            onClick={() => setTab('accounts')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'accounts' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Accounts
          </button>
        </div>
      </div>

      {tab === 'inbox' ? <WhatsAppConversationsPage /> : <WhatsAppAccountsPage />}
    </div>
  );
}
