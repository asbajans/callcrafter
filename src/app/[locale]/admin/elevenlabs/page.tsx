'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Bot,
  ShieldAlert,
  Loader2,
  Check,
  X,
  RefreshCw,
  Trash2,
  Volume2,
  Activity,
  CreditCard,
  Circle,
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

interface ElevenLabsUserInfo {
  subscription?: {
    tier?: string;
    character_count?: number;
    character_limit?: number;
    status?: string;
    next_character_count?: number;
  };
  user?: {
    name?: string;
    email?: string;
  };
}

const getVoiceName = (voiceId: string, voices: ElevenLabsVoice[]): string => {
  const found = voices.find(v => v.voice_id === voiceId)
  return found?.name || voiceId
}

const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export default function AdminElevenLabsPage() {
  const [agents, setAgents] = useState<AgentSyncStatus[]>([]);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [userInfo, setUserInfo] = useState<ElevenLabsUserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [userInfoError, setUserInfoError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [showVoices, setShowVoices] = useState(false);
  const [apiErrors, setApiErrors] = useState<{ time: string; message: string }[]>([]);

  const addApiError = useCallback((message: string) => {
    setApiErrors(prev => [{ time: new Date().toLocaleTimeString('tr-TR'), message }, ...prev].slice(0, 10))
  }, [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [agentsRes, voicesRes, userRes] = await Promise.all([
        fetch('/api/admin/elevenlabs'),
        fetch('/api/admin/elevenlabs?action=voices'),
        fetch('/api/admin/elevenlabs?action=user-info'),
      ]);
      if (!agentsRes.ok) throw new Error('Failed to fetch agents');
      const agentsData = await agentsRes.json();
      const voicesData = voicesRes.ok ? await voicesRes.json() : { voices: [] };
      const userData = userRes.ok ? await userRes.json() : null;

      setAgents(agentsData.agents || []);
      setVoices(voicesData.voices || []);

      if (userData?.userInfo) {
        setUserInfo(userData.userInfo);
        setUserInfoError(null);
      } else if (userData?.error) {
        setUserInfoError(userData.error);
        addApiError(userData.error);
      }

      if (voicesData.error) {
        setVoicesError(voicesData.error);
        addApiError(voicesData.error);
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
  }, [addApiError]);

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
      if (!res.ok) {
        addApiError(data.error || 'Sync failed');
        throw new Error(data.error || 'Sync failed');
      }
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
      if (!res.ok) {
        addApiError(data.error || 'Delete failed');
        throw new Error(data.error || 'Delete failed');
      }
      toast.success('ElevenLabs agent silindi');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSyncingId(null);
    }
  };

  const subscription = userInfo?.subscription;
  const isApiConnected = !userInfoError && userInfo !== null;
  const characterUsage = subscription ? ((subscription.character_count || 0) / (subscription.character_limit || 1)) * 100 : 0;

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

      {/* Account Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Connection Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">API Bağlantısı</span>
          </div>
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : isApiConnected ? (
              <>
                <Circle className="w-3 h-3 fill-emerald-500 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-700">Bağlı</span>
              </>
            ) : (
              <>
                <Circle className="w-3 h-3 fill-red-500 text-red-500" />
                <span className="text-sm font-medium text-red-700">Bağlantı Hatası</span>
              </>
            )}
          </div>
          {userInfoError && (
            <p className="mt-2 text-xs text-red-500 truncate" title={userInfoError}>{userInfoError}</p>
          )}
        </div>

        {/* Subscription / Credits */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Kullanım</span>
          </div>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : subscription ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Karakter</span>
                <span className="font-medium text-slate-900">
                  {formatNumber(subscription.character_count || 0)} / {formatNumber(subscription.character_limit || 0)}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    characterUsage > 80 ? 'bg-red-500' : characterUsage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(characterUsage, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Plan: {subscription.tier || '-'}</span>
                <span>Durum: {subscription.status || '-'}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Kullanım bilgisi alınamadı</p>
          )}
        </div>

        {/* Error Log */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Son Hatalar</span>
          </div>
          {apiErrors.length === 0 ? (
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-sm text-slate-400">Son 10 hatada sorun yok</span>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[100px] overflow-y-auto">
              {apiErrors.map((e, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  <X className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-red-600 truncate" title={e.message}>{e.message}</span>
                  <span className="text-slate-400 shrink-0 ml-auto">{e.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Agents Table */}
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

      {/* Available Voices */}
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