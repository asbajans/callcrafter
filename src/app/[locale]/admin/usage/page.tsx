'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Activity, AlertCircle, Filter, Download, BarChart3, PieChart } from 'lucide-react';

interface UsageDoc {
  id: number;
  tenant?: { id: number; name?: string } | number;
  conversation?: string | null;
  channel: string;
  service: string;
  provider: string;
  model?: string | null;
  duration?: number | null;
  tokens?: number | null;
  characters?: number | null;
  audioSeconds?: number | null;
  creditsUsed: number;
  createdAt: string;
}

interface Totals {
  totalCredits: number;
  byService: Record<string, number>;
  byChannel: Record<string, number>;
  byTenant: Record<string, number>;
}

export default function UsagePage() {
  const t = useTranslations();
  const [logs, setLogs] = useState<UsageDoc[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [filterChannel, setFilterChannel] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterTenantId, setFilterTenantId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = useCallback(async (p: number) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(p), limit: '50' });
      if (filterChannel) params.set('channel', filterChannel);
      if (filterService) params.set('service', filterService);
      if (filterTenantId) params.set('tenantId', filterTenantId);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/admin/usage?${params}`);
      if (!res.ok) throw new Error('Failed to fetch usage logs');
      const data = await res.json();
      setLogs(data.docs || []);
      setTotals(data.totals || null);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  }, [filterChannel, filterService, filterTenantId, startDate, endDate]);

  useEffect(() => { fetchLogs(page) }, [page, fetchLogs]);

  async function exportCsv() {
    const params = new URLSearchParams({ format: 'csv', limit: '10000' });
    if (filterChannel) params.set('channel', filterChannel);
    if (filterService) params.set('service', filterService);
    if (filterTenantId) params.set('tenantId', filterTenantId);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const res = await fetch(`/api/admin/usage?${params}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usage-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const channelColors: Record<string, string> = {
    voice: 'bg-purple-100 text-purple-700',
    whatsapp: 'bg-green-100 text-green-700',
    instagram: 'bg-pink-100 text-pink-700',
    web: 'bg-blue-100 text-blue-700',
  };

  const serviceColors: Record<string, string> = {
    stt: 'bg-amber-100 text-amber-700',
    tts: 'bg-indigo-100 text-indigo-700',
    llm: 'bg-rose-100 text-rose-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usage Reports</h1>
          <p className="text-slate-500 mt-1">Monitor AI service usage and credit consumption</p>
        </div>
        <button
          onClick={exportCsv}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Channel</label>
            <select
              value={filterChannel}
              onChange={(e) => { setFilterChannel(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            >
              <option value="">All</option>
              <option value="voice">Voice</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="web">Web Chat</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Service</label>
            <select
              value={filterService}
              onChange={(e) => { setFilterService(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            >
              <option value="">All</option>
              <option value="stt">STT</option>
              <option value="tts">TTS</option>
              <option value="llm">LLM</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tenant ID</label>
            <input
              type="text"
              value={filterTenantId}
              onChange={(e) => { setFilterTenantId(e.target.value); setPage(1); }}
              placeholder="Tenant ID"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {totals && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <BarChart3 className="w-4 h-4" />
              By Channel
            </div>
            <div className="space-y-1.5">
              {Object.entries(totals.byChannel).length === 0 && (
                <p className="text-xs text-slate-400">No data</p>
              )}
              {Object.entries(totals.byChannel).map(([ch, val]) => (
                <div key={ch} className="flex items-center justify-between text-sm">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${channelColors[ch] || 'bg-gray-100 text-gray-700'}`}>
                    {ch}
                  </span>
                  <span className="font-medium text-slate-700">{val.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <PieChart className="w-4 h-4" />
              By Service
            </div>
            <div className="space-y-1.5">
              {Object.entries(totals.byService).length === 0 && (
                <p className="text-xs text-slate-400">No data</p>
              )}
              {Object.entries(totals.byService).map(([svc, val]) => (
                <div key={svc} className="flex items-center justify-between text-sm">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${serviceColors[svc] || 'bg-gray-100 text-gray-700'}`}>
                    {svc}
                  </span>
                  <span className="font-medium text-slate-700">{val.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <Activity className="w-4 h-4" />
              Total Credits Used
            </div>
            <p className="text-3xl font-bold text-slate-900">
              {totals.totalCredits.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Tenant</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Channel</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Service</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Provider</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Model</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Duration</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Credits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-6 py-3">
                        <span className="inline-block w-16 h-4 bg-slate-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No usage data found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 text-xs text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-slate-700 text-xs font-medium">
                      {typeof log.tenant === 'object' ? log.tenant?.name || `#${log.tenant?.id}` : `#${log.tenant}`}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${channelColors[log.channel] || 'bg-gray-100 text-gray-700'}`}>
                        {log.channel}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${serviceColors[log.service] || 'bg-gray-100 text-gray-700'}`}>
                        {log.service}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600 text-xs">{log.provider}</td>
                    <td className="px-6 py-3 text-slate-500 text-xs">{log.model || '-'}</td>
                    <td className="px-6 py-3 text-right text-slate-500 text-xs">
                      {log.duration ? `${log.duration}s` : '-'}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-slate-700">
                      {(log.creditsUsed ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200">
            <span className="text-xs text-slate-400">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
