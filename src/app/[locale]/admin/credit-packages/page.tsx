'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Package, Plus, AlertCircle, X, Check } from 'lucide-react';

interface CreditPackage {
  id: number;
  name: string;
  credits: number;
  price: number;
  isActive?: boolean | null;
  sortOrder?: number | null;
  stripePriceId?: string | null;
  stripeProductId?: string | null;
}

export default function CreditPackagesPage() {
  const t = useTranslations();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formName, setFormName] = useState('');
  const [formCredits, setFormCredits] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [formStripePriceId, setFormStripePriceId] = useState('');
  const [formStripeProductId, setFormStripeProductId] = useState('');

  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/credit-packages?limit=100&sort=sortOrder');
      if (!res.ok) throw new Error('Failed to fetch credit packages');
      const data = await res.json();
      setPackages(data.docs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPackages() }, [fetchPackages]);

  function resetForm() {
    setFormName('');
    setFormCredits('');
    setFormPrice('');
    setFormSortOrder('0');
    setFormStripePriceId('');
    setFormStripeProductId('');
    setEditingId(null);
  }

  function openEdit(pkg: CreditPackage) {
    setFormName(pkg.name);
    setFormCredits(String(pkg.credits));
    setFormPrice(String(pkg.price));
    setFormSortOrder(String(pkg.sortOrder ?? 0));
    setFormStripePriceId(pkg.stripePriceId || '');
    setFormStripeProductId(pkg.stripeProductId || '');
    setEditingId(pkg.id);
    setShowCreate(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formCredits || !formPrice) return;
    setSaving(true);
    try {
      const body = {
        name: formName,
        credits: parseInt(formCredits),
        price: parseFloat(formPrice),
        sortOrder: parseInt(formSortOrder) || 0,
        stripePriceId: formStripePriceId || undefined,
        stripeProductId: formStripeProductId || undefined,
      };

      const res = editingId
        ? await fetch(`/api/credit-packages/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/credit-packages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, isActive: true }),
          });

      if (!res.ok) throw new Error('Failed to save');
      setShowCreate(false);
      resetForm();
      await fetchPackages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credit package');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(pkg: CreditPackage) {
    try {
      const res = await fetch(`/api/credit-packages/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !pkg.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await fetchPackages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Credit Packages</h1>
          <p className="text-slate-500 mt-1">Manage credit purchase packages for tenants</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Package
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="w-20 h-4 bg-slate-200 rounded animate-pulse mb-3" />
              <div className="w-32 h-8 bg-slate-200 rounded animate-pulse mb-2" />
              <div className="w-16 h-3 bg-slate-200 rounded animate-pulse" />
            </div>
          ))
        ) : packages.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No credit packages yet
          </div>
        ) : (
          packages.map((pkg) => (
            <div
              key={pkg.id}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:border-rose-200 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-slate-900">{pkg.name}</h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(pkg)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      pkg.isActive
                        ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                        : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {pkg.isActive ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(pkg)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="mb-2">
                <span className="text-3xl font-bold text-slate-900">{pkg.credits.toLocaleString()}</span>
                <span className="text-slate-400 ml-1 text-sm">credits</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-2xl font-semibold text-rose-600">${pkg.price.toFixed(2)}</span>
                <span className="text-xs text-slate-400">
                  {((pkg.price / pkg.credits) * 100).toFixed(2)}¢/credit
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>Order: {pkg.sortOrder ?? 0}</span>
                <span className={pkg.isActive ? 'text-emerald-600' : 'text-slate-400'}>
                  {pkg.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">
                {editingId ? 'Edit Package' : 'Create Package'}
              </h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Starter Pack"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Credits</label>
                  <input
                    type="number"
                    value={formCredits}
                    onChange={(e) => setFormCredits(e.target.value)}
                    placeholder="1000"
                    min="1"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="9.99"
                    min="0"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>
              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs text-slate-400 mb-3">Stripe Integration (optional)</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Stripe Product ID</label>
                    <input
                      type="text"
                      value={formStripeProductId}
                      onChange={(e) => setFormStripeProductId(e.target.value)}
                      placeholder="prod_..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Stripe Price ID</label>
                    <input
                      type="text"
                      value={formStripePriceId}
                      onChange={(e) => setFormStripePriceId(e.target.value)}
                      placeholder="price_..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim() || !formCredits || !formPrice}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
