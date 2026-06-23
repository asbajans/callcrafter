'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus, Trash2, X, Loader2, AlertCircle, Signal,
  Activity, CheckCircle, AlertTriangle, XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const providerLabels: Record<string, string> = {
  twilio: 'Twilio',
  zadarma: 'Zadarma',
  asterisk: 'Asterisk',
  generic: 'Generic',
};

const statusConfig: Record<string, { icon: typeof Activity; color: string; label: string }> = {
  active: { icon: CheckCircle, color: 'text-emerald-500', label: 'Active' },
  error: { icon: XCircle, color: 'text-red-500', label: 'Error' },
  testing: { icon: AlertTriangle, color: 'text-amber-500', label: 'Testing' },
};

export default function TrunkPage() {
  const t = useTranslations();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    provider: 'twilio',
    type: 'ours',
    sipServer: '',
    sipPort: '5060',
    username: '',
    password: '',
    codecs: '["PCMA","PCMU","G729"]',
    amiHost: '',
    amiPort: '5038',
    amiUser: 'admin',
    amiSecret: 'admin',
    agentExtensions: '1000,1001,1002,1003',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getSipTrunks();
      setData(res.docs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load SIP trunks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      const credentials: Record<string, string> = {
        sipServer: form.sipServer,
        sipPort: form.sipPort,
        username: form.username,
        password: form.password,
      }

      if (form.provider === 'asterisk') {
        credentials.ASTERISK_HOST = form.amiHost
        credentials.ASTERISK_AMI_PORT = form.amiPort
        credentials.AMI_USER = form.amiUser
        credentials.AMI_SECRET = form.amiSecret
        credentials.AGENT_EXTENSIONS = form.agentExtensions
        credentials.OUTBOUND_CONTEXT = 'outbound-trunk'
        credentials.SIP_ENDPOINT = 'voip'
        credentials.RECORD_CALLS = 'true'
        credentials.DEFAULT_AGENT_EXTENSION = '1000'
      }

      await api.createSipTrunk({
        name: form.name,
        provider: form.provider,
        type: form.type,
        credentials,
        codecs: JSON.parse(form.codecs || '[]'),
      });
      setShowModal(false);
      setForm({ name: '', provider: 'twilio', type: 'ours', sipServer: '', sipPort: '5060', username: '', password: '', codecs: '["PCMA","PCMU","G729"]', amiHost: '', amiPort: '5038', amiUser: 'admin', amiSecret: 'admin', agentExtensions: '1000,1001,1002,1003' });
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create trunk');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteSipTrunk(id);
      setDeleteId(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete trunk');
    }
  };

  const parseCodecs = (codecs: any): string[] => {
    if (Array.isArray(codecs)) return codecs;
    if (typeof codecs === 'string') try { return JSON.parse(codecs); } catch { return []; }
    return [];
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
        <button onClick={fetchData} className="text-indigo-600 text-sm font-medium hover:text-indigo-800">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.trunk')}</h1>
          <p className="text-slate-500 mt-1">Manage your SIP trunks</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Trunk
        </button>
      </div>

      {data.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
          <Signal className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">{t('common.noData')}</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Provider</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Last Health Check</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((item: any) => {
                const cfg = statusConfig[item.status] || statusConfig.error;
                const StatusIcon = cfg.icon;
                return (
                  <tr key={item.id} className="hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-white">{item.name}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">{providerLabels[item.provider] || item.provider}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800 text-slate-700">
                        {item.type === 'ours' ? 'Ours' : 'Own'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
                        <span className="text-sm text-slate-300">{cfg.label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {item.lastHealthCheck ? formatDate(item.lastHealthCheck) : 'Never'}
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
              <h2 className="text-lg font-semibold text-white">Add SIP Trunk</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="My SIP Trunk"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                    <option value="generic">Generic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                    <option value="ours">Ours</option>
                    <option value="own">Own</option>
                  </select>
                </div>
              </div>
              <div className="border-t border-slate-700/50 pt-4">
                <h3 className="text-sm font-medium text-slate-700 mb-3">Credentials</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">SIP Server</label>
                    <input
                      value={form.sipServer}
                      onChange={(e) => setForm({ ...form, sipServer: e.target.value })}
                      placeholder="sip.example.com"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">SIP Port</label>
                    <input
                      value={form.sipPort}
                      onChange={(e) => setForm({ ...form, sipPort: e.target.value })}
                      placeholder="5060"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                    <input
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder="user"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Codecs</label>
                <input
                  value={form.codecs}
                  onChange={(e) => setForm({ ...form, codecs: e.target.value })}
                  placeholder='["PCMA","PCMU","G729"]'
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              {form.provider === 'asterisk' && (
                <div className="border-t border-slate-700/50 pt-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Asterisk AMI Settings</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">AMI Host</label>
                      <input value={form.amiHost} onChange={(e) => setForm({ ...form, amiHost: e.target.value })} placeholder="127.0.0.1" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">AMI Port</label>
                      <input value={form.amiPort} onChange={(e) => setForm({ ...form, amiPort: e.target.value })} placeholder="5038" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">AMI Username</label>
                      <input value={form.amiUser} onChange={(e) => setForm({ ...form, amiUser: e.target.value })} placeholder="admin" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">AMI Secret</label>
                      <input type="password" value={form.amiSecret} onChange={(e) => setForm({ ...form, amiSecret: e.target.value })} placeholder="admin" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Agent Extensions</label>
                      <input value={form.agentExtensions} onChange={(e) => setForm({ ...form, agentExtensions: e.target.value })} placeholder="1000,1001,1002,1003" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                      <p className="text-xs text-slate-400 mt-1">Comma-separated list of agent extension numbers</p>
                    </div>
                  </div>
                </div>
              )}
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
                disabled={submitting || !form.name}
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
            <p className="text-sm text-slate-300 mb-6">Are you sure you want to delete this SIP trunk?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
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
