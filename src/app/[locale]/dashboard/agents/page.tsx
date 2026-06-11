'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { toast } from 'sonner';
import { z } from 'zod';
import { api } from '@/lib/api';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  ChevronDown,
  Loader2,
  AlertCircle,
  Bot,
  Phone,
  MessageCircle,
  Instagram,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Voice = {
  id: string;
  name: string;
  language: string;
  gender?: string;
};

type Agent = {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string | null;
  voiceId: string | null;
  voiceName: string | null;
  language: string;
  model: string;
  temperature: number;
  channels: string[];
  greetingMessage: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const LANGUAGES = ['TR', 'EN', 'ES', 'FR', 'DE'] as const;
const MODELS = ['GPT-4o', 'GPT-4', 'GPT-3.5-Turbo', 'Claude-3.5-Sonnet', 'Claude-3-Haiku'] as const;
const CHANNEL_OPTIONS = [
  { key: 'voice' as const, labelKey: 'channel_voice', icon: Phone },
  { key: 'whatsapp' as const, labelKey: 'channel_whatsapp', icon: MessageCircle },
  { key: 'instagram' as const, labelKey: 'channel_instagram', icon: Instagram },
  { key: 'web' as const, labelKey: 'channel_web', icon: Globe },
];
const STATUSES = ['Active', 'Inactive', 'Testing'] as const;

const agentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().default(''),
  systemPrompt: z.string().min(1, 'System prompt is required'),
  voiceId: z.string().min(1, 'Voice is required'),
  language: z.enum(LANGUAGES),
  model: z.enum(MODELS),
  temperature: z.number().min(0).max(2),
  channels: z.array(z.enum(['voice', 'whatsapp', 'instagram', 'web'])).min(1, 'Select at least one channel'),
  greetingMessage: z.string().max(500).optional().default(''),
  status: z.enum(['Active', 'Inactive', 'Testing']),
});

type AgentFormData = z.infer<typeof agentSchema>;

const defaultFormData: AgentFormData = {
  name: '',
  description: '',
  systemPrompt: '',
  voiceId: '',
  language: 'EN',
  model: 'GPT-4o',
  temperature: 0.7,
  channels: ['voice'],
  greetingMessage: '',
  status: 'Active',
};

function AgentFormModal({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  voices,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AgentFormData) => Promise<void>;
  initialData?: AgentFormData | null;
  voices: Voice[];
  loading: boolean;
}) {
  const t = useTranslations();
  const [form, setForm] = useState<AgentFormData>(initialData ?? defaultFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof AgentFormData, string>>>({});

  useEffect(() => {
    setForm(initialData ?? defaultFormData);
    setErrors({});
  }, [initialData, open]);

  const update = <K extends keyof AgentFormData>(key: K, value: AgentFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = agentSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof AgentFormData, string>> = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0] as keyof AgentFormData;
        if (!fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    await onSubmit(result.data);
  };

  const toggleChannel = (channel: 'voice' | 'whatsapp' | 'instagram' | 'web') => {
    const current = form.channels;
    if (current.includes(channel)) {
      update('channels', current.filter((c) => c !== channel));
    } else {
      update('channels', [...current, channel]);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-200 p-0 data-[state=open]:animate-in data-[state=closed]:animate-out">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <Dialog.Title className="text-lg font-semibold text-slate-900">
              {initialData ? t('agent.edit') : t('agent.create')}
            </Dialog.Title>
            <Dialog.Close className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">{t('agent.name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500',
                    errors.name ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'
                  )}
                  placeholder="e.g. Customer Support"
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">{t('agent.status')}</label>
                <Select.Root value={form.status} onValueChange={(v) => update('status', v as AgentFormData['status'])}>
                  <Select.Trigger
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500',
                      errors.status ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'
                    )}
                  >
                    <Select.Value />
                    <Select.Icon>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="z-50 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                      <Select.Viewport>
                        {STATUSES.map((s) => (
                          <Select.Item
                            key={s}
                            value={s}
                            className="px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-700 outline-none flex items-center gap-2"
                          >
                            <Select.ItemText>{s}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
                {errors.status && <p className="text-xs text-red-500">{errors.status}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">{t('agent.description')}</label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={2}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none',
                  errors.description ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'
                )}
                placeholder="Brief description of this agent's purpose"
              />
              {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">{t('agent.systemPrompt')}</label>
              <textarea
                value={form.systemPrompt}
                onChange={(e) => update('systemPrompt', e.target.value)}
                rows={5}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono',
                  errors.systemPrompt ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'
                )}
                placeholder="You are a helpful AI assistant that specializes in..."
              />
              {errors.systemPrompt && <p className="text-xs text-red-500">{errors.systemPrompt}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">{t('agent.voice')}</label>
                <Select.Root value={form.voiceId} onValueChange={(v) => update('voiceId', v)}>
                  <Select.Trigger
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500',
                      errors.voiceId ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'
                    )}
                  >
                    <Select.Value placeholder="Select a voice" />
                    <Select.Icon>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="z-50 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                      <Select.Viewport>
                        {voices.map((v) => (
                          <Select.Item
                            key={v.id}
                            value={v.id}
                            className="px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-700 outline-none"
                          >
                            <Select.ItemText>
                              {v.name} {v.language ? `(${v.language})` : ''}
                            </Select.ItemText>
                          </Select.Item>
                        ))}
                        {voices.length === 0 && (
                          <div className="px-3 py-4 text-sm text-slate-400 text-center">No voices available</div>
                        )}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
                {errors.voiceId && <p className="text-xs text-red-500">{errors.voiceId}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">{t('agent.language')}</label>
                <Select.Root value={form.language} onValueChange={(v) => update('language', v as AgentFormData['language'])}>
                  <Select.Trigger
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500',
                      errors.language ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'
                    )}
                  >
                    <Select.Value />
                    <Select.Icon>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="z-50 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                      <Select.Viewport>
                        {LANGUAGES.map((l) => (
                          <Select.Item
                            key={l}
                            value={l}
                            className="px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-700 outline-none"
                          >
                            <Select.ItemText>{l}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
                {errors.language && <p className="text-xs text-red-500">{errors.language}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">{t('agent.model')}</label>
                <Select.Root value={form.model} onValueChange={(v) => update('model', v as AgentFormData['model'])}>
                  <Select.Trigger
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500',
                      errors.model ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'
                    )}
                  >
                    <Select.Value />
                    <Select.Icon>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="z-50 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                      <Select.Viewport>
                        {MODELS.map((m) => (
                          <Select.Item
                            key={m}
                            value={m}
                            className="px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-700 outline-none"
                          >
                            <Select.ItemText>{m}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
                {errors.model && <p className="text-xs text-red-500">{errors.model}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Temperature: <span className="text-indigo-600">{form.temperature.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={form.temperature}
                  onChange={(e) => update('temperature', parseFloat(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>0 (Precise)</span>
                  <span>2 (Creative)</span>
                </div>
                {errors.temperature && <p className="text-xs text-red-500">{errors.temperature}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">{t('agent.channels')}</label>
              <div className="flex flex-wrap gap-3">
                {CHANNEL_OPTIONS.map((ch) => {
                  const Icon = ch.icon;
                  const selected = form.channels.includes(ch.key);
                  return (
                    <button
                      type="button"
                      key={ch.key}
                      onClick={() => toggleChannel(ch.key)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                        selected
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {ch.labelKey}
                      {selected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
              {errors.channels && <p className="text-xs text-red-500">{errors.channels}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Greeting Message</label>
              <input
                type="text"
                value={form.greetingMessage}
                onChange={(e) => update('greetingMessage', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500',
                  errors.greetingMessage ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'
                )}
                placeholder="Hello! How can I help you today?"
              />
              {errors.greetingMessage && <p className="text-xs text-red-500">{errors.greetingMessage}</p>}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <Dialog.Close
                type="button"
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </Dialog.Close>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  agentName,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  agentName: string;
  loading: boolean;
}) {
  const t = useTranslations();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 p-0">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold text-slate-900">
                  {t('common.delete')}
                </Dialog.Title>
                <p className="text-sm text-slate-500 mt-0.5">
                  Are you sure you want to delete <strong>{agentName}</strong>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <Dialog.Close
                type="button"
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </Dialog.Close>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function AgentsPage() {
  const t = useTranslations();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentFormData | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getAgents();
      setAgents(Array.isArray(data) ? data : data.docs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVoices = useCallback(async () => {
    try {
      const data = await api.getVoices();
      setVoices(Array.isArray(data) ? data : data.docs ?? []);
    } catch {
      // silently fail — voices are not critical
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchVoices();
  }, [fetchAgents, fetchVoices]);

  const handleCreate = () => {
    setEditingAgent(null);
    setEditingId(null);
    setModalOpen(true);
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent({
      name: agent.name,
      description: agent.description ?? '',
      systemPrompt: agent.systemPrompt ?? '',
      voiceId: agent.voiceId ?? '',
      language: agent.language as AgentFormData['language'],
      model: agent.model as AgentFormData['model'],
      temperature: agent.temperature,
      channels: agent.channels as AgentFormData['channels'],
      greetingMessage: agent.greetingMessage ?? '',
      status: agent.status as AgentFormData['status'],
    });
    setEditingId(agent.id);
    setModalOpen(true);
  };

  const handleDeleteClick = (agent: Agent) => {
    setDeletingAgent(agent);
    setDeleteOpen(true);
  };

  const handleFormSubmit = async (data: AgentFormData) => {
    setSubmitting(true);
    try {
      if (editingId) {
        await api.updateAgent(editingId, data);
      } else {
        await api.createAgent(data);
      }
      toast.success(editingId ? 'Agent updated successfully' : 'Agent created successfully');
      setModalOpen(false);
      setEditingAgent(null);
      setEditingId(null);
      fetchAgents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAgent) return;
    setDeleting(true);
    try {
      await api.deleteAgent(deletingAgent.id);
      toast.success('Agent deleted successfully');
      setDeleteOpen(false);
      setDeletingAgent(null);
      fetchAgents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setDeleting(false);
    }
  };

  const statusColors: Record<string, string> = {
    Active: 'bg-emerald-500',
    Inactive: 'bg-slate-300',
    Testing: 'bg-amber-500',
  };

  const channelIcons: Record<string, React.ReactNode> = {
    voice: <Phone className="w-3.5 h-3.5" />,
    whatsapp: <MessageCircle className="w-3.5 h-3.5" />,
    instagram: <Instagram className="w-3.5 h-3.5" />,
    web: <Globe className="w-3.5 h-3.5" />,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.agents')}</h1>
          <p className="text-slate-500 mt-1">{t('agent.description')}</p>
        </div>
        <button
          onClick={handleCreate}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {t('agent.create')}
        </button>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-500">{t('common.loading')}</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-white rounded-xl border border-red-200 p-8 flex flex-col items-center justify-center gap-3">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <button
            onClick={fetchAgents}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && agents.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center gap-3">
          <Bot className="w-12 h-12 text-slate-300" />
          <p className="text-sm text-slate-500">{t('common.noData')}</p>
          <button
            onClick={handleCreate}
            className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors"
          >
            {t('agent.create')}
          </button>
        </div>
      )}

      {!loading && !error && agents.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {t('agent.name')}
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {t('agent.voice')}
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {t('agent.language')}
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {t('agent.channels')}
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {t('agent.model')}
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {t('agent.status')}
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <span className="text-sm font-medium text-slate-900">{agent.name}</span>
                        {agent.description && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 max-w-[200px]">
                            {agent.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {agent.voiceName || agent.voiceId || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-700">{agent.language}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {agent.channels.map((ch) => (
                          <span
                            key={ch}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs"
                            title={ch}
                          >
                            {channelIcons[ch]}
                          </span>
                        ))}
                        {agent.channels.length === 0 && (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{agent.model}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full',
                            statusColors[agent.status] || 'bg-slate-300'
                          )}
                        />
                        <span className="text-sm text-slate-600">
                          {agent.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                      {new Date(agent.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(agent)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(agent)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AgentFormModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setEditingAgent(null);
            setEditingId(null);
          }
        }}
        onSubmit={handleFormSubmit}
        initialData={editingAgent}
        voices={voices}
        loading={submitting}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeletingAgent(null);
        }}
        onConfirm={handleDeleteConfirm}
        agentName={deletingAgent?.name ?? ''}
        loading={deleting}
      />
    </div>
  );
}
