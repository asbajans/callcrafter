'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { Play, Square, Volume2, Upload, Loader2, AlertCircle } from 'lucide-react';
import { DEFAULT_VOICES, type Voice } from '@/lib/voices';
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

export default function VoicesPage() {
  const t = useTranslations();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [customVoices, setCustomVoices] = useState<Voice[]>([]);
  const [uploading, setUploading] = useState(false);

  const grouped = LANG_ORDER.map(lang => ({
    lang,
    label: LANG_LABELS[lang] || lang,
    voices: [...DEFAULT_VOICES.filter(v => v.language === lang), ...customVoices.filter(v => v.language === lang)],
  })).filter(g => g.voices.length > 0);

  async function handlePlay(voiceId: string) {
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
      const res = await fetch(`/api/voices/tts?voice=${encodeURIComponent(voiceId)}&text=${encodeURIComponent('Merhaba, bu bir ses testidir.')}`);
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
        Yüklediğiniz ses modelleri Piper formatında (.onnx) olmalıdır. İlgili .json config dosyası aynı isimle eklenmelidir.
      </div>

      {grouped.map(group => (
        <div key={group.lang}>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">{group.lang}</span>
            {group.label}
            <span className="text-xs text-slate-600 font-normal">({group.voices.length} ses)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.voices.map(voice => (
              <div
                key={voice.id}
                className={cn(
                  'bg-white/[0.04] border rounded-xl p-4 transition-all',
                  voice.builtIn ? 'border-white/[0.08]' : 'border-indigo-500/30 bg-indigo-500/5'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="text-sm font-medium text-slate-200 truncate">{voice.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-medium text-slate-500 bg-white/[0.06] px-1.5 py-0.5 rounded">{voice.language}</span>
                      {voice.gender && (
                        <span className="text-[10px] text-slate-600">{voice.gender}</span>
                      )}
                      {!voice.builtIn && (
                        <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">Özel</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handlePlay(voice.id)}
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
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
