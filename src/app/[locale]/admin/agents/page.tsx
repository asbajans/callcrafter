'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Bot, ShieldAlert } from 'lucide-react';

interface Agent {
  id: number;
  name: string;
  description?: string | null;
  language?: string | null;
  model?: string | null;
  status?: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-gray-100 text-gray-600',
  testing: 'bg-amber-100 text-amber-700',
};

export default function AdminAgentsPage() {
  const t = useTranslations();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/agents?limit=100&sort=-createdAt&depth=0');
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      setAgents(data.docs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents() }, [fetchAgents]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('admin.agents')}</h1>
          <p className="text-slate-500 mt-1">Tüm AI asistanlarını yönetin</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200">
          <Bot className="w-4 h-4" />
          {agents.length} toplam
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Asistan Adı</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Dil</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Model</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Durum</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Oluşturulma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-6 py-3"><span className="inline-block w-20 h-4 bg-slate-200 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : agents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-900">{agent.name}</td>
                    <td className="px-6 py-3 text-slate-600">{agent.language || '—'}</td>
                    <td className="px-6 py-3 text-slate-600 text-xs font-mono">{agent.model || '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[agent.status || 'inactive'] || 'bg-gray-100 text-gray-600'}`}>
                        {agent.status || 'inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-xs">
                      {new Date(agent.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
