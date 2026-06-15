'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Plus, Pencil, Trash2, X, Loader2, AlertCircle, QrCode, Smartphone, RefreshCw,
} from 'lucide-react';

type WhatsAppAccount = {
  id: string;
  name: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  connectionType: 'cloud_api' | 'qr';
  isActive: boolean;
  qrStatus: string | null;
  qrCodeData: string | null;
};

export default function WhatsAppAccountsPage() {
  const t = useTranslations();
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [qrSessionId, setQrSessionId] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    phoneNumberId: '',
    businessAccountId: '',
    accessToken: '',
    webhookVerifyToken: '',
    displayPhoneNumber: '',
    connectionType: 'cloud_api' as 'cloud_api' | 'qr',
  });

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getWhatsAppAccounts();
      setAccounts(res.docs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const resetForm = () => {
    setForm({ name: '', phoneNumberId: '', businessAccountId: '', accessToken: '', webhookVerifyToken: '', displayPhoneNumber: '', connectionType: 'cloud_api' });
    setEditingId(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (acc: WhatsAppAccount) => {
    setForm({
      name: acc.name,
      phoneNumberId: acc.phoneNumberId,
      businessAccountId: (acc as any).businessAccountId || '',
      accessToken: '',
      webhookVerifyToken: '',
      displayPhoneNumber: acc.displayPhoneNumber || '',
      connectionType: acc.connectionType,
    });
    setEditingId(acc.id);
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      if (editingId) {
        await fetch(`/api/whatsapp/accounts/${editingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
          credentials: 'include',
        });
        toast.success('Account updated');
      } else {
        await fetch('/api/whatsapp/accounts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
          credentials: 'include',
        });
        toast.success('Account created');
      }
      setDialogOpen(false);
      resetForm();
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const toggleAccount = async (id: string) => {
    try {
      await fetch(`/api/whatsapp/accounts/${id}/toggle`, {
        method: 'PATCH', credentials: 'include',
      });
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle');
    }
  };

  const deleteAccount = async (id: string) => {
    if (!confirm('Delete this account?')) return;
    try {
      await fetch(`/api/whatsapp/accounts/${id}`, {
        method: 'DELETE', credentials: 'include',
      });
      toast.success('Account deleted');
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const startQr = async (id: string) => {
    setQrLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/accounts/${id}/qr`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
        credentials: 'include',
      });
      const data = await res.json();
      setQrCode(data.qrCode || '');
      setQrSessionId(data.sessionId || '');
      setQrDialogOpen(true);
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to start QR');
    } finally {
      setQrLoading(false);
    }
  };

  const disconnectQr = async (id: string) => {
    try {
      await fetch(`/api/whatsapp/accounts/${id}/qr`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
        credentials: 'include',
      });
      toast.success('QR disconnected');
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect');
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
        <button onClick={fetchAccounts} className="text-indigo-600 text-sm font-medium hover:text-indigo-800">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp Accounts</h1>
          <p className="text-slate-500 mt-1">Manage WhatsApp Business accounts and QR connections</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Smartphone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">No WhatsApp accounts configured</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Phone Number ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">QR</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 text-sm font-medium text-slate-900">{acc.name}</td>
                  <td className="px-4 py-4 text-sm text-slate-600">{acc.phoneNumberId}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${acc.connectionType === 'qr' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {acc.connectionType === 'qr' ? <QrCode className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                      {acc.connectionType === 'qr' ? 'QR Bridge' : 'Cloud API'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button onClick={() => toggleAccount(acc.id)} className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${acc.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {acc.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    {acc.connectionType === 'qr' ? (
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${acc.qrStatus === 'connected' ? 'text-emerald-600' : acc.qrStatus === 'connecting' ? 'text-amber-600' : 'text-slate-500'}`}>
                          {acc.qrStatus || 'idle'}
                        </span>
                        {acc.qrStatus !== 'connected' ? (
                          <button onClick={() => startQr(acc.id)} className="text-indigo-600 hover:text-indigo-800" title="Start QR">
                            <QrCode className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => disconnectQr(acc.id)} className="text-red-500 hover:text-red-700" title="Disconnect">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(acc)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteAccount(acc.id)} className="text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl p-6 w-full max-w-lg z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Close className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </Dialog.Close>
            <Dialog.Title className="text-lg font-bold text-slate-900 mb-4">{editingId ? 'Edit Account' : 'Add Account'}</Dialog.Title>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="My WhatsApp Account" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Connection Type</label>
                <select value={form.connectionType} onChange={e => setForm({ ...form, connectionType: e.target.value as any })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="cloud_api">Cloud API (Meta)</option>
                  <option value="qr">QR Bridge (Evolution API)</option>
                </select>
              </div>

              {form.connectionType === 'cloud_api' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number ID *</label>
                    <input value={form.phoneNumberId} onChange={e => setForm({ ...form, phoneNumberId: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Account ID</label>
                    <input value={form.businessAccountId} onChange={e => setForm({ ...form, businessAccountId: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Access Token</label>
                    <input type="password" value={form.accessToken} onChange={e => setForm({ ...form, accessToken: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder={editingId ? '(unchanged)' : ''} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Webhook Verify Token</label>
                    <input value={form.webhookVerifyToken} onChange={e => setForm({ ...form, webhookVerifyToken: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Display Phone Number</label>
                    <input value={form.displayPhoneNumber} onChange={e => setForm({ ...form, displayPhoneNumber: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Dialog.Close className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancel</Dialog.Close>
                <button onClick={save} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl p-6 w-full max-w-md z-50">
            <Dialog.Close className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </Dialog.Close>
            <Dialog.Title className="text-lg font-bold text-slate-900 mb-4 text-center">Scan QR Code</Dialog.Title>
            {qrLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : (
              <div className="text-center space-y-4">
                <p className="text-sm text-slate-500">Scan this QR code with WhatsApp to connect</p>
                {qrCode ? (
                  <div className="bg-white p-4 rounded-lg border inline-block">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCode)}`} alt="QR Code" className="mx-auto" />
                  </div>
                ) : (
                  <p className="text-sm text-amber-600">QR code not available. Please try again.</p>
                )}
                <p className="text-xs text-slate-400">Session: {qrSessionId}</p>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
