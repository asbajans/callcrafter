'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import {
  Phone,
  MessageCircle,
  Instagram,
  Globe,
  Mic,
  Bot,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';

type Agent = {
  id: string;
  name: string;
  voice?: string;
  channels?: string[];
  status: 'active' | 'inactive' | 'testing';
  updatedAt: string;
};

type PhoneNumber = {
  id: string;
  phoneNumber: string;
  status: string;
  updatedAt: string;
};

type SipTrunk = {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
};

type Conversation = {
  id: string;
  channel: 'voice' | 'sms' | 'instagram' | 'whatsapp';
  contact: string;
  agent?: { name: string };
  status: 'active' | 'completed' | 'missed' | 'failed';
  duration?: number;
  createdAt: string;
};

type DashboardStats = {
  agents: number;
  phoneNumbers: number;
  conversations: number;
  sipTrunks: number;
};

const channelIcons: Record<string, typeof Phone> = {
  voice: Phone,
  sms: MessageCircle,
  instagram: Instagram,
  whatsapp: Globe,
};

const channelColors: Record<string, string> = {
  voice: 'bg-indigo-500/20 text-indigo-400',
  sms: 'bg-emerald-500/20 text-emerald-400',
  instagram: 'bg-pink-500/20 text-pink-400',
  whatsapp: 'bg-green-500/20 text-green-400',
};

const statusConfig: Record<string, { icon: typeof CheckCircle; className: string; labelKey: string }> = {
  active: { icon: CheckCircle, className: 'text-emerald-400 bg-emerald-500/20', labelKey: 'agent.active' },
  completed: { icon: CheckCircle, className: 'text-emerald-400 bg-emerald-500/20', labelKey: 'agent.active' },
  missed: { icon: XCircle, className: 'text-red-400 bg-red-500/20', labelKey: 'common.error' },
  failed: { icon: AlertCircle, className: 'text-amber-400 bg-amber-500/20', labelKey: 'common.error' },
  inactive: { icon: XCircle, className: 'text-slate-400 bg-white/[0.05]', labelKey: 'agent.inactive' },
  testing: { icon: Activity, className: 'text-amber-400 bg-amber-500/20', labelKey: 'agent.testing' },
};

const agentStatusColors: Record<string, string> = {
  active: 'bg-emerald-400',
  inactive: 'bg-slate-600',
  testing: 'bg-amber-400',
};

function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'şimdi';
  if (mins < 60) return `${mins}dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}s`;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function StatCardSkeleton() {
  return (
    <div className="bg-white/[0.04] rounded-2xl p-6 border border-white/[0.08] animate-pulse">
      <div className="flex items-center justify-between mb-5">
        <div className="w-11 h-11 bg-white/[0.08] rounded-xl" />
        <div className="w-8 h-4 bg-white/[0.08] rounded" />
      </div>
      <div className="h-7 w-16 bg-white/[0.08] rounded mb-2" />
      <div className="h-4 w-24 bg-white/[0.06] rounded" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="px-5 py-4 flex items-center gap-4 border-b border-white/[0.05] animate-pulse">
      <div className="w-9 h-9 bg-white/[0.08] rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-32 bg-white/[0.08] rounded" />
        <div className="h-3 w-20 bg-white/[0.05] rounded" />
      </div>
      <div className="h-5 w-16 bg-white/[0.06] rounded-full" />
      <div className="h-3 w-10 bg-white/[0.05] rounded" />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-white/[0.08] rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-64 bg-white/[0.05] rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 bg-white/[0.04] rounded-2xl border border-white/[0.08] overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
        </div>
        <div className="xl:col-span-2 bg-white/[0.04] rounded-2xl border border-white/[0.08] overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-200 mb-1">Bir sorun oluştu</h3>
      <p className="text-sm text-slate-500 mb-5 max-w-sm">{message}</p>
      <button
        onClick={onRetry}
        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
      >
        Tekrar Dene
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    agents: 0,
    phoneNumbers: 0,
    conversations: 0,
    sipTrunks: 0,
  });
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [agentsRes, phoneRes, convRes, trunkRes] = await Promise.all([
        api.getAgents().catch(() => ({ docs: [], totalDocs: 0 })),
        api.getPhoneNumbers().catch(() => ({ docs: [], totalDocs: 0 })),
        api.getConversations({ limit: 8 }).catch(() => ({ docs: [], totalDocs: 0 })),
        api.getSipTrunks().catch(() => ({ docs: [], totalDocs: 0 })),
      ]);

      const activeAgents = (agentsRes.docs || []).filter(
        (a: Agent) => a.status === 'active'
      );
      const activePhoneNumbers = (phoneRes.docs || []).filter(
        (p: PhoneNumber) => p.status === 'active'
      );
      const activeSipTrunks = (trunkRes.docs || []).filter(
        (t: SipTrunk) => t.status === 'active'
      );

      setStats({
        agents: activeAgents.length,
        phoneNumbers: activePhoneNumbers.length,
        conversations: convRes.totalDocs || 0,
        sipTrunks: activeSipTrunks.length,
      });

      setRecentConversations(convRes.docs || []);
      setAgents(agentsRes.docs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  const statCards = [
    {
      key: 'agents',
      label: t('dashboard.agents'),
      value: stats.agents,
      icon: Bot,
      gradient: 'from-indigo-500 to-violet-600',
      glow: 'shadow-indigo-500/20',
      bg: 'bg-indigo-500/15',
      iconColor: 'text-indigo-400',
      trend: '+2',
    },
    {
      key: 'phone',
      label: t('dashboard.phone'),
      value: stats.phoneNumbers,
      icon: Phone,
      gradient: 'from-emerald-500 to-teal-600',
      glow: 'shadow-emerald-500/20',
      bg: 'bg-emerald-500/15',
      iconColor: 'text-emerald-400',
      trend: null,
    },
    {
      key: 'conversations',
      label: t('dashboard.conversations'),
      value: stats.conversations,
      icon: MessageCircle,
      gradient: 'from-amber-500 to-orange-600',
      glow: 'shadow-amber-500/20',
      bg: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
      trend: '+12%',
    },
    {
      key: 'trunk',
      label: t('dashboard.trunk'),
      value: stats.sipTrunks,
      icon: Globe,
      gradient: 'from-rose-500 to-pink-600',
      glow: 'shadow-rose-500/20',
      bg: 'bg-rose-500/15',
      iconColor: 'text-rose-400',
      trend: null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.overview')}</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Genel sistem durumunu ve son aktiviteleri buradan takip edebilirsiniz.
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-300 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl transition-colors"
        >
          <Activity className="w-4 h-4" />
          <span className="hidden sm:inline">Yenile</span>
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className="group relative bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.14] rounded-2xl p-5 transition-all duration-200 cursor-default overflow-hidden"
            >
              {/* Subtle gradient glow */}
              <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-br ${card.gradient} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />

              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-11 h-11 ${card.bg} rounded-xl flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${card.iconColor}`} />
                  </div>
                  {card.trend && (
                    <div className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                      <TrendingUp className="w-3 h-3" />
                      {card.trend}
                    </div>
                  )}
                </div>
                <p className="text-3xl font-bold text-white mb-1">{card.value}</p>
                <p className="text-sm text-slate-400">{card.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Recent conversations */}
        <div className="xl:col-span-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h2 className="font-semibold text-slate-200 flex items-center gap-2 text-sm">
              <MessageCircle className="w-4 h-4 text-slate-500" />
              Son Konuşmalar
            </h2>
            {recentConversations.length > 0 && (
              <span className="text-xs text-slate-500 bg-white/[0.06] px-2 py-0.5 rounded-full">
                {recentConversations.length} kayıt
              </span>
            )}
          </div>

          {recentConversations.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="w-12 h-12 bg-white/[0.05] rounded-2xl flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-sm text-slate-500">{t('common.noData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Kanal</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Kişi</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider hidden md:table-cell">Ajan</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Durum</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider hidden sm:table-cell">Süre</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Zaman</th>
                  </tr>
                </thead>
                <tbody>
                  {recentConversations.map((conv) => {
                    const ChannelIcon = channelIcons[conv.channel] || Phone;
                    const config = statusConfig[conv.status] || statusConfig.completed;
                    const StatusIcon = config.icon;
                    return (
                      <tr key={conv.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                        <td className="px-5 py-3.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${channelColors[conv.channel] || 'bg-white/[0.08] text-slate-400'}`}>
                            <ChannelIcon className="w-4 h-4" />
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm font-medium text-slate-200">{conv.contact}</span>
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell">
                          <span className="text-sm text-slate-500">{conv.agent?.name || '—'}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
                            <StatusIcon className="w-3 h-3" />
                            {t(statusConfig[conv.status]?.labelKey || 'common.error')}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                          <span className="text-sm text-slate-500 font-mono">{formatDuration(conv.duration)}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-xs text-slate-600">{formatTime(conv.createdAt)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Agents list */}
        <div className="xl:col-span-2 bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h2 className="font-semibold text-slate-200 flex items-center gap-2 text-sm">
              <Bot className="w-4 h-4 text-slate-500" />
              Ajanlar
            </h2>
            <span className="text-xs text-slate-500 bg-white/[0.06] px-2 py-0.5 rounded-full">
              {agents.length} toplam
            </span>
          </div>

          {agents.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="w-12 h-12 bg-white/[0.05] rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Bot className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-sm text-slate-500">{t('common.noData')}</p>
            </div>
          ) : (
            <div>
              {agents.map((agent, i) => (
                <div
                  key={agent.id}
                  className={`px-5 py-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors ${i < agents.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 bg-white/[0.07] rounded-xl flex items-center justify-center">
                        <Bot className="w-4 h-4 text-slate-400" />
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${agentStatusColors[agent.status] || 'bg-slate-600'}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{agent.name}</p>
                      <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5 truncate">
                        <Mic className="w-3 h-3 shrink-0" />
                        {agent.voice || 'Varsayılan'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ml-2 ${
                      agent.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : agent.status === 'testing'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-white/[0.06] text-slate-500'
                    }`}
                  >
                    {t(statusConfig[agent.status]?.labelKey || 'common.error')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* See all link */}
          {agents.length > 0 && (
            <div className="px-5 py-3 border-t border-white/[0.06]">
              <a href="agents" className="flex items-center justify-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                Tümünü gör
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
