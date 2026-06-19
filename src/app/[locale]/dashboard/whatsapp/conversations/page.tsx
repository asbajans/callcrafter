'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Loader2, AlertCircle, MessageCircle, Send,
  Check, CheckCheck, Clock, RefreshCw, User,
} from 'lucide-react';

type Conversation = {
  id: string;
  contactPhone: string;
  contactName: string | null;
  contactJid: string | null;
  status: string;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  account?: { name?: string };
  assignedTo?: { id: string; firstName?: string; lastName?: string } | null;
};

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  messageType: string;
  body: string | null;
  mediaUrl: string | null;
  status: string;
  createdAt: string;
};

const statusColors: Record<string, string> = {
  open: 'bg-emerald-500/20 text-emerald-400',
  pending: 'bg-amber-500/20 text-amber-400',
  resolved: 'bg-blue-500/20 text-blue-400',
  closed: 'bg-white/[0.08] text-slate-500',
};

const statusLabels: Record<string, string> = {
  open: 'Açık',
  pending: 'Beklemede',
  resolved: 'Çözüldü',
  closed: 'Kapalı',
};

function formatRelativeTime(iso: string): string {
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

function getInitials(name: string | null, phone: string): string {
  if (name) return name.slice(0, 2).toUpperCase();
  return phone.slice(-2);
}

function getAvatarColor(id: string): string {
  const colors = [
    'from-indigo-500 to-violet-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-blue-600',
    'from-purple-500 to-indigo-600',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function WhatsAppConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await api.getWhatsAppConversations(params);
      setConversations(res.docs || []);
    } catch (err: any) {
      setError(err.message || 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConversations(); }, [statusFilter]);

  const selectConversation = async (conv: Conversation) => {
    setSelectedConv(conv);
    setMessagesLoading(true);
    try {
      const res = await api.getWhatsAppMessages(conv.id);
      setMessages((res.docs || []).reverse());
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!replyText.trim() || !selectedConv) return;
    setSending(true);
    try {
      await api.sendWhatsAppMessage(selectedConv.id, { body: replyText });
      setReplyText('');
      const res = await api.getWhatsAppMessages(selectedConv.id);
      setMessages((res.docs || []).reverse());
      fetchConversations();
    } catch (err: any) {
      toast.error(err.message || 'Gönderilemedi');
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.updateWhatsAppConversationStatus(id, status);
      if (selectedConv?.id === id) {
        setSelectedConv({ ...selectedConv, status });
      }
      fetchConversations();
    } catch (err: any) {
      toast.error(err.message || 'Durum güncellenemedi');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'read': return <CheckCheck className="w-3.5 h-3.5 text-indigo-400" />;
      case 'delivered': return <CheckCheck className="w-3.5 h-3.5 text-slate-500" />;
      case 'sent': return <Check className="w-3.5 h-3.5 text-slate-500" />;
      default: return <Clock className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7 text-red-400" />
        </div>
        <p className="text-slate-400 mb-4">{error}</p>
        <button onClick={fetchConversations} className="text-indigo-400 text-sm font-medium hover:text-indigo-300 transition-colors">
          Tekrar dene
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {['', 'open', 'pending', 'resolved', 'closed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === s
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-white/[0.05] text-slate-400 border border-white/[0.08] hover:bg-white/[0.08] hover:text-slate-200'
            }`}
          >
            {s ? (statusLabels[s] || s) : 'Tümü'}
          </button>
        ))}
        <button
          onClick={fetchConversations}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 bg-white/[0.04] border border-white/[0.08] rounded-lg hover:bg-white/[0.07] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Yenile
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.08] border-dashed rounded-2xl p-16 text-center">
          <div className="w-14 h-14 bg-white/[0.05] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <MessageCircle className="w-7 h-7 text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium mb-1">Konuşma bulunamadı</p>
          <p className="text-slate-600 text-sm">Bu filtreye ait WhatsApp konuşması yok.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-280px)] min-h-[500px]">
          {/* Conversation list */}
          <div className="lg:col-span-1 bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {conversations.length} Konuşma
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.map((conv) => {
                const isSelected = selectedConv?.id === conv.id;
                const avatarColor = getAvatarColor(conv.id);
                const displayName = conv.contactName || conv.contactPhone || 'Bilinmiyor';
                return (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={`w-full text-left px-4 py-3.5 border-b border-white/[0.04] transition-all relative ${
                      isSelected
                        ? 'bg-indigo-600/15 border-l-2 border-l-indigo-500'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                        {getInitials(conv.contactName, conv.contactPhone || conv.contactJid || 'WA')}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="text-sm font-semibold text-slate-200 truncate">{displayName}</p>
                          {conv.lastMessageAt && (
                            <span className="text-[10px] text-slate-600 shrink-0">{formatRelativeTime(conv.lastMessageAt)}</span>
                          )}
                        </div>
                        {conv.lastMessagePreview && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{conv.lastMessagePreview}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[conv.status] || 'bg-white/[0.06] text-slate-500'}`}>
                            {statusLabels[conv.status] || conv.status}
                          </span>
                          {conv.unreadCount > 0 && (
                            <span className="ml-auto bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message panel */}
          <div className="lg:col-span-2 bg-white/[0.04] border border-white/[0.08] rounded-2xl flex flex-col overflow-hidden">
            {!selectedConv ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
                <div className="w-16 h-16 bg-white/[0.05] rounded-2xl flex items-center justify-center">
                  <MessageCircle className="w-8 h-8" />
                </div>
                <p className="text-sm text-slate-500">Mesajları görmek için bir konuşma seçin</p>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] shrink-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(selectedConv.id)} flex items-center justify-center text-white text-xs font-bold`}>
                      {getInitials(selectedConv.contactName, selectedConv.contactPhone || 'WA')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        {selectedConv.contactName || selectedConv.contactPhone || 'Bilinmiyor'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selectedConv.contactPhone}
                        {selectedConv.account?.name ? ` · ${selectedConv.account.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <select
                    value={selectedConv.status}
                    onChange={(e) => updateStatus(selectedConv.id, e.target.value)}
                    className="text-xs bg-white/[0.06] border border-white/[0.1] text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors"
                  >
                    <option value="open">Açık</option>
                    <option value="pending">Beklemede</option>
                    <option value="resolved">Çözüldü</option>
                    <option value="closed">Kapalı</option>
                  </select>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2">
                      <MessageCircle className="w-8 h-8 text-slate-700" />
                      <p className="text-sm text-slate-600">Henüz mesaj yok</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                        {msg.direction === 'inbound' && (
                          <div className="w-6 h-6 rounded-full bg-white/[0.08] flex items-center justify-center mr-2 mt-1 shrink-0">
                            <User className="w-3 h-3 text-slate-500" />
                          </div>
                        )}
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-lg ${
                          msg.direction === 'outbound'
                            ? 'bg-indigo-600 text-white rounded-br-sm'
                            : 'bg-white/[0.08] text-slate-200 rounded-bl-sm'
                        }`}>
                          {msg.mediaUrl && (
                            <p className="text-xs opacity-60 mb-1 font-medium">[{msg.messageType}]</p>
                          )}
                          <p className="leading-relaxed">{msg.body || `(${msg.messageType})`}</p>
                          <div className={`flex items-center gap-1 mt-1.5 ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[10px] opacity-50">
                              {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {msg.direction === 'outbound' && getStatusIcon(msg.status)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply box */}
                <div className="border-t border-white/[0.06] p-3 shrink-0">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={textareaRef}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Mesaj yazın... (Enter: Gönder, Shift+Enter: Yeni satır)"
                      rows={1}
                      className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none transition-colors min-h-[42px] max-h-28"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!replyText.trim() || sending}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
