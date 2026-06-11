'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Server, Plus, X, Check, AlertCircle } from 'lucide-react';

interface AdminProviderConfig {
  id: number;
  name: string;
  provider: 'twilio' | 'zadarma' | 'asterisk';
  type?: 'ours' | 'own' | null;
  isActive?: boolean | null;
  lastHealthCheck?: string | null;
  createdAt: string;
}

const providerColors: Record<string, string> = {
  twilio: 'bg-red-100 text-red-700',
  zadarma: 'bg-green-100 text-green-700',
  asterisk: 'bg-purple-100 text-purple-700',
};

export default function AdminProvidersPage() {
  const t = useTranslations();
  const [providers, setProviders] = useState<AdminProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formProvider, setFormProvider] = useState<'twilio' | 'zadarma' | 'asterisk'>('twilio');
  const [formType, setFormType] = useState<'ours' | 'own'>('ours');
  const [formConfig, setFormConfig] = useState('{\n  \n}');

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/provider-configs?limit=100&sort=-createdAt');
      if (!res.ok) throw new Error('Failed to fetch provider configs');
      const data = await res.json();
      setProviders(data.docs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  function resetForm() {
    setFormName('');
    setFormProvider('twilio');
    setFormType('ours');
    setFormConfig('{\n  \n}');
  }

  async function handleCreate() {
    setSaving(true);
    try {
      let parsedConfig: Record<string, unknown> = {};
      try {
        parsedConfig = JSON.parse(formConfig);
      } catch {
        throw new Error('Invalid JSON in config field');
      }

      const res = await fetch('/api/provider-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          provider: formProvider,
          type: formType,
          config: parsedConfig,
          tenant: 1,
        }),
      });
      if (!res.ok) throw new Error('Failed to create provider config');
      setShowCreate(false);
      resetForm();
      await fetchProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create provider config');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(provider: AdminProviderConfig) {
    try {
      const res = await fetch(`/api/provider-configs/${provider.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !provider.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update provider');
      await fetchProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update provider');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('admin.providers')}</h1>
          <p className="text-slate-500 mt-1">Manage service provider configurations</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Provider
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Provider</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Last Health Check</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-6 py-3">
                        <span className="inline-block w-16 h-4 bg-slate-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : providers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                providers.map((provider) => (
                  <tr key={provider.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-900">{provider.name}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${providerColors[provider.provider] || 'bg-gray-100 text-gray-700'}`}>
                        {provider.provider}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                        {provider.type || 'ours'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          provider.isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {provider.isActive ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {provider.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-xs">
                      {provider.lastHealthCheck
                        ? new Date(provider.lastHealthCheck).toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => toggleActive(provider)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          provider.isActive
                            ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                            : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={provider.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {provider.isActive ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Create Provider Config</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="My Provider"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
                <select
                  value={formProvider}
                  onChange={(e) => setFormProvider(e.target.value as 'twilio' | 'zadarma' | 'asterisk')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                >
                  <option value="twilio">Twilio</option>
                  <option value="zadarma">Zadarma</option>
                  <option value="asterisk">Asterisk</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="ours"
                      checked={formType === 'ours'}
                      onChange={() => setFormType('ours')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    Ours
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="own"
                      checked={formType === 'own'}
                      onChange={() => setFormType('own')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    Own
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Config (JSON)</label>
                <textarea
                  value={formConfig}
                  onChange={(e) => setFormConfig(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !formName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
