'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { Play, Square, Volume2, Upload, Loader2, AlertCircle } from 'lucide-react';
import { type Voice } from '@/lib/voices';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const LANG_LABELS: Record<string, string> = {
  EN: 'English',
  TR: 'Türkçe',
  DE: 'Deutsch',
  FR: 'Français',
  ES: 'Español',
};

const LANG_ORDER = ['TR', 'EN', 'DE', 'FR', 'ES'];

type ApiVoice = { id: string; name: string; language: string | null; gender: string | null; provider: string; previewUrl?: string | null };

export default function VoicesPage() {
  const t = useTranslations();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [customVoices, setCustomVoices] = useState<Voice[]>([]);
  const [uploading, setUploading] = useState(false);
  const [apiVoices, setApiVoices] = useState<ApiVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);

  const fetchAllVoices = useCallback(async () => {
    setLoadingVoices(true);
    try {
      const data = await api.getVoices();
      setApiVoices(data.voices ?? []);
    } catch {
      // fallback to empty
    } finally {
      setLoadingVoices(false);
    }
  }, []);

  useEffect(() => {
    fetchAllVoices();
  }, [fetchAllVoices]);

  const allVoices: ApiVoice[] = [
    ...apiVoices,
    ...customVoices.map(v => ({ id: v.id, name: v.name, language: v.language, gender: v.gender || null, provider: 'piper' as const })),
  ];

  const grouped = LANG_ORDER.map(lang => ({
    lang,
    label: LANG_LABELS[lang] || lang,
    voices: allVoices.filter(v => (v.language || '').toUpperCase() === lang),
  })).filter(g => g.voices.length > 0);

  const ungrouped = allVoices.filter(v => !LANG_ORDER.includes((v.language || '').toUpperCase()));

  async function handlePlay(voiceId: string, provider?: string) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playing === voiceId) {
      setPlaying(null);
      return;
    }
    setLoadingVoice(voiceId);
    try {
      const testText = voiceId.startsWith('tr-') || voiceId.startsWith('tr_')
        ? 'Merhaba, bu bir ses testidir. CallCrafter yapay zeka asistanı size nasıl yardımcı olabilir?'
        : 'Hello, this is a voice test. How can CallCrafter AI assistant help you today?';
      const providerParam = provider ? `&provider=${encodeURIComponent(provider)}` : '';
      const res = await fetch(`/api/voices/tts?voice=${encodeURIComponent(voiceId)}&text=${encodeURIComponent(testText)}${providerParam}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Ses alınamadı' }));
        toast.error(err.error || 'Ses testi başarısız');
        setLoadingVoice(null);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setPlaying(voiceId);
      setLoadingVoice(null);
      audio.onended = () => {
        setPlaying(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        toast.error('Ses oynatılamadı');
        setPlaying(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (err: any) {
      toast.error(err.message);
      setPlaying(null);
      setLoadingVoice(null);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'onnx' && ext !== 'json') {
      toast.error('Sadece .onnx ve .json dosyaları yüklenebilir');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/voices/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      const data = await res.json();
      const newVoice: Voice = {
        id: data.voiceId || file.name.replace(/\.(onnx|json)$/, ''),
        name: data.displayName || file.name.replace(/\.(onnx|json)$/, '').replace(/[-_]/g, ' '),
        language: data.language || 'EN',
        builtIn: false,
        modelFile: file.name,
      };
      setCustomVoices(prev => [...prev, newVoice]);
      toast.success(`Ses modeli yüklendi: ${newVoice.name}`);
    } catch (err: any) {
      toast.error(`Yükleme başarısız: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function providerBadge(provider: string) {
    if (provider === 'edge-tts') return <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Edge TTS</span>;
    if (provider === 'elevenlabs') return <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">ElevenLabs</span>;
    return <span className="text-[10px] font-medium text-slate-500 bg-white/[0.06] px-1.5 py-0.5 rounded">Piper</span>;
  }

  function renderVoiceCard(voice: ApiVoice) {
    return (
      <div
        key={voice.id}
        className={cn(
          'bg-white/[0.04] border rounded-xl p-4 transition-all',
          voice.provider === 'edge-tts' ? 'border-emerald-500/20' : voice.provider === 'elevenlabs' ? 'border-amber-500/20' : 'border-white/[0.08]'
        )}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Volume2 className={cn('w-4 h-4 shrink-0', voice.provider === 'edge-tts' ? 'text-emerald-400' : voice.provider === 'elevenlabs' ? 'text-amber-400' : 'text-indigo-400')} />
              <span className="text-sm font-medium text-slate-200 truncate">{voice.name}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-medium text-slate-500 bg-white/[0.06] px-1.5 py-0.5 rounded">{voice.language || '—'}</span>
              {voice.gender && (
                <span className="text-[10px] text-slate-600">{voice.gender}</span>
              )}
              {providerBadge(voice.provider)}
            </div>
          </div>
          <button
            onClick={() => handlePlay(voice.id, voice.provider)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors shrink-0 ml-2"
            title={playing === voice.id ? 'Durdur' : 'Test et'}
          >
            {loadingVoice === voice.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : playing === voice.id ? (
              <Square className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[11px] text-slate-600 font-mono truncate">{voice.id}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ses Kütüphanesi</h1>
          <p className="text-slate-400 mt-1 text-sm">Kullanılabilir sesleri görüntüleyin ve yeni ses modelleri yükleyin</p>
        </div>
        <label className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-500 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Yükleniyor...' : 'Ses Yükle'}
          <input type="file" accept=".onnx,.json" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      <div className="text-xs text-slate-500 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        Piper sesleri self-hosted'dir. Edge TTS ve ElevenLabs bulut servisleridir. Yükleme sadece Piper formatında (.onnx) mümkündür.
      </div>

      {loadingVoices ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="ml-2 text-slate-400 text-sm">Sesler yükleniyor...</span>
        </div>
      ) : (
        <>
          {grouped.map(group => (
            <div key={group.lang}>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">{group.lang}</span>
                {group.label}
                <span className="text-xs text-slate-600 font-normal">({group.voices.length} ses)</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.voices.map(renderVoiceCard)}
              </div>
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-slate-500/20 text-slate-400 flex items-center justify-center text-xs font-bold">?</span>
                Diğer
                <span className="text-xs text-slate-600 font-normal">({ungrouped.length} ses)</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ungrouped.map(renderVoiceCard)}
              </div>
            </div>
          )}
          {allVoices.length === 0 && (
            <div className="text-center py-12 text-slate-500">Hiç ses bulunamadı</div>
          )}
        </>
      )}
    </div>
  );
}
