'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  FileText, Plus, Trash2, X, Loader2, AlertCircle,
  File, CheckCircle, Clock, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getUser } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import config from '../../../../../payload.config';
import { getPayload } from 'payload';

const typeIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  txt: File,
  csv: FileText,
  json: File,
  html: FileText,
};

const typeColors: Record<string, string> = {
  pdf: 'bg-red-100 text-red-700',
  docx: 'bg-blue-100 text-blue-700',
  txt: 'bg-slate-100 text-slate-700',
  csv: 'bg-green-100 text-green-700',
  json: 'bg-amber-100 text-amber-700',
  html: 'bg-purple-100 text-purple-700',
};

const statusConfig: Record<string, { icon: typeof Clock; color: string }> = {
  pending: { icon: Clock, color: 'bg-slate-100 text-slate-600' },
  processing: { icon: Loader2, color: 'bg-blue-100 text-blue-700' },
  ready: { icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700' },
  error: { icon: AlertTriangle, color: 'bg-red-100 text-red-700' },
};

export default function TrainingPage() {
  const t = useTranslations();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'pdf',
    description: '',
  });
  const [file, setFile] = useState<File | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getTrainingDocs();
      setData(res.docs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load training documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      
      // Validate user authentication
      const currentUser = getUser();
      if (!currentUser) {
        toast.error('You must be logged in to upload documents');
        return;
      }
      
      // Validate tenant
      if (!currentUser.tenant) {
        toast.error('No tenant associated with your account');
        return;
      }

      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('type', form.type);
      if (form.description) formData.append('description', form.description);
      if (file) formData.append('file', file);
      formData.append('agentId', currentUser.id); // Pass current user ID as agentId
      formData.append('tenantId', currentUser.tenant as string); // Pass tenant ID

      const res = await fetch('/api/training-docs', {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include cookies
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Upload failed');
      }
      
      toast.success('Document uploaded successfully');
      setShowModal(false);
      setForm({ name: '', type: 'pdf', description: '' });
      setFile(null);
      await fetchData();
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTrainingDoc(id);
      toast.success('Document deleted');
      setDeleteId(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete document');
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
        <button onClick={fetchData} className="text-indigo-600 text-sm font-medium hover:text-indigo-800">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.training')}</h1>
          <p className="text-slate-500 mt-1">Manage training documents for your AI agents</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      {data.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">{t('common.noData')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Chunks</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((item: any) => {
                const TypeIcon = typeIcons[item.type] || File;
                const cfg = statusConfig[item.status] || statusConfig.pending;
                const StatusIcon = cfg.icon;
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-900">{item.name}</span>
                      {item.description && (
                        <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${typeColors[item.type] || 'bg-slate-100 text-slate-600'}`}>
                        <TypeIcon className="w-3.5 h-3.5" />
                        {item.type ? item.type.toUpperCase() : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                        {item.status === 'processing' ? (
                          <StatusIcon className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <StatusIcon className="w-3.5 h-3.5" />
                        )}
                        {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{item.chunkCount ?? item.vectorCount ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{item.createdAt ? formatDate(item.createdAt) : '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setDeleteId(item.id)}
                        className="text-red-400 hover:text-red-600 transition-colors p-1"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Upload Document</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Product Knowledge Base"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="pdf">PDF</option>
                  <option value="docx">DOCX</option>
                  <option value="txt">TXT</option>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="html">HTML</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">File</label>
                <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-slate-300 rounded-lg px-4 py-6 cursor-pointer hover:border-indigo-400 transition-colors">
                  <FileText className="w-8 h-8 text-slate-400 mb-2" />
                  {file ? (
                    <span className="text-sm text-indigo-600 font-medium">{file.name}</span>
                  ) : (
                    <>
                      <span className="text-sm text-slate-500">Click to select a file</span>
                      <span className="text-xs text-slate-400 mt-1">PDF, DOCX, TXT, CSV, JSON, HTML</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    accept=".pdf,.docx,.txt,.csv,.json,.html"
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !form.name || !file}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Confirm Delete</h2>
            <p className="text-sm text-slate-600 mb-6">Are you sure you want to delete this document?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={() => handleDelete(deleteId)} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-500 transition-colors">
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
