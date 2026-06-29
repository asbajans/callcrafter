'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Bot, ShieldAlert, Check, X, Loader2, Play, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import AgentTestModal from './AgentTestModal';

interface ProviderModel {
  name: string;
  modelId: string;
  creditCost: number;
}

interface Provider {
  id: number;
  name: string;
  providerType?: string;
  models?: ProviderModel[] | null;
}

interface Agent {
  id: number;
  name: string;
  description?: string | null;
  language?: string | null;
  model?: string | null;
  voice?: string | null;
  provider?: Provider | number | null;
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
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [testAgent, setTestAgent] = useState<Agent | null>(null);
  const [testDefaultTab, setTestDefaultTab] = useState<'text' | 'voice'>('text');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [agentsRes, provRes] = await Promise.all([
        fetch('/api/agents?limit=100&sort=-createdAt&depth=1'),
        fetch('/api/ai-providers?limit=100&depth=2'),
      ]);
      if (!agentsRes.ok) throw new Error('Failed to fetch agents');
      const agentsData = await agentsRes.json();
      const provData = provRes.ok ? (await provRes.json()).docs || [] : [];
      setAgents(agentsData.docs || []);
      setProviders(provData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData() }, [fetchData]);

  const changeProvider = async (agentId: number, providerId: number | null) => {
    setSavingId(agentId);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider: providerId }),
      });
      if (!res.ok) throw new Error('Failed to update provider');
      setAgents(prev => prev.map(a =>
        a.id === agentId
          ? { ...a, provider: providers.find(p => p.id === providerId) || null, model: '' }
          : a
      ));
      toast.success('Provider güncellendi');
    } catch {
      toast.error('Provider güncellenirken hata oluştu');
    } finally {
      setSavingId(null);
    }
  };

  const getProviderName = (agent: Agent): string => {
    if (!agent.provider) return '—';
    if (typeof agent.provider === 'object' && agent.provider !== null) {
      return (agent.provider as Provider).name;
    }
    const found = providers.find(p => p.id === agent.provider);
    return found?.name || `ID: ${agent.provider}`;
  };

  const getProviderId = (agent: Agent): number | null => {
    if (!agent.provider) return null;
    if (typeof agent.provider === 'object' && agent.provider !== null) {
      return (agent.provider as Provider).id;
    }
    return agent.provider as number;
  };

  const getProviderModels = (agent: Agent): ProviderModel[] => {
    const pid = getProviderId(agent);
    if (!pid) return [];
    const provider = providers.find(p => p.id === pid);
    if (!provider?.models) return [];
    return provider.models.map((m: any) => {
      if (typeof m === 'string') return { name: m, modelId: m, creditCost: 1 };
      return m as ProviderModel;
    });
  };

  const changeModel = async (agentId: number, model: string) => {
    setSavingId(agentId);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ model: model || 'gpt-4o' }),
      });
      if (!res.ok) throw new Error('Failed to update model');
      setAgents(prev => prev.map(a =>
        a.id === agentId ? { ...a, model: model || 'gpt-4o' } : a
      ));
      toast.success('Model güncellendi');
    } catch {
      toast.error('Model güncellenirken hata oluştu');
    } finally {
      setSavingId(null);
    }
  };

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
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Provider</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Model</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Durum</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase">Test</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Oluşturulma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-6 py-3"><span className="inline-block w-20 h-4 bg-slate-200 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : agents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-900">{agent.name}</td>
                    <td className="px-6 py-3 text-slate-600">{agent.language || '—'}</td>
                    <td className="px-6 py-3">
                      <InlineProviderSelect
                        currentId={getProviderId(agent)}
                        currentName={getProviderName(agent)}
                        providers={providers}
                        saving={savingId === agent.id}
                        onChange={(pid) => changeProvider(agent.id, pid)}
                      />
                    </td>
                    <td className="px-6 py-3">
                      <InlineModelSelect
                        currentModel={agent.model || ''}
                        models={getProviderModels(agent)}
                        saving={savingId === agent.id}
                        onChange={(m) => changeModel(agent.id, m)}
                      />
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[agent.status || 'inactive'] || 'bg-gray-100 text-gray-600'}`}>
                        {agent.status || 'inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => { setTestDefaultTab('text'); setTestAgent(agent); }}
                          className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                          title="Yazılı Test"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setTestDefaultTab('voice'); setTestAgent(agent); }}
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                          title="Sesli Test"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      </div>
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

      {testAgent && (
        <AgentTestModal
          agent={testAgent}
          defaultTab={testDefaultTab}
          onClose={() => { setTestAgent(null); setTestDefaultTab('text'); }}
        />
      )}
    </div>
  );
}

function InlineProviderSelect({
  currentId,
  currentName,
  providers,
  saving,
  onChange,
}: {
  currentId: number | null;
  currentName: string;
  providers: Provider[];
  saving: boolean;
  onChange: (providerId: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentId ?? 0);

  if (saving) {
    return <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />;
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setValue(currentId ?? 0); setEditing(true); }}
        className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer"
      >
        {currentName}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <select
        value={value}
        onChange={(e) => setValue(parseInt(e.target.value) || 0)}
        className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white"
        autoFocus
      >
        <option value={0}>— Yok —</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button
        onClick={() => { onChange(value || null); setEditing(false); }}
        className="p-0.5 text-green-600 hover:text-green-800"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => setEditing(false)}
        className="p-0.5 text-red-500 hover:text-red-700"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function InlineModelSelect({
  currentModel,
  models,
  saving,
  onChange,
}: {
  currentModel: string;
  models: ProviderModel[];
  saving: boolean;
  onChange: (model: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentModel);

  if (saving) {
    return <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />;
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setValue(currentModel); setEditing(true); }}
        className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition-colors cursor-pointer"
      >
        {currentModel || '—'}
      </button>
    );
  }

  if (models.length > 0) {
    return (
      <div className="flex items-center gap-1">
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white font-mono"
          autoFocus
        >
          <option value="">— Seçin —</option>
          {models.map((m) => (
            <option key={m.modelId} value={m.modelId}>{m.name}</option>
          ))}
        </select>
        <button
          onClick={() => { onChange(value); setEditing(false); }}
          className="p-0.5 text-green-600 hover:text-green-800"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setEditing(false)}
          className="p-0.5 text-red-500 hover:text-red-700"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 min-w-[200px]">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="text-xs border border-slate-300 rounded px-1.5 py-0.5 bg-white font-mono w-full"
        placeholder="model-id (örn: gpt-4o)"
        autoFocus
      />
      <button
        onClick={() => { onChange(value); setEditing(false); }}
        className="p-0.5 text-green-600 hover:text-green-800 shrink-0"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => setEditing(false)}
        className="p-0.5 text-red-500 hover:text-red-700 shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
