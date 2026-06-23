'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Mic,
  Volume2,
  Database,
  HardDrive,
  Cpu,
  CreditCard,
  Phone,
  Globe,
  Server,
} from 'lucide-react';

interface TestResult {
  status: 'healthy' | 'degraded' | 'error' | 'not_configured' | 'configured';
  detail: string;
  durationMs: number;
}

interface Results {
  [key: string]: TestResult;
}

interface ServiceGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  services: { key: string; label: string }[];
}

export default function AdminDiagnosticsPage() {
  const t = useTranslations();
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingTypes, setTestingTypes] = useState<Set<string>>(new Set());

  const serviceGroups: ServiceGroup[] = [
    {
      key: 'media',
      label: 'Ses Servisleri',
      icon: <Mic className="w-5 h-5" />,
      services: [
        { key: 'tts', label: 'Piper TTS (Metin → Ses)' },
        { key: 'stt', label: 'Whisper STT (Ses → Metin)' },
      ],
    },
    {
      key: 'ai',
      label: 'Yapay Zeka Servisleri',
      icon: <Cpu className="w-5 h-5" />,
      services: [
        { key: 'openai', label: 'OpenAI' },
        { key: 'anthropic', label: 'Anthropic (Claude)' },
        { key: 'stripe', label: 'Stripe (Ödeme)' },
        { key: 'twilio', label: 'Twilio (Telefon)' },
      ],
    },
    {
      key: 'infra',
      label: 'Altyapı',
      icon: <Server className="w-5 h-5" />,
      services: [
        { key: 'database', label: 'PostgreSQL (Veritabanı)' },
        { key: 'redis', label: 'Redis (Önbellek)' },
      ],
    },
  ];

  async function runTest(type: string) {
    setTestingTypes(prev => new Set(prev).add(type));
    setError(null);

    try {
      if (type === 'all') {
        setResults(null);
      }
      const res = await fetch(`/api/admin/diagnostics?type=${type}`, { cache: 'no-store' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      setResults(prev => ({ ...prev, ...data.results }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test başarısız');
    } finally {
      setTestingTypes(prev => {
        const next = new Set(prev);
        next.delete(type);
        return next;
      });
    }
  }

  function runAllTests() {
    runTest('all');
  }

  function isTesting(type: string): boolean {
    return testingTypes.has(type);
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'healthy':
      case 'configured':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'not_configured':
        return <AlertTriangle className="w-5 h-5 text-slate-400" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-slate-300" />;
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'healthy':
      case 'configured':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'degraded':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'not_configured':
        return 'text-slate-500 bg-slate-50 border-slate-200';
      default:
        return 'text-slate-400 bg-slate-50 border-slate-200';
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'healthy': return 'Sağlıklı';
      case 'configured': return 'Yapılandırılmış';
      case 'degraded': return 'Zayıf';
      case 'error': return 'Hata';
      case 'not_configured': return 'Yapılandırılmamış';
      default: return 'Beklemede';
    }
  }

  function formatDuration(ms: number): string {
    if (ms === 0) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function hasResult(type: string): boolean {
    return results !== null && type in results;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sistem Testleri</h1>
          <p className="text-slate-500 mt-1">TTS, STT, yapay zeka ve altyapı servislerini test edin</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runAllTests}
            disabled={isTesting('all')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            {isTesting('all') ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isTesting('all') ? 'Test Ediliyor...' : 'Tümünü Test Et'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {serviceGroups.map(group => (
          <div key={group.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">{group.icon}</span>
                <h2 className="font-semibold text-slate-900">{group.label}</h2>
              </div>
              <button
                onClick={() => runTest(group.key === 'media' ? 'tts' : group.services[0].key)}
                disabled={isTesting(group.key)}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium disabled:opacity-50"
              >
                {isTesting(group.key) ? 'Test ediliyor...' : 'Tümünü test et'}
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {group.services.map(svc => (
                <div key={svc.key} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {hasResult(svc.key) ? getStatusIcon(results![svc.key].status) : <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                      <span className="text-sm font-medium text-slate-700">{svc.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasResult(svc.key) && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getStatusColor(results![svc.key].status)}`}>
                          {getStatusLabel(results![svc.key].status)}
                        </span>
                      )}
                      <button
                        onClick={() => runTest(svc.key)}
                        disabled={isTesting(svc.key)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors"
                        title={`Test ${svc.label}`}
                      >
                        {isTesting(svc.key) ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  {hasResult(svc.key) && (
                    <div className="flex items-center justify-between text-xs text-slate-400 ml-7">
                      <span className="truncate max-w-[70%]">{results![svc.key].detail}</span>
                      <span className="shrink-0 ml-2">{formatDuration(results![svc.key].durationMs)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {results && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Test Özeti</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(results).map(([key, result]) => (
              <div key={key} className={`p-3 rounded-lg border ${getStatusColor(result.status)}`}>
                <div className="text-xs font-medium uppercase tracking-wide mb-1">{key}</div>
                <div className="text-lg font-bold">{getStatusLabel(result.status)}</div>
                <div className="text-xs mt-1 opacity-75">{formatDuration(result.durationMs)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!results && !error && (
        <div className="text-center py-16 text-slate-400">
          <Play className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium text-slate-500">Henüz test yapılmadı</p>
          <p className="text-sm mt-1">Tüm servisleri test etmek için &quot;Tümünü Test Et&quot; butonuna tıklayın</p>
        </div>
      )}
    </div>
  );
}
