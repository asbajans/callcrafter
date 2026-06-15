'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Loader2, AlertCircle, MessageCircle, Search, Send,
  Check, CheckCheck, Phone, Mail, User, Clock, Archive,
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
  open: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  resolved: 'bg-blue-100 text-blue-700',
  closed: 'bg-slate-100 text-slate-500',
};

export default function WhatsAppConversationsPage() {
  const t = useTranslations();
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

  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await api.getWhatsAppConversations(params);
      setConversations(res.docs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
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
      toast.error(err.message || 'Failed to send');
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
      toast.error(err.message || 'Failed to update status');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'read': return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
      case 'delivered': return <CheckCheck className="w-3.5 h-3.5 text-slate-400" />;
      case 'sent': return <Check className="w-3.5 h-3.5 text-slate-400" />;
      default: return <Clock className="w-3.5 h-3.5 text-slate-300" />;
    }
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
        <p className="text-slate-600">{error}</p>
        <button onClick={fetchConversations} className="text-indigo-600 text-sm font-medium hover:text-indigo-800">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">WhatsApp Inbox</h1>
        <p className="text-slate-500 mt-1">Manage WhatsApp conversations and messages</p>
      </div>

      <div className="flex gap-2">
        {['', 'open', 'pending', 'resolved', 'closed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {conversations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">No WhatsApp conversations</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 overflow-hidden max-h-[70vh] overflow-y-auto">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                  selectedConv?.id === conv.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{conv.contactName || conv.contactPhone || conv.contactJid || 'Unknown'}</p>
                    {conv.contactName && conv.contactPhone && (
                      <p className="text-xs text-slate-400">{conv.contactPhone}</p>
                    )}
                    {conv.lastMessagePreview && (
                      <p className="text-xs text-slate-500 mt-1 truncate">{conv.lastMessagePreview}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2">
                    {conv.unreadCount > 0 && (
                      <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {conv.unreadCount}
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[conv.status] || 'bg-slate-100 text-slate-500'}`}>
                      {conv.status}
                    </span>
                    {conv.lastMessageAt && (
                      <span className="text-[10px] text-slate-400">{new Date(conv.lastMessageAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 flex flex-col h-[70vh]">
            {!selectedConv ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <MessageCircle className="w-12 h-12" />
                <p className="text-sm">Select a conversation to view messages</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{selectedConv.contactName || selectedConv.contactPhone || 'Unknown'}</p>
                    <p className="text-xs text-slate-500">{selectedConv.contactPhone}{selectedConv.account ? ` · ${selectedConv.account.name}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedConv.status}
                      onChange={(e) => updateStatus(selectedConv.id, e.target.value)}
                      className="text-xs border border-slate-300 rounded-lg px-2 py-1 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">No messages yet</p>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-lg px-4 py-2 text-sm ${
                          msg.direction === 'outbound'
                            ? 'bg-indigo-600 text-white rounded-br-sm'
                            : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                        }`}>
                          {msg.mediaUrl && (
                            <p className="text-xs opacity-70 mb-1">[{msg.messageType}]</p>
                          )}
                          <p>{msg.body || `(${msg.messageType} media)`}</p>
                          <div className={`flex items-center gap-1 mt-1 ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[10px] opacity-60">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                            {msg.direction === 'outbound' && getStatusIcon(msg.status)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Type a message..."
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!replyText.trim() || sending}
                      className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
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
