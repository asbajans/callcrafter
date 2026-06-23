'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Phone, MessageCircle, Instagram, Globe, Loader2,
  AlertCircle, ChevronDown, ChevronRight, MessageSquare,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/utils';

const channelConfig: Record<string, { icon: typeof Phone; label: string; color: string }> = {
  voice: { icon: Phone, label: 'Phone', color: 'bg-blue-100 text-blue-700' },
  whatsapp: { icon: MessageCircle, label: 'WhatsApp', color: 'bg-emerald-100 text-emerald-700' },
  instagram: { icon: Instagram, label: 'Instagram', color: 'bg-pink-100 text-pink-700' },
  web: { icon: Globe, label: 'Web', color: 'bg-purple-100 text-purple-700' },
};

const statusColors: Record<string, string> = {
  active: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  missed: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
};

const sentimentColors: Record<string, string> = {
  positive: 'bg-emerald-100 text-emerald-700',
  neutral: 'bg-slate-800 text-slate-300',
  negative: 'bg-red-100 text-red-700',
};

export default function ConversationsPage() {
  const t = useTranslations();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getConversations({ limit: 50 });
      setData(res.docs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setMessages([]);
      return;
    }
    setExpandedId(id);
    setMessagesLoading(true);
    try {
      const res = await api.getMessages(id);
      setMessages(res.docs || []);
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  const getContactDisplay = (contact: any): string => {
    if (!contact) return '—';
    if (typeof contact === 'string') return contact;
    return contact.name || contact.phone || contact.email || contact.id || JSON.stringify(contact);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-slate-300">{error}</p>
        <button onClick={fetchData} className="text-indigo-600 text-sm font-medium hover:text-indigo-800">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('dashboard.conversations')}</h1>
        <p className="text-slate-500 mt-1">View and manage conversations</p>
      </div>

      {data.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">{t('common.noData')}</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800">
                <th className="w-8 px-2 py-3" />
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Channel</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Agent</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Duration</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Start Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Sentiment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((item: any) => {
                const channel = channelConfig[item.channel] || channelConfig.web;
                const ChannelIcon = channel.icon;
                return (
                  <>
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800 transition-colors cursor-pointer"
                      onClick={() => toggleExpand(item.id)}
                    >
                      <td className="px-2 py-4">
                        {expandedId === item.id ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${channel.color}`}>
                          <ChannelIcon className="w-3.5 h-3.5" />
                          {channel.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-white font-medium">{getContactDisplay(item.contact)}</td>
                      <td className="px-4 py-4 text-sm text-slate-300">
                        {item.agent && typeof item.agent === 'object' ? (item.agent as any).name : item.agent || '—'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[item.status] || 'bg-slate-800 text-slate-300'}`}>
                          {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">
                        {item.duration ? formatDuration(item.duration) : '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">
                        {item.startTime ? formatDate(item.startTime) : '—'}
                      </td>
                      <td className="px-4 py-4">
                        {item.sentiment ? (
                          <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${sentimentColors[item.sentiment] || 'bg-slate-800 text-slate-300'}`}>
                            {item.sentiment.charAt(0).toUpperCase() + item.sentiment.slice(1)}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                    {expandedId === item.id && (
                      <tr key={`${item.id}-messages`}>
                        <td colSpan={8} className="px-6 py-4 bg-slate-800">
                          {messagesLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                            </div>
                          ) : messages.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-4">No messages</p>
                          ) : (
                            <div className="space-y-2 max-h-80 overflow-y-auto">
                              {messages.map((msg: any) => (
                                <div
                                  key={msg.id}
                                  className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                                >
                                  <div
                                    className={`max-w-[70%] rounded-lg px-4 py-2 text-sm ${
                                      msg.role === 'assistant'
                                        ? 'bg-slate-800/50 border border-slate-700/50 text-white'
                                        : 'bg-indigo-600 text-white'
                                    }`}
                                  >
                                    <p className="text-xs opacity-60 mb-1">
                                      {msg.role === 'assistant' ? 'AI' : msg.role || 'User'}
                                    </p>
                                    <p>{msg.content || msg.message || '(no content)'}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
