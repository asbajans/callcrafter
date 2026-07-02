'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { toast } from 'sonner';
import { z } from 'zod';
import { api } from '@/lib/api';
import type { Voice } from '@/lib/voices';
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
  Play,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AgentTestModal from '../../admin/agents/AgentTestModal';

type Agent = {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string | null;
  voice: string | null;
  voiceName: string | null;
  language: string;
  temperature: number;
  channels: string[];
  greetingMessage: string | null;
  status: string;
  model?: string | null;
  ttsProvider?: string | null;
  provider?: number | { id: number } | null;
  createdAt: string;
  updatedAt: string;
};

const LANGUAGES = ['TR', 'EN', 'ES', 'FR', 'DE'] as const;
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
  voice: z.string().min(1, 'Voice is required'),
  language: z.enum(LANGUAGES),
  temperature: z.number().min(0).max(2),
  channels: z.array(z.enum(['voice', 'whatsapp', 'instagram', 'web'])).min(1, 'Select at least one channel'),
  greetingMessage: z.string().max(500).optional().default(''),
  status: z.enum(['Active', 'Inactive', 'Testing']),
  provider: z.number().optional(),
  model: z.string().optional(),
  ttsProvider: z.enum(['auto', 'edge-tts', 'elevenlabs', 'piper']).optional().default('auto'),
  pitch: z.number().min(-100).max(100).optional().default(0),
  rate: z.number().min(-50).max(50).optional().default(0),
});

type AgentFormData = z.infer<typeof agentSchema>;

interface AiProvider {
  id: number;
  name: string;
  displayName?: string;
  providerType: string;
  models: { name: string; modelId: string; creditCost?: number }[];
  defaultModel?: string;
  isActive: boolean;
}

const defaultFormData: AgentFormData = {
  name: '',
  description: '',
  systemPrompt: '',
  voice: '',
  language: 'EN',
  temperature: 0.7,
  channels: ['voice'],
  greetingMessage: '',
  status: 'Active',
  provider: undefined,
  model: undefined,
  ttsProvider: 'auto',
  pitch: 0,
  rate: 0,
};

function AgentFormModal({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  voices,
  providers,
  loading,
  planLimits,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AgentFormData) => Promise<void>;
  initialData?: AgentFormData | null;
  voices: (Voice & { provider?: string })[];
  providers: AiProvider[];
  loading: boolean;
  planLimits?: { allowedTtsProviders?: string[]; allowedAiModels?: string[]; allowedChannels?: string[] } | null;
}) {
  const t = useTranslations();
  const [form, setForm] = useState<AgentFormData>(initialData ?? defaultFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof AgentFormData, string>>>({});
  const [elevenLabsVoices, setElevenLabsVoices] = useState<{ id: string; name: string; provider?: string }[]>([]);
  const [loadingElevenLabs, setLoadingElevenLabs] = useState(false);
  const [elevenLabsError, setElevenLabsError] = useState<string | null>(null);
  const [elevenLabsFetched, setElevenLabsFetched] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [voiceDropdownOpen, setVoiceDropdownOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setForm(initialData ?? defaultFormData);
    setErrors({});
    setElevenLabsVoices([]);
    setElevenLabsError(null);
    setElevenLabsFetched(false);
    setVoiceDropdownOpen(false);
  }, [initialData, open]);

  const fetchElevenLabsVoices = useCallback(async () => {
    setLoadingElevenLabs(true);
    setElevenLabsError(null);
    try {
      const data = await api.getVoices();
      const elVoices = data.voices.filter((v) => v.provider === 'elevenlabs');
      setElevenLabsVoices(elVoices);
      if (elVoices.length === 0) {
        setElevenLabsError('ElevenLabs ses bulunamadı. API anahtarınızı kontrol edin.');
      }
    } catch {
      setElevenLabsError('ElevenLabs sesleri alınamadı. API bağlantısını kontrol edin.');
    } finally {
      setLoadingElevenLabs(false);
      setElevenLabsFetched(true);
    }
  }, []);

  useEffect(() => {
    if (form.ttsProvider === 'elevenlabs' && !elevenLabsFetched && !loadingElevenLabs) {
      fetchElevenLabsVoices();
    }
  }, [form.ttsProvider, elevenLabsFetched, loadingElevenLabs, fetchElevenLabsVoices]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const previewVoice = useCallback(async (voiceId: string, provider: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (previewingVoice === voiceId) {
      setPreviewingVoice(null);
      return;
    }
    setPreviewingVoice(voiceId);
    try {
      const testText = voiceId.startsWith('tr-') || voiceId.startsWith('tr_')
        ? 'Merhaba, ben CallCrafter yapay zeka asistanıyım. Size nasıl yardımcı olabilirim?'
        : 'Hello, I am CallCrafter AI assistant. How can I help you today?';
      const res = await fetch(`/api/voices/tts?voice=${encodeURIComponent(voiceId)}&text=${encodeURIComponent(testText)}&provider=${provider}`);
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; setPreviewingVoice(null); };
      audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; setPreviewingVoice(null); };
      audio.play();
    } catch {
      setPreviewingVoice(null);
    }
  }, [previewingVoice]);

  const update = <K extends keyof AgentFormData>(key: K, value: AgentFormData[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'provider') {
        next.model = undefined;
      }
      if (key === 'ttsProvider') {
        next.voice = '';
      }
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      delete next.model;
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

  const allowedTts = planLimits?.allowedTtsProviders;
  const allowedModels = planLimits?.allowedAiModels;
  const allowedCh = planLimits?.allowedChannels;

  const selectedProvider = providers.find(p => p.id === form.provider);
  const rawModels = selectedProvider?.models || [];
  const availableModels = allowedModels && allowedModels.length > 0
    ? rawModels.filter((m: any) => allowedModels.includes(m.modelId || m))
    : rawModels;

  const useElevenLabs = form.ttsProvider === 'elevenlabs';
  const useEdgeTTS = form.ttsProvider === 'edge-tts' || form.ttsProvider === 'auto';
  const availableVoices = useElevenLabs
    ? elevenLabsVoices
    : voices.filter((v) => useEdgeTTS ? (v.provider === 'edge-tts') : (v.provider === 'piper'));

  const selectedVoiceName = availableVoices.find(v => v.id === form.voice)?.name || form.voice || '';

  const filteredTtsOptions = ['auto', 'edge-tts', 'piper', 'elevenlabs'].filter(opt => {
    if (!allowedTts || allowedTts.length === 0) return true;
    if (opt === 'auto') return true;
    return allowedTts.includes(opt);
  });

  const filteredProviders = providers.filter(p => p.isActive).filter(p => {
    if (!allowedModels || allowedModels.length === 0) return true;
    if (!p.models || p.models.length === 0) return true;
    return p.models.some((m: any) => allowedModels.includes(m.modelId || m));
  });

  const filteredChannelOptions = CHANNEL_OPTIONS.filter(ch => {
    if (!allowedCh || allowedCh.length === 0) return true;
    return allowedCh.includes(ch.key);
  });

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
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 rounded-2xl shadow-2xl border border-white/[0.1] p-0 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
            <Dialog.Title className="text-lg font-semibold text-white">
              {initialData ? t('agent.edit') : t('agent.create')}
            </Dialog.Title>
            <Dialog.Close className="rounded-lg p-1.5 text-slate-500 hover:text-slate-200 hover:bg-white/[0.08] transition-colors">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">{t('agent.name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  className={cn(
                    'w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-100 placeholder-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50',
                    errors.name ? 'border-red-500/50 bg-red-500/10' : 'border-white/[0.1] bg-white/[0.06]'
                  )}
                  placeholder="örn. Müşteri Destek"
                />
                {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">{t('agent.status')}</label>
                <Select.Root value={form.status} onValueChange={(v) => update('status', v as AgentFormData['status'])}>
                  <Select.Trigger
                    className={cn(
                      'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50',
                      errors.status ? 'border-red-500/50 bg-red-500/10' : 'border-white/[0.1] bg-white/[0.06]'
                    )}
                  >
                    <Select.Value />
                    <Select.Icon>
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="z-50 bg-slate-800 border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden">
                      <Select.Viewport>
                        {STATUSES.map((s) => (
                          <Select.Item
                            key={s}
                            value={s}
                            className="px-3.5 py-2.5 text-sm text-slate-300 hover:bg-indigo-600/30 hover:text-indigo-200 cursor-pointer data-[highlighted]:bg-indigo-600/30 data-[highlighted]:text-indigo-200 outline-none"
                          >
                            <Select.ItemText>{s}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
                {errors.status && <p className="text-xs text-red-400">{errors.status}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">{t('agent.description')}</label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={2}
                className={cn(
                  'w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-100 placeholder-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none',
                  errors.description ? 'border-red-500/50 bg-red-500/10' : 'border-white/[0.1] bg-white/[0.06]'
                )}
                placeholder="Bu ajanın amacı hakkında kısa bir açıklama"
              />
              {errors.description && <p className="text-xs text-red-400">{errors.description}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">{t('agent.systemPrompt')}</label>
              <textarea
                value={form.systemPrompt}
                onChange={(e) => update('systemPrompt', e.target.value)}
                rows={5}
                className={cn(
                  'w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-100 placeholder-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none font-mono',
                  errors.systemPrompt ? 'border-red-500/50 bg-red-500/10' : 'border-white/[0.1] bg-white/[0.06]'
                )}
                placeholder="Sen müşteri desteği konusunda uzmanlaşmış bir yapay zeka asistanısın..."
              />
              {errors.systemPrompt && <p className="text-xs text-red-400">{errors.systemPrompt}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">{t('agent.voice')}</label>
                {loadingElevenLabs ? (
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-white/[0.1] bg-white/[0.06] text-sm text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    ElevenLabs sesleri yükleniyor...
                  </div>
                ) : elevenLabsError ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {elevenLabsError}
                    </div>
                    <button
                      type="button"
                      onClick={fetchElevenLabsVoices}
                      className="text-xs text-indigo-400 hover:text-indigo-300 self-start"
                    >
                      Tekrar dene
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setVoiceDropdownOpen(!voiceDropdownOpen)}
                      onBlur={() => setTimeout(() => setVoiceDropdownOpen(false), 200)}
                      className={cn(
                        'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50',
                        errors.voice ? 'border-red-500/50 bg-red-500/10' : 'border-white/[0.1] bg-white/[0.06]'
                      )}
                    >
                      <span className={form.voice ? 'text-slate-100' : 'text-slate-600'}>
                        {form.voice ? selectedVoiceName : 'Ses seç'}
                      </span>
                      <ChevronDown className={cn('w-4 h-4 text-slate-500 transition-transform', voiceDropdownOpen && 'rotate-180')} />
                    </button>
                    {voiceDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-white/[0.1] rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                        {availableVoices.map((v) => (
                          <div
                            key={v.id}
                            className={cn(
                              'flex items-center justify-between px-3.5 py-2.5 text-sm cursor-pointer transition-colors group',
                              form.voice === v.id
                                ? 'bg-indigo-600/30 text-indigo-200'
                                : 'text-slate-300 hover:bg-indigo-600/30 hover:text-indigo-200'
                            )}
                            onClick={() => {
                              update('voice', v.id);
                              setVoiceDropdownOpen(false);
                            }}
                          >
                            <span className="truncate">
                              {v.name} {(v as any).provider === 'elevenlabs' ? '(ElevenLabs)' : (v as any).provider === 'edge-tts' ? '(Edge TTS)' : `(${(v as any).language || ''})`}
                            </span>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                previewVoice(v.id, (v as any).provider || form.ttsProvider || 'edge-tts');
                              }}
                              className="ml-2 p-1 rounded-md hover:bg-white/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                              title="Sesi dinle"
                            >
                              {previewingVoice === v.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                              ) : (
                                <Play className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-300" />
                              )}
                            </button>
                          </div>
                        ))}
                        {availableVoices.length === 0 && (
                          <div className="px-3 py-4 text-sm text-slate-500 text-center">Ses bulunamadı</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {errors.voice && <p className="text-xs text-red-400">{errors.voice}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">{t('agent.language')}</label>
                <Select.Root value={form.language} onValueChange={(v) => update('language', v as AgentFormData['language'])}>
                  <Select.Trigger
                    className={cn(
                      'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50',
                      errors.language ? 'border-red-500/50 bg-red-500/10' : 'border-white/[0.1] bg-white/[0.06]'
                    )}
                  >
                    <Select.Value />
                    <Select.Icon>
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="z-50 bg-slate-800 border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden">
                      <Select.Viewport>
                        {LANGUAGES.map((l) => (
                          <Select.Item
                            key={l}
                            value={l}
                            className="px-3.5 py-2.5 text-sm text-slate-300 hover:bg-indigo-600/30 hover:text-indigo-200 cursor-pointer data-[highlighted]:bg-indigo-600/30 data-[highlighted]:text-indigo-200 outline-none"
                          >
                            <Select.ItemText>{l}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
                {errors.language && <p className="text-xs text-red-400">{errors.language}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">
                  Ses Perdesi (Pitch): <span className="text-indigo-400">{form.pitch}Hz</span>
                </label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={form.pitch}
                  onChange={(e) => update('pitch', parseInt(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/[0.1] accent-indigo-500"
                />
                <div className="flex justify-between text-xs text-slate-600">
                  <span>-100 (Kalın)</span>
                  <span>0 (Normal)</span>
                  <span>+100 (İnce)</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">
                  Konuşma Hızı (Rate): <span className="text-indigo-400">{form.rate > 0 ? `+${form.rate}` : form.rate}%</span>
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="1"
                  value={form.rate}
                  onChange={(e) => update('rate', parseInt(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/[0.1] accent-indigo-500"
                />
                <div className="flex justify-between text-xs text-slate-600">
                  <span>-50 (Yavaş)</span>
                  <span>0 (Normal)</span>
                  <span>+50 (Hızlı)</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">
                  Temperature: <span className="text-indigo-400">{form.temperature.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={form.temperature}
                  onChange={(e) => update('temperature', parseFloat(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/[0.1] accent-indigo-500"
                />
                <div className="flex justify-between text-xs text-slate-600">
                  <span>0 (Hassas)</span>
                  <span>2 (Yaratıcı)</span>
                </div>
                {errors.temperature && <p className="text-xs text-red-400">{errors.temperature}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">AI Sağlayıcı</label>
                <Select.Root
                  value={form.provider ? String(form.provider) : ''}
                  onValueChange={(v) => update('provider', v ? Number(v) : undefined)}
                >
                  <Select.Trigger
                    className={cn(
                      'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50',
                      'border-white/[0.1] bg-white/[0.06]'
                    )}
                  >
                    <Select.Value placeholder="Sağlayıcı seç" />
                    <Select.Icon>
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="z-50 bg-slate-800 border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden">
                      <Select.Viewport>
                        {filteredProviders.map((p) => (
                          <Select.Item
                            key={p.id}
                            value={String(p.id)}
                            className="px-3.5 py-2.5 text-sm text-slate-300 hover:bg-indigo-600/30 hover:text-indigo-200 cursor-pointer data-[highlighted]:bg-indigo-600/30 data-[highlighted]:text-indigo-200 outline-none"
                          >
                            <Select.ItemText>{p.displayName || p.name}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Model</label>
                <Select.Root
                  value={form.model || ''}
                  onValueChange={(v) => update('model', v || undefined)}
                >
                  <Select.Trigger
                    className={cn(
                      'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50',
                      'border-white/[0.1] bg-white/[0.06]'
                    )}
                  >
                    <Select.Value placeholder={form.provider ? 'Model seç' : 'Önce sağlayıcı seçin'} />
                    <Select.Icon>
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="z-50 bg-slate-800 border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden">
                      <Select.Viewport>
                        {availableModels.map((m: any) => (
                          <Select.Item
                            key={m.modelId || m}
                            value={m.modelId || m}
                            className="px-3.5 py-2.5 text-sm text-slate-300 hover:bg-indigo-600/30 hover:text-indigo-200 cursor-pointer data-[highlighted]:bg-indigo-600/30 data-[highlighted]:text-indigo-200 outline-none"
                          >
                            <Select.ItemText>{m.name || m.modelId || m}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Ses Motoru</label>
              <Select.Root
                value={form.ttsProvider || 'auto'}
                onValueChange={(v) => update('ttsProvider', v as 'auto' | 'edge-tts' | 'elevenlabs' | 'piper')}
              >
                <Select.Trigger
                  className={cn(
                    'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50',
                    'border-white/[0.1] bg-white/[0.06]'
                  )}
                >
                  <Select.Value />
                  <Select.Icon>
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="z-50 bg-slate-800 border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden">
                    <Select.Viewport>
                      {filteredTtsOptions.map(opt => {
                        const labels: Record<string, string> = {
                          auto: 'Otomatik (önce Edge TTS)',
                          'edge-tts': 'Edge TTS (Microsoft, ucretsiz)',
                          piper: 'Piper (yerel, offline)',
                          elevenlabs: 'ElevenLabs (ucretli)',
                        };
                        return (
                          <Select.Item key={opt} value={opt}
                            className="px-3.5 py-2.5 text-sm text-slate-300 hover:bg-indigo-600/30 hover:text-indigo-200 cursor-pointer data-[highlighted]:bg-indigo-600/30 data-[highlighted]:text-indigo-200 outline-none">
                            <Select.ItemText>{labels[opt] || opt}</Select.ItemText>
                          </Select.Item>
                        );
                      })}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">{t('agent.channels')}</label>
              <div className="flex flex-wrap gap-2">
                {filteredChannelOptions.map((ch) => {
                  const Icon = ch.icon;
                  const selected = form.channels.includes(ch.key);
                  return (
                    <button
                      type="button"
                      key={ch.key}
                      onClick={() => toggleChannel(ch.key)}
                      className={cn(
                        'flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all',
                        selected
                          ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                          : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/[0.15] hover:text-slate-200'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {ch.labelKey}
                      {selected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
              {errors.channels && <p className="text-xs text-red-400">{errors.channels}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Karşılama Mesajı</label>
              <input
                type="text"
                value={form.greetingMessage}
                onChange={(e) => update('greetingMessage', e.target.value)}
                className={cn(
                  'w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-100 placeholder-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50',
                  errors.greetingMessage ? 'border-red-500/50 bg-red-500/10' : 'border-white/[0.1] bg-white/[0.06]'
                )}
                placeholder="Merhaba! Size nasıl yardımcı olabilirim?"
              />
              {errors.greetingMessage && <p className="text-xs text-red-400">{errors.greetingMessage}</p>}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.06]">
              <Dialog.Close
                type="button"
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] rounded-xl transition-colors"
              >
                {t('common.cancel')}
              </Dialog.Close>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-600/20"
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
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-in fade-in duration-200" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl border border-white/[0.1] p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center shrink-0">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <Dialog.Title className="text-base font-semibold text-white">
                {t('common.delete')}
              </Dialog.Title>
              <p className="text-sm text-slate-500 mt-0.5">
                <strong className="text-slate-300">{agentName}</strong> ajanını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Dialog.Close
              type="button"
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              {t('common.cancel')}
            </Dialog.Close>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('common.delete')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function AgentsPage() {
  const t = useTranslations();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [voices, setVoices] = useState<(Voice & { provider?: string })[]>([]);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [planLimits, setPlanLimits] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentFormData | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testAgent, setTestAgent] = useState<{ id: string; name: string; model?: string | null; voice?: string | null; ttsProvider?: string | null } | null>(null);
  const [testDefaultTab, setTestDefaultTab] = useState<'text' | 'voice'>('text');

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
      const allVoices = data.voices ?? [];
      setVoices(allVoices.map((v: any) => ({
        ...v,
        id: v.id || v.voiceId,
      })));
    } catch {
      // non-critical
    }
  }, []);

  const fetchProviders = useCallback(async () => {
    try {
      const data = await api.getAiProviders();
      setProviders(Array.isArray(data) ? data : data.docs ?? []);
    } catch {
      // non-critical
    }
  }, []);

  const fetchPlanLimits = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/plan-limits');
      if (res.ok) {
        const data = await res.json();
        setPlanLimits(data);
      }
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchProviders();
    fetchVoices();
    fetchPlanLimits();
  }, [fetchAgents, fetchProviders, fetchPlanLimits]);

  const handleCreate = () => {
    setEditingAgent(null);
    setEditingId(null);
    setModalOpen(true);
  };

  const handleEdit = (agent: Agent) => {
    const providerId = typeof agent.provider === 'object' ? (agent.provider as any).id : agent.provider
    setEditingAgent({
      name: agent.name,
      description: agent.description ?? '',
      systemPrompt: agent.systemPrompt ?? '',
      voice: agent.voice ?? '',
      language: agent.language as AgentFormData['language'],
      temperature: agent.temperature,
      channels: agent.channels as AgentFormData['channels'],
      greetingMessage: agent.greetingMessage ?? '',
      status: agent.status as AgentFormData['status'],
      provider: providerId || undefined,
      model: agent.model || undefined,
      ttsProvider: (agent.ttsProvider as 'auto' | 'edge-tts' | 'elevenlabs' | 'piper') || 'auto',
      pitch: typeof (agent as any).pitch === 'number' ? (agent as any).pitch : 0,
      rate: typeof (agent as any).rate === 'number' ? (agent as any).rate : 0,
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
      // Check max agent limit on create
      if (!editingId && planLimits?.maxAgents > 0) {
        const currentCount = agents.length;
        if (currentCount >= planLimits.maxAgents) {
          toast.error(`Plan limit: En fazla ${planLimits.maxAgents} asistan oluşturabilirsiniz. Paket yükseltmek için Faturalandırma sayfasını ziyaret edin.`);
          setSubmitting(false);
          return;
        }
      }

      const voiceName = data.voice;
      const payload = {
        name: data.name,
        description: data.description,
        systemPrompt: data.systemPrompt,
        voice: data.voice,
        voiceName,
        language: data.language.toLowerCase(),
        temperature: data.temperature,
        channels: data.channels,
        greetingMessage: data.greetingMessage,
        status: data.status.toLowerCase(),
        ...(data.provider ? { provider: data.provider } : {}),
        ...(data.model ? { model: data.model } : {}),
        ttsProvider: data.ttsProvider || 'auto',
        pitch: data.pitch ?? 0,
        rate: data.rate ?? 0,
      };
      if (editingId) {
        await api.updateAgent(editingId, payload);
      } else {
        await api.createAgent(payload);
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
          <h1 className="text-2xl font-bold text-white">{t('dashboard.agents')}</h1>
          <p className="text-slate-400 mt-1 text-sm">{t('agent.description')}</p>
        </div>
        <button
          onClick={handleCreate}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-500 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          {t('agent.create')}
        </button>
      </div>

      {loading && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm text-slate-500">{t('common.loading')}</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 flex flex-col items-center justify-center gap-3">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-red-400 font-medium">{error}</p>
          <button
            onClick={fetchAgents}
            className="text-sm text-indigo-400 hover:text-indigo-300 font-medium"
          >
            Tekrar dene
          </button>
        </div>
      )}

      {!loading && !error && agents.length === 0 && (
        <div className="bg-white/[0.03] border border-white/[0.08] border-dashed rounded-2xl p-16 flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 bg-white/[0.05] rounded-2xl flex items-center justify-center">
            <Bot className="w-7 h-7 text-slate-600" />
          </div>
          <p className="text-sm text-slate-500">{t('common.noData')}</p>
          <button
            onClick={handleCreate}
            className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-500 transition-colors"
          >
            {t('agent.create')}
          </button>
        </div>
      )}

      {!loading && !error && agents.length > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">{t('agent.name')}</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider hidden md:table-cell">{t('agent.voice')}</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider hidden lg:table-cell">{t('agent.language')}</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">{t('agent.channels')}</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">{t('agent.status')}</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, i) => (
                  <tr key={agent.id} className={`hover:bg-white/[0.03] transition-colors ${i < agents.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-500/15 rounded-xl flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-slate-200">{agent.name}</span>
                          {agent.description && (
                            <p className="text-xs text-slate-600 mt-0.5 line-clamp-1 max-w-[180px]">{agent.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 hidden md:table-cell">
                      <span>{agent.voiceName || agent.voice || '—'}</span>
                      {agent.ttsProvider && agent.ttsProvider !== 'auto' && (
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">
                          {agent.ttsProvider === 'elevenlabs' ? 'EL' : agent.ttsProvider === 'edge-tts' ? 'Edge' : 'Piper'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs font-medium text-slate-400 bg-white/[0.06] px-2 py-1 rounded-lg">{agent.language}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        {agent.channels.map((ch) => (
                          <span key={ch} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.06] text-slate-400 text-xs" title={ch}>
                            {channelIcons[ch]}
                          </span>
                        ))}
                        {agent.channels.length === 0 && <span className="text-xs text-slate-600">—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', statusColors[agent.status] || 'bg-slate-600')} />
                        <span className="text-sm text-slate-400">{agent.status}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setTestDefaultTab('text'); setTestAgent({ id: agent.id, name: agent.name, voice: agent.voice, ttsProvider: agent.ttsProvider }); }}
                          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                          title="Yazılı Test"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setTestDefaultTab('voice'); setTestAgent({ id: agent.id, name: agent.name, voice: agent.voice, ttsProvider: agent.ttsProvider }); }}
                          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="Sesli Test"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEdit(agent)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors" title="Düzenle">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteClick(agent)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Sil">
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
        providers={providers}
        loading={submitting}
        planLimits={planLimits}
      />

      {testAgent && (
        <AgentTestModal
          agent={testAgent}
          defaultTab={testDefaultTab}
          onClose={() => { setTestAgent(null); setTestDefaultTab('text'); }}
        />
      )}

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
