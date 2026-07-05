'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bot,
  ShieldAlert,
  Loader2,
  Check,
  X,
  RefreshCw,
  Trash2,
  Phone,
  Volume2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

interface AgentSyncStatus {
  id: number;
  name: string;
  language: string;
  voiceEngine: string;
  voiceTemplate: string;
  elevenlabsAgentId: string | null;
  elevenlabsAgentName: string | null;
  elevenlabsVoice: string | null;
  elevenlabsPhoneNumberId: string | null;
  status: string;
  createdAt: string;
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
}

const getVoiceName = (voiceId: string, voices: ElevenLabsVoice[]): string => {
  const found = voices.find(v => v.voice_id === voiceId)
  return found?.name || voiceId
}

export default function AdminElevenLabsPage() {
  const t = useTranslations();
  const [agents, setAgents] = useState<AgentSyncStatus[]>([]);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [showVoices, setShowVoices] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [agentsRes, voicesRes] = await Promise.all([
        fetch('/api/admin/elevenlabs'),
        fetch('/api/admin/elevenlabs?action=voices'),
      ]);
      if (!agentsRes.ok) throw new Error('Failed to fetch agents');
      const agentsData = await agentsRes.json();
      const voicesData = voicesRes.ok ? await voicesRes.json() : { voices: [] };
      setAgents(agentsData.agents || []);
      setVoices(voicesData.voices || []);
      if (voicesData.error) {
        setVoicesError(voicesData.error);
      } else if (voicesData.voices?.length === 0) {
        setVoicesError('ElevenLabs ses listesi alınamadı. API anahtarı eksik veya geçersiz olabilir.');
      } else {
        setVoicesError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData() }, [fetchData]);

  const handleSync = async (agentId: number) => {
    setSyncingId(agentId);
    try {
      const res = await fetch('/api/admin/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'sync', agentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      toast.success(`Agent ${data.action === 'created' ? 'oluşturuldu' : 'güncellendi'}: ${data.agentId}`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (agentId: number) => {
    if (!confirm('ElevenLabs agentını silmek istediğinize emin misiniz?')) return;
    setSyncingId(agentId);
    try {
      const res = await fetch('/api/admin/elevenlabs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ agentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast.success('ElevenLabs agent silindi');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSyncingId(null);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-700',
      inactive: 'bg-gray-100 text-gray-600',
      testing: 'bg-amber-100 text-amber-700',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  };

  const syncedCount = agents.filter(a => a.elevenlabsAgentId).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ElevenLabs Yapılandırması</h1>
          <p className="text-slate-500 mt-1">AI asistanlarını ElevenLabs Conversational AI ile senkronize edin</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200">
          <Bot className="w-4 h-4" />
          {syncedCount}/{agents.length} senkronize
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
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Asistan</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Seçili Ses</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Dil</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">ElevenLBS ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Durum</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-6 py-3"><span className="inline-block w-20 h-4 bg-slate-200 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : agents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Henüz asistan bulunmuyor
                  </td>
                </tr>
              ) : (
                agents.map((agent) => {
                  const isSynced = !!agent.elevenlabsAgentId;
                  const isSaving = syncingId === agent.id;
                  return (
                    <tr key={agent.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{agent.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5">
                          <Volume2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-sm text-slate-600">{getVoiceName(agent.elevenlabsVoice || agent.voiceTemplate, voices)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{agent.language}</span>
                      </td>
                      <td className="px-6 py-3">
                        {isSynced ? (
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-xs font-mono text-slate-500 truncate max-w-[140px] block">{agent.elevenlabsAgentId}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Senkronize değil</span>
                        )}
                      </td>
                      <td className="px-6 py-3">{statusBadge(agent.status)}</td>
                      <td className="px-6 py-3 text-right">
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-500 ml-auto" />
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleSync(agent.id)}
                              className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                              title={isSynced ? 'ElevenLabs agent güncelle' : 'ElevenLabs agent oluştur'}
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            {isSynced && (
                              <button
                                onClick={() => handleDelete(agent.id)}
                                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                title="ElevenLabs agent sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <button
          onClick={() => setShowVoices(!showVoices)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-slate-500" />
            <span className="font-medium text-slate-900">Kullanılabilir ElevenLabs Sesleri</span>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{voices.length} ses</span>
          </div>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${showVoices ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showVoices && (
          <div className="border-t border-slate-100 px-6 py-4">
            {voices.length === 0 ? (
              <p className="text-sm text-slate-400">Ses listesi alınamadı veya ElevenLabs API bağlantısı yok.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {voices.map((v) => (
                  <div key={v.voice_id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 text-sm">
                    <Volume2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-700 truncate">{v.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{v.voice_id}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {voicesError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          {voicesError}
        </div>
      )}
    </div>
  );
}
