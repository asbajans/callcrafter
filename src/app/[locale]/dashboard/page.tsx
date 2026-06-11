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
  voice: 'bg-indigo-100 text-indigo-600',
  sms: 'bg-emerald-100 text-emerald-600',
  instagram: 'bg-pink-100 text-pink-600',
  whatsapp: 'bg-green-100 text-green-600',
};

const statusConfig: Record<string, { icon: typeof CheckCircle; className: string; labelKey: string }> = {
  active: { icon: CheckCircle, className: 'text-emerald-500 bg-emerald-50', labelKey: 'agent.active' },
  completed: { icon: CheckCircle, className: 'text-emerald-500 bg-emerald-50', labelKey: 'agent.active' },
  missed: { icon: XCircle, className: 'text-red-500 bg-red-50', labelKey: 'common.error' },
  failed: { icon: AlertCircle, className: 'text-amber-500 bg-amber-50', labelKey: 'common.error' },
  inactive: { icon: XCircle, className: 'text-slate-400 bg-slate-50', labelKey: 'agent.inactive' },
  testing: { icon: Activity, className: 'text-amber-500 bg-amber-50', labelKey: 'agent.testing' },
};

const agentStatusColors: Record<string, string> = {
  active: 'bg-emerald-500',
  inactive: 'bg-slate-300',
  testing: 'bg-amber-500',
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
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString();
}

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 bg-slate-200 rounded-lg" />
        <div className="w-12 h-4 bg-slate-200 rounded" />
      </div>
      <div className="h-4 w-24 bg-slate-200 rounded" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 animate-pulse">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="h-5 w-32 bg-slate-200 rounded" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="px-6 py-4 flex items-center gap-4 border-b border-slate-50">
          <div className="w-8 h-8 bg-slate-200 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 bg-slate-200 rounded" />
            <div className="h-3 w-20 bg-slate-200 rounded" />
          </div>
          <div className="h-3 w-16 bg-slate-200 rounded" />
        </div>
      ))}
    </div>
  );
}

function AgentCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 animate-pulse">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="h-5 w-28 bg-slate-200 rounded" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-6 py-4 flex items-center justify-between border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-slate-200 rounded-full" />
            <div className="space-y-1.5">
              <div className="h-3 w-28 bg-slate-200 rounded" />
              <div className="h-3 w-20 bg-slate-200 rounded" />
            </div>
          </div>
          <div className="h-5 w-14 bg-slate-200 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TableSkeleton />
        <AgentCardSkeleton />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTranslations();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-1">{t('common.error')}</h3>
      <p className="text-sm text-slate-500 mb-4 max-w-sm">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors"
      >
        Try Again
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
        api.getConversations({ limit: 5 }).catch(() => ({ docs: [], totalDocs: 0 })),
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
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
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
      gradient: 'from-indigo-500 to-indigo-600',
      shadow: 'shadow-indigo-200',
    },
    {
      key: 'phone',
      label: t('dashboard.phone'),
      value: stats.phoneNumbers,
      icon: Phone,
      gradient: 'from-emerald-500 to-emerald-600',
      shadow: 'shadow-emerald-200',
    },
    {
      key: 'conversations',
      label: t('dashboard.conversations'),
      value: stats.conversations,
      icon: MessageCircle,
      gradient: 'from-amber-500 to-amber-600',
      shadow: 'shadow-amber-200',
    },
    {
      key: 'trunk',
      label: t('dashboard.trunk'),
      value: stats.sipTrunks,
      icon: Globe,
      gradient: 'from-rose-500 to-rose-600',
      shadow: 'shadow-rose-200',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.overview')}</h1>
        <p className="text-slate-500 mt-1">
          {t('dashboard.title')} — {t('common.loading').replace('...', '')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-11 h-11 bg-gradient-to-br ${card.gradient} rounded-xl flex items-center justify-center shadow-lg ${card.shadow}`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-slate-900">{card.value}</span>
              </div>
              <p className="text-sm text-slate-500">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-slate-400" />
              {t('dashboard.conversations')}
            </h2>
            {recentConversations.length > 0 && (
              <span className="text-xs text-slate-400">{recentConversations.length} recent</span>
            )}
          </div>

          {recentConversations.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <MessageCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">{t('common.noData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Channel
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Agent
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentConversations.map((conv) => {
                    const ChannelIcon = channelIcons[conv.channel] || Phone;
                    const config = statusConfig[conv.status] || statusConfig.completed;
                    const StatusIcon = config.icon;
                    return (
                      <tr key={conv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${channelColors[conv.channel] || 'bg-slate-100 text-slate-500'}`}
                          >
                            <ChannelIcon className="w-4 h-4" />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-slate-900">
                            {conv.contact}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600">
                            {conv.agent?.name || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {t(statusConfig[conv.status]?.labelKey || 'common.error')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-slate-600 font-mono">
                            {formatDuration(conv.duration)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            {formatTime(conv.createdAt)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Bot className="w-4 h-4 text-slate-400" />
              {t('dashboard.agents')}
            </h2>
            <span className="text-xs text-slate-400">{agents.length} total</span>
          </div>

          {agents.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Bot className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">{t('common.noData')}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${agentStatusColors[agent.status] || 'bg-slate-300'}`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {agent.name}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <Mic className="w-3 h-3" />
                        {agent.voice || 'Default'}
                        {agent.channels && agent.channels.length > 0 && (
                          <>
                            <span className="text-slate-300">·</span>
                            {agent.channels.join(', ')}
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                      agent.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : agent.status === 'testing'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-50 text-slate-500'
                    }`}
                  >
                    {t(statusConfig[agent.status]?.labelKey || 'common.error')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
