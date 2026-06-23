'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Phone, Plus, Trash2, X, Loader2, AlertCircle,
  Smartphone, Building2, Globe, Search,
} from 'lucide-react';
import { api } from '@/lib/api';

const typeIcons: Record<string, typeof Smartphone> = {
  mobile: Smartphone,
  landline: Building2,
  tollfree: Globe,
};

const typeColors: Record<string, string> = {
  mobile: 'bg-blue-100 text-blue-700',
  landline: 'bg-purple-100 text-purple-700',
  tollfree: 'bg-amber-100 text-amber-700',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  porting: 'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-700',
};

const providerLabels: Record<string, string> = {
  twilio: 'Twilio',
  zadarma: 'Zadarma',
  asterisk: 'Asterisk',
  own_sip: 'Own SIP',
};

export default function PhoneNumbersPage() {
  const t = useTranslations();
  const [data, setData] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    number: '',
    friendlyName: '',
    type: 'mobile',
    provider: 'twilio',
    isOwnNumber: false,
    forwardTo: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [numRes, agentRes] = await Promise.all([
        api.getPhoneNumbers(),
        api.getAgents(),
      ]);
      setData(numRes.docs || []);
      setAgents(agentRes.docs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load phone numbers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await api.createPhoneNumber({
        number: form.number,
        friendlyName: form.friendlyName,
        type: form.type,
        provider: form.provider,
        isOwnNumber: form.isOwnNumber,
        forwardTo: form.forwardTo || undefined,
      });
      setShowModal(false);
      setForm({ number: '', friendlyName: '', type: 'mobile', provider: 'twilio', isOwnNumber: false, forwardTo: '' });
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create phone number');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deletePhoneNumber(id);
      setDeleteId(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete phone number');
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
        <button onClick={fetchData} className="text-indigo-600 text-sm font-medium hover:text-indigo-800">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.phone')}</h1>
          <p className="text-slate-500 mt-1">Manage your phone numbers</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('phone.addNumber')}
        </button>
      </div>

      {data.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
          <Phone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">{t('common.noData')}</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Number</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Friendly Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Provider</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Forward To</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((item: any) => {
                const TypeIcon = typeIcons[item.type] || Phone;
                return (
                  <tr key={item.id} className="hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-white">{item.number}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">{item.friendlyName || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${typeColors[item.type] || 'bg-slate-800 text-slate-300'}`}>
                        <TypeIcon className="w-3.5 h-3.5" />
                        {item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">{providerLabels[item.provider] || item.provider}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {item.forwardTo && typeof item.forwardTo === 'object' ? (item.forwardTo as any).name : item.forwardTo || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[item.status] || 'bg-slate-800 text-slate-300'}`}>
                        {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : '—'}
                      </span>
                    </td>
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
          <div className="bg-slate-800 rounded-xl w-full max-w-lg mx-4 p-6 shadow-xl border border-slate-700/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">{t('phone.addNumber')}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Number</label>
                <input
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                  placeholder="+90 532 123 45 67"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Friendly Name</label>
                <input
                  value={form.friendlyName}
                  onChange={(e) => setForm({ ...form, friendlyName: e.target.value })}
                  placeholder="Main Line"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                    <option value="mobile">Mobile</option>
                    <option value="landline">Landline</option>
                    <option value="tollfree">Toll Free</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
                  <select
                    value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                    <option value="twilio">Twilio</option>
                    <option value="zadarma">Zadarma</option>
                    <option value="asterisk">Asterisk</option>
                    <option value="own_sip">Own SIP</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isOwnNumber"
                  checked={form.isOwnNumber}
                  onChange={(e) => setForm({ ...form, isOwnNumber: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="isOwnNumber" className="text-sm text-slate-700">{t('phone.ownNumber')}</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Forward To Agent</label>
                <select
                  value={form.forwardTo}
                  onChange={(e) => setForm({ ...form, forwardTo: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="">None</option>
                  {agents.map((agent: any) => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !form.number}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-slate-800 rounded-xl w-full max-w-sm mx-4 p-6 shadow-xl border border-slate-700/50">
            <h2 className="text-lg font-semibold text-white mb-2">Confirm Delete</h2>
            <p className="text-sm text-slate-300 mb-6">Are you sure you want to delete this phone number?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-500 transition-colors"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
