'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Cpu, Plus, AlertCircle, X, Check, Eye, EyeOff } from 'lucide-react';

interface AiProvider {
  id: number;
  name: string;
  provider: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  models?: string[] | null;
  defaultModel?: string | null;
  creditCostPerToken?: number | null;
  creditCostPerChar?: number | null;
  creditCostPerSecond?: number | null;
  isActive?: boolean | null;
}

const providerTypes = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'ollama', label: 'Ollama (External)' },
  { value: 'custom', label: 'Custom OpenAI-compatible' },
];

export default function AiProvidersPage() {
  const t = useTranslations();
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showKey, setShowKey] = useState<Record<number, boolean>>({});

  const [formName, setFormName] = useState('');
  const [formProvider, setFormProvider] = useState('openai');
  const [formApiKey, setFormApiKey] = useState('');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formModels, setFormModels] = useState('');
  const [formDefaultModel, setFormDefaultModel] = useState('');
  const [formCostPerToken, setFormCostPerToken] = useState('0.00001');
  const [formCostPerChar, setFormCostPerChar] = useState('0.001');
  const [formCostPerSecond, setFormCostPerSecond] = useState('0.01');

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/ai-providers?limit=100&sort=-createdAt');
      if (!res.ok) throw new Error('Failed to fetch AI providers');
      const data = await res.json();
      setProviders(data.docs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProviders() }, [fetchProviders]);

  function resetForm() {
    setFormName('');
    setFormProvider('openai');
    setFormApiKey('');
    setFormBaseUrl('');
    setFormModels('');
    setFormDefaultModel('');
    setFormCostPerToken('0.00001');
    setFormCostPerChar('0.001');
    setFormCostPerSecond('0.01');
    setEditingId(null);
  }

  function openEdit(p: AiProvider) {
    setFormName(p.name);
    setFormProvider(p.provider);
    setFormApiKey(p.apiKey || '');
    setFormBaseUrl(p.baseUrl || '');
    setFormModels((p.models || []).join(', '));
    setFormDefaultModel(p.defaultModel || '');
    setFormCostPerToken(String(p.creditCostPerToken ?? 0.00001));
    setFormCostPerChar(String(p.creditCostPerChar ?? 0.001));
    setFormCostPerSecond(String(p.creditCostPerSecond ?? 0.01));
    setEditingId(p.id);
    setShowCreate(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formApiKey.trim()) return;
    setSaving(true);
    try {
      const body: any = {
        name: formName,
        provider: formProvider,
        apiKey: formApiKey,
        baseUrl: formBaseUrl || undefined,
        models: formModels.split(',').map((m: string) => m.trim()).filter(Boolean),
        defaultModel: formDefaultModel || undefined,
        creditCostPerToken: parseFloat(formCostPerToken) || 0.00001,
        creditCostPerChar: parseFloat(formCostPerChar) || 0.001,
        creditCostPerSecond: parseFloat(formCostPerSecond) || 0.01,
      };

      const res = editingId
        ? await fetch(`/api/ai-providers/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/ai-providers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, isActive: true }),
          });

      if (!res.ok) throw new Error('Failed to save');
      setShowCreate(false);
      resetForm();
      await fetchProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: AiProvider) {
    try {
      const res = await fetch(`/api/ai-providers/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await fetchProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  const providerBadge = (type: string) => {
    const colors: Record<string, string> = {
      openai: 'bg-green-100 text-green-700',
      anthropic: 'bg-orange-100 text-orange-700',
      gemini: 'bg-blue-100 text-blue-700',
      openrouter: 'bg-purple-100 text-purple-700',
      ollama: 'bg-yellow-100 text-yellow-700',
      custom: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[type] || 'bg-gray-100 text-gray-700'}`}>
        {type}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Providers</h1>
          <p className="text-slate-500 mt-1">Manage LLM provider configurations and credit costs</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Provider
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
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Models</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Default Model</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Cost/Token</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Cost/Sec</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-6 py-3">
                        <span className="inline-block w-16 h-4 bg-slate-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : providers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No AI providers configured yet
                  </td>
                </tr>
              ) : (
                providers.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-900">{p.name}</td>
                    <td className="px-6 py-3">{providerBadge(p.provider)}</td>
                    <td className="px-6 py-3 text-slate-500 text-xs max-w-[200px] truncate">
                      {(p.models || []).join(', ')}
                    </td>
                    <td className="px-6 py-3 text-slate-700 text-xs">{p.defaultModel || '-'}</td>
                    <td className="px-6 py-3 text-right text-slate-500 text-xs">
                      {(p.creditCostPerToken ?? 0.00001).toFixed(6)}
                    </td>
                    <td className="px-6 py-3 text-right text-slate-500 text-xs">
                      {(p.creditCostPerSecond ?? 0.01).toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => toggleActive(p)}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {p.isActive ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {p.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h3 className="font-semibold text-slate-900">
                {editingId ? 'Edit AI Provider' : 'Add AI Provider'}
              </h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="OpenAI Prod"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Provider Type</label>
                  <select
                    value={formProvider}
                    onChange={(e) => setFormProvider(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  >
                    {providerTypes.map(pt => (
                      <option key={pt.value} value={pt.value}>{pt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
                <div className="relative">
                  <input
                    type={showKey[editingId ?? 0] ? 'text' : 'password'}
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono pr-9 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(prev => ({ ...prev, [editingId ?? 0]: !prev[editingId ?? 0] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showKey[editingId ?? 0] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {formProvider === 'custom' || formProvider === 'ollama' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Base URL</label>
                  <input
                    type="text"
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    placeholder={formProvider === 'ollama' ? 'http://host.docker.internal:11434/v1' : 'https://...'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Models (comma-separated)</label>
                  <input
                    type="text"
                    value={formModels}
                    onChange={(e) => setFormModels(e.target.value)}
                    placeholder="gpt-4o, gpt-4o-mini"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Default Model</label>
                  <input
                    type="text"
                    value={formDefaultModel}
                    onChange={(e) => setFormDefaultModel(e.target.value)}
                    placeholder="gpt-4o"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs font-medium text-slate-500 mb-3">Credit Cost Configuration</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Cost / Token</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formCostPerToken}
                      onChange={(e) => setFormCostPerToken(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Cost / Char</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={formCostPerChar}
                      onChange={(e) => setFormCostPerChar(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Cost / Sec</label>
                    <input
                      type="number"
                      step="0.001"
                      value={formCostPerSecond}
                      onChange={(e) => setFormCostPerSecond(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim() || !formApiKey.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
