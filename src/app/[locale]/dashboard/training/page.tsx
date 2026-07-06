'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  FileText, Plus, Trash2, X, Loader2, AlertCircle,
  File, CheckCircle, Clock, AlertTriangle, Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const typeIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  txt: File,
  csv: FileText,
  json: File,
  html: FileText,
};

const typeColors: Record<string, string> = {
  pdf: 'bg-red-500/10 text-red-400',
  docx: 'bg-blue-500/10 text-blue-400',
  txt: 'bg-slate-500/10 text-slate-400',
  csv: 'bg-green-500/10 text-green-400',
  json: 'bg-amber-500/10 text-amber-400',
  html: 'bg-purple-500/10 text-purple-400',
};

const statusConfig: Record<string, { icon: typeof Clock; color: string }> = {
  pending: { icon: Clock, color: 'bg-slate-500/10 text-slate-400' },
  processing: { icon: Loader2, color: 'bg-blue-500/10 text-blue-400' },
  ready: { icon: CheckCircle, color: 'bg-emerald-500/10 text-emerald-400' },
  error: { icon: AlertTriangle, color: 'bg-red-500/10 text-red-400' },
};

export default function TrainingPage() {
  const t = useTranslations();
  const [data, setData] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'txt',
    description: '',
    agentId: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/dashboard/documents');
      if (res.ok) {
        const d = await res.json();
        setData(d.documents || []);
      } else {
        const docs = await api.getTrainingDocs();
        setData(docs.docs || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load training documents');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await api.getAgents();
      setAgents(res.docs || []);
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    fetchData();
    fetchAgents();
  }, []);

  const handleCreate = async () => {
    try {
      setSubmitting(true);

      if (!form.name.trim()) {
        toast.error('Döküman adı gerekli');
        return;
      }

      let bodyText = textContent.trim()
      let docType = form.type

      let isBase64 = false
      if (file) {
        const isPdf = file.name.toLowerCase().endsWith('.pdf')
        docType = isPdf ? 'pdf' : 'txt'
        if (isPdf) {
          const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as ArrayBuffer)
            reader.onerror = reject
            reader.readAsArrayBuffer(file)
          })
          const bytes = new Uint8Array(buf)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
          bodyText = btoa(binary)
          isBase64 = true
        } else {
          bodyText = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsText(file)
          })
        }
      }

      if (!bodyText) {
        toast.error('Metin içeriği gerekli');
        return;
      }

      const payload: Record<string, any> = {
        name: form.name,
        type: docType,
        text: bodyText,
      }
      if (isBase64) payload.isBase64 = true
      if (form.agentId) payload.agentId = form.agentId

      const res = await fetch('/api/dashboard/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Yükleme başarısız');
      }

      toast.success('Döküman başarıyla yüklendi');
      setShowModal(false);
      setForm({ name: '', type: 'txt', description: '', agentId: '' });
      setFile(null);
      setTextContent('');
      await fetchData();
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Döküman yüklenirken hata oluştu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/dashboard/documents?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      toast.success('Döküman silindi');
      setDeleteId(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Döküman silinirken hata oluştu');
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
        <p className="text-slate-300">{error}</p>
        <button onClick={fetchData} className="text-indigo-400 text-sm font-medium hover:text-indigo-300">Tekrar Dene</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.training')}</h1>
          <p className="text-slate-500 mt-1">AI asistanlarınız için eğitim dökümanlarını yönetin</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-500 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Döküman Yükle
        </button>
      </div>

      {data.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Henüz döküman yüklenmemiş</p>
        </div>
      ) : (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Ad</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Tür</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Asistan</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Durum</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Oluşturulma</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {data.map((item: any) => {
                const TypeIcon = typeIcons[item.type] || File;
                const cfg = statusConfig[item.status] || statusConfig.pending;
                const StatusIcon = cfg.icon;
                return (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <span className="text-sm font-medium text-white">{item.name}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${typeColors[item.type] || 'bg-slate-500/10 text-slate-400'}`}>
                        <TypeIcon className="w-3.5 h-3.5" />
                        {item.type ? item.type.toUpperCase() : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {item.agentName ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-300">
                          <Bot className="w-3.5 h-3.5 text-indigo-400" />
                          {item.agentName}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                        {item.status === 'processing' ? (
                          <StatusIcon className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <StatusIcon className="w-3.5 h-3.5" />
                        )}
                        {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">{item.createdAt ? formatDate(item.createdAt) : '—'}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setDeleteId(item.id)}
                        className="text-red-400 hover:text-red-300 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl w-full max-w-lg mx-4 p-6 shadow-xl border border-white/[0.1]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Döküman Yükle</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Döküman Adı</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ürün Bilgi Bankası"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.1] bg-white/[0.06] text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Asistan (isteğe bağlı)</label>
                <select
                  value={form.agentId}
                  onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.1] bg-white/[0.06] text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                >
                  <option value="">Asistan seçilmedi</option>
                  {agents.map((agent: any) => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-600 mt-1">Seçilen asistana ElevenLabs üzerinde otomatik bağlanır</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Dosya</label>
                <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-white/[0.1] rounded-xl px-4 py-6 cursor-pointer hover:border-indigo-500/50 transition-colors bg-white/[0.03]">
                  <FileText className="w-8 h-8 text-slate-500 mb-2" />
                  {file ? (
                    <span className="text-sm text-indigo-400 font-medium">{file.name}</span>
                  ) : (
                    <>
                      <span className="text-sm text-slate-500">Dosya seçmek için tıklayın</span>
                      <span className="text-xs text-slate-600 mt-1">TXT, CSV, JSON, HTML, PDF</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    accept=".txt,.csv,.json,.html,.pdf"
                  />
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">veya Metin İçeriği</label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Metin içeriğini buraya yapıştırın..."
                  rows={4}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.1] bg-white/[0.06] text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !form.name.trim() || (!file && !textContent.trim())}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Yükle
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl w-full max-w-sm mx-4 p-6 shadow-xl border border-white/[0.1]">
            <h2 className="text-lg font-semibold text-white mb-2">Dökümanı Sil</h2>
            <p className="text-sm text-slate-400 mb-6">Bu dökümanı silmek istediğinize emin misiniz?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
                İptal
              </button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors">
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
