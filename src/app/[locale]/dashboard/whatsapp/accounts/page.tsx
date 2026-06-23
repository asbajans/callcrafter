'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Plus, Pencil, Trash2, X, Loader2, AlertCircle, QrCode,
  Smartphone, RefreshCw, Wifi, WifiOff, ChevronRight,
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
  const [savingId, setSavingId] = useState<string | null>(null);

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
        toast.success('Hesap güncellendi');
      } else {
        await fetch('/api/whatsapp/accounts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
          credentials: 'include',
        });
        toast.success('Hesap oluşturuldu');
      }
      setDialogOpen(false);
      resetForm();
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || 'Kaydedilemedi');
    }
  };

  const toggleAccount = async (id: string) => {
    setSavingId(id);
    try {
      await fetch(`/api/whatsapp/accounts/${id}/toggle`, {
        method: 'PATCH', credentials: 'include',
      });
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || 'Güncellenemedi');
    } finally {
      setSavingId(null);
    }
  };

  const deleteAccount = async (id: string) => {
    if (!confirm('Bu hesabı silmek istediğinizden emin misiniz?')) return;
    try {
      const res = await fetch(`/api/whatsapp/accounts/${id}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Silinemedi' }));
        throw new Error(err.error || 'Silinemedi');
      }
      toast.success('Hesap silindi');
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || 'Silinemedi');
    }
  };

  const startQr = async (id: string) => {
    setQrLoading(true);
    setQrCode('');
    setQrDialogOpen(true);
    try {
      const res = await fetch(`/api/whatsapp/accounts/${id}/qr`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
        credentials: 'include',
      });
      const data = await res.json();
      setQrCode(data.qrCode || '');
      setQrSessionId(data.sessionId || '');
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || 'QR başlatılamadı');
      setQrDialogOpen(false);
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
      toast.success('Bağlantı kesildi');
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || 'Bağlantı kesilemedi');
    }
  };

  const getQrStatusStyle = (status: string | null) => {
    switch (status) {
      case 'connected': return { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Bağlı' };
      case 'connecting': return { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400', label: 'Bağlanıyor' };
      case 'qr_pending': return { dot: 'bg-indigo-400 animate-pulse', text: 'text-indigo-400', label: 'QR Bekliyor' };
      default: return { dot: 'bg-slate-600', text: 'text-slate-500', label: status || 'Bağlı Değil' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7 text-red-400" />
        </div>
        <p className="text-slate-400 mb-4">{error}</p>
        <button onClick={fetchAccounts} className="text-indigo-400 text-sm font-medium hover:text-indigo-300 transition-colors">
          Tekrar dene
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm">{accounts.length} hesap yapılandırılmış</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAccounts}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            Hesap Ekle
          </button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.08] border-dashed rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-white/[0.05] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-slate-300 font-medium mb-1">Henüz hesap yok</h3>
          <p className="text-slate-500 text-sm mb-5">WhatsApp Business hesabı ekleyerek mesajlaşmaya başlayın.</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            İlk Hesabı Ekle
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {accounts.map((acc) => {
            const qrStyle = getQrStatusStyle(acc.qrStatus);
            return (
              <div
                key={acc.id}
                className="bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors"
              >
                {/* Icon */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  acc.connectionType === 'qr' ? 'bg-green-500/15' : 'bg-blue-500/15'
                }`}>
                  {acc.connectionType === 'qr'
                    ? <QrCode className="w-5 h-5 text-green-400" />
                    : <Smartphone className="w-5 h-5 text-blue-400" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-200">{acc.name}</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      acc.connectionType === 'qr' ? 'bg-green-500/15 text-green-400' : 'bg-blue-500/15 text-blue-400'
                    }`}>
                      {acc.connectionType === 'qr' ? 'QR Bridge' : 'Cloud API'}
                    </span>
                    {acc.connectionType === 'qr' && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
                        <span className={`w-1.5 h-1.5 rounded-full ${qrStyle.dot}`} />
                        <span className={qrStyle.text}>{qrStyle.label}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {acc.displayPhoneNumber || acc.phoneNumberId || '—'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {/* Active toggle */}
                  <button
                    onClick={() => toggleAccount(acc.id)}
                    disabled={savingId === acc.id}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all border ${
                      acc.isActive
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25'
                        : 'bg-white/[0.05] text-slate-500 border-white/[0.08] hover:bg-white/[0.08] hover:text-slate-300'
                    }`}
                  >
                    {savingId === acc.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : acc.isActive ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />
                    }
                    {acc.isActive ? 'Aktif' : 'Pasif'}
                  </button>

                  {/* QR button for qr type */}
                  {acc.connectionType === 'qr' && (
                    acc.qrStatus === 'connected' ? (
                      <button
                        onClick={() => disconnectQr(acc.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        Bağlantıyı Kes
                      </button>
                    ) : (
                      <button
                        onClick={() => startQr(acc.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 hover:bg-indigo-500/25 transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        QR Bağla
                      </button>
                    )
                  )}

                  <div className="flex items-center gap-1 ml-1">
                    <button
                      onClick={() => openEdit(acc)}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteAccount(acc.id)}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog.Root open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-white/[0.1] rounded-2xl shadow-2xl p-6 w-full max-w-lg z-50 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <Dialog.Close className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.08] rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
            <Dialog.Title className="text-lg font-bold text-white mb-1">
              {editingId ? 'Hesabı Düzenle' : 'Yeni Hesap Ekle'}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-slate-500 mb-5">
              WhatsApp Business hesap bilgilerini girin.
            </Dialog.Description>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Hesap Adı <span className="text-red-400">*</span></label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors"
                  placeholder="Örn: Destek Hattı"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Bağlantı Türü</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'cloud_api', label: 'Cloud API', desc: 'Meta Business API', icon: <Smartphone className="w-4 h-4" /> },
                    { value: 'qr', label: 'QR Bridge', desc: 'Evolution API', icon: <QrCode className="w-4 h-4" /> },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, connectionType: opt.value as any })}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                        form.connectionType === opt.value
                          ? 'border-indigo-500/60 bg-indigo-500/10'
                          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15]'
                      }`}
                    >
                      <span className={`mt-0.5 ${form.connectionType === opt.value ? 'text-indigo-400' : 'text-slate-500'}`}>
                        {opt.icon}
                      </span>
                      <div>
                        <p className={`text-sm font-medium ${form.connectionType === opt.value ? 'text-slate-100' : 'text-slate-400'}`}>{opt.label}</p>
                        <p className="text-xs text-slate-600">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {form.connectionType === 'cloud_api' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone Number ID <span className="text-red-400">*</span></label>
                    <input
                      value={form.phoneNumberId}
                      onChange={e => setForm({ ...form, phoneNumberId: e.target.value })}
                      className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors"
                      placeholder="1234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Business Account ID</label>
                    <input
                      value={form.businessAccountId}
                      onChange={e => setForm({ ...form, businessAccountId: e.target.value })}
                      className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Access Token</label>
                    <input
                      type="password"
                      value={form.accessToken}
                      onChange={e => setForm({ ...form, accessToken: e.target.value })}
                      className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors"
                      placeholder={editingId ? '(değiştirilmedi)' : ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Webhook Verify Token</label>
                    <input
                      value={form.webhookVerifyToken}
                      onChange={e => setForm({ ...form, webhookVerifyToken: e.target.value })}
                      className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Görüntülenen Numara</label>
                    <input
                      value={form.displayPhoneNumber}
                      onChange={e => setForm({ ...form, displayPhoneNumber: e.target.value })}
                      className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors"
                      placeholder="+90 555 000 00 00"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Dialog.Close className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] rounded-xl transition-colors">
                  İptal
                </Dialog.Close>
                <button
                  onClick={save}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-indigo-600/20"
                >
                  {editingId ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* QR Dialog */}
      <Dialog.Root open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-white/[0.1] rounded-2xl shadow-2xl p-6 w-full max-w-sm z-50 animate-in fade-in zoom-in-95 duration-200">
            <Dialog.Close className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.08] rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>

            <Dialog.Title className="text-lg font-bold text-white text-center mb-1">QR Kodu Tara</Dialog.Title>
            <Dialog.Description className="text-sm text-slate-500 text-center mb-5">
              WhatsApp uygulamasını açın ve QR kodu tarayın
            </Dialog.Description>

            {qrLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-sm text-slate-500">QR kodu oluşturuluyor...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                {qrCode ? (
                  <div className="bg-white p-4 rounded-2xl shadow-lg">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrCode)}&margin=1`}
                      alt="WhatsApp QR Code"
                      className="w-60 h-60"
                    />
                  </div>
                ) : (
                  <div className="w-60 h-60 bg-white/[0.05] border border-white/[0.1] rounded-2xl flex items-center justify-center">
                    <div className="text-center">
                      <QrCode className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">QR kodu bekleniyor</p>
                    </div>
                  </div>
                )}

                <div className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3">
                  <div className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                    <div className="text-xs text-slate-400 space-y-1">
                      <p>WhatsApp &gt; <strong className="text-slate-300">Bağlı Cihazlar</strong></p>
                      <p>Cihaz ekle &gt; QR kodu tara</p>
                    </div>
                  </div>
                </div>

                {qrSessionId && (
                  <p className="text-[10px] text-slate-600 font-mono">
                    Oturum: {qrSessionId}
                  </p>
                )}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
