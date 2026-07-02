'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, AlertCircle, Check, X, Coins } from 'lucide-react';

interface PlanLimits {
  maxAgents: number;
  monthlyAiCredits: number;
  maxCallDurationMinutes: number;
  allowedTtsProviders: string[];
  allowedAiModels: string[];
  allowedChannels: string[];
  maxTeamMembers: number;
  maxTrainingDocs: number;
}

interface PricingPlan {
  id: number;
  name: string;
  description?: string;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly' | 'one_time';
  features: { name: string; value: string; included: boolean }[];
  limits: PlanLimits | null;
  status: 'active' | 'inactive' | 'deprecated';
  displayOrder: number;
  stripePriceId?: string;
  stripeProductId?: string;
}

const defaultLimits: PlanLimits = {
  maxAgents: 0,
  monthlyAiCredits: 0,
  maxCallDurationMinutes: 60,
  allowedTtsProviders: ['edge-tts', 'piper', 'elevenlabs'],
  allowedAiModels: [],
  allowedChannels: ['voice', 'whatsapp', 'instagram', 'web'],
  maxTeamMembers: 0,
  maxTrainingDocs: 0,
};

const TTS_PROVIDER_OPTIONS = ['edge-tts', 'piper', 'elevenlabs'];
const CHANNEL_OPTIONS = ['voice', 'whatsapp', 'instagram', 'web'];

export default function PricingPlansPage() {
  const t = useTranslations();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCurrency, setFormCurrency] = useState('usd');
  const [formBillingCycle, setFormBillingCycle] = useState<'monthly' | 'yearly' | 'one_time'>('monthly');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive' | 'deprecated'>('active');
  const [formDisplayOrder, setFormDisplayOrder] = useState('0');
  const [formStripePriceId, setFormStripePriceId] = useState('');
  const [formStripeProductId, setFormStripeProductId] = useState('');
  const [formLimits, setFormLimits] = useState<PlanLimits>({ ...defaultLimits });
  const [formFeatures, setFormFeatures] = useState<{ name: string; value: string; included: boolean }[]>([]);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/pricing-plans?limit=100&sort=displayOrder');
      if (!res.ok) throw new Error('Failed to fetch pricing plans');
      const data = await res.json();
      setPlans(data.docs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlans() }, [fetchPlans]);

  function resetForm() {
    setFormName('');
    setFormDescription('');
    setFormPrice('');
    setFormCurrency('usd');
    setFormBillingCycle('monthly');
    setFormStatus('active');
    setFormDisplayOrder('0');
    setFormStripePriceId('');
    setFormStripeProductId('');
    setFormLimits({ ...defaultLimits });
    setFormFeatures([]);
    setEditingId(null);
  }

  function openEdit(plan: PricingPlan) {
    setFormName(plan.name);
    setFormDescription(plan.description || '');
    setFormPrice(String(plan.price));
    setFormCurrency(plan.currency);
    setFormBillingCycle(plan.billingCycle);
    setFormStatus(plan.status);
    setFormDisplayOrder(String(plan.displayOrder));
    setFormStripePriceId(plan.stripePriceId || '');
    setFormStripeProductId(plan.stripeProductId || '');
    setFormLimits(plan.limits || { ...defaultLimits });
    setFormFeatures(plan.features || []);
    setEditingId(plan.id);
    setShowCreate(true);
  }

  function toggleTtsProvider(provider: string) {
    setFormLimits(prev => ({
      ...prev,
      allowedTtsProviders: prev.allowedTtsProviders.includes(provider)
        ? prev.allowedTtsProviders.filter(p => p !== provider)
        : [...prev.allowedTtsProviders, provider],
    }));
  }

  function toggleChannel(channel: string) {
    setFormLimits(prev => ({
      ...prev,
      allowedChannels: prev.allowedChannels.includes(channel)
        ? prev.allowedChannels.filter(c => c !== channel)
        : [...prev.allowedChannels, channel],
    }));
  }

  function addFeature() {
    setFormFeatures(prev => [...prev, { name: '', value: '', included: true }]);
  }

  function updateFeature(idx: number, field: string, val: any) {
    setFormFeatures(prev => prev.map((f, i) => i === idx ? { ...f, [field]: val } : f));
  }

  function removeFeature(idx: number) {
    setFormFeatures(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!formName.trim() || !formPrice) return;
    setSaving(true);
    try {
      const body: Record<string, any> = {
        name: formName,
        description: formDescription || undefined,
        price: parseFloat(formPrice),
        currency: formCurrency,
        billingCycle: formBillingCycle,
        status: formStatus,
        displayOrder: parseInt(formDisplayOrder) || 0,
        stripePriceId: formStripePriceId || undefined,
        stripeProductId: formStripeProductId || undefined,
        limits: formLimits,
        features: formFeatures.filter(f => f.name.trim()),
      };

      const res = editingId
        ? await fetch(`/api/pricing-plans/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/pricing-plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

      if (!res.ok) throw new Error('Failed to save');
      setShowCreate(false);
      resetForm();
      await fetchPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pricing plan');
    } finally {
      setSaving(false);
    }
  }

  const limitSummary = (limits: PlanLimits | null) => {
    if (!limits) return '—';
    const parts: string[] = [];
    if (limits.maxAgents > 0) parts.push(`${limits.maxAgents} agents`);
    if (limits.monthlyAiCredits > 0) parts.push(`${limits.monthlyAiCredits} credits/mo`);
    if (limits.allowedTtsProviders?.length) parts.push(`TTS: ${limits.allowedTtsProviders.join(', ')}`);
    if (limits.allowedChannels?.length) parts.push(`Ch: ${limits.allowedChannels.join(', ')}`);
    return parts.join(' | ') || 'No limits';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pricing Plans</h1>
          <p className="text-slate-500 mt-1">Manage subscription plans and their limits</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Plan
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Price</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Cycle</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Limits</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="w-20 h-4 bg-slate-200 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-400">
                  <Coins className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No pricing plans yet
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{plan.name}</span>
                    {plan.description && <p className="text-xs text-slate-400 mt-0.5">{plan.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                    ${plan.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 capitalize">
                    {plan.billingCycle === 'yearly' ? 'Yearly' : plan.billingCycle === 'monthly' ? 'Monthly' : 'One Time'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                    {limitSummary(plan.limits)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${
                      plan.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      plan.status === 'deprecated' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(plan)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-slate-900">
                {editingId ? 'Edit Plan' : 'Create Plan'}
              </h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                    placeholder="Starter" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price ($)</label>
                  <input type="number" step="0.01" value={formPrice} onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="49.00" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                    rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Billing Cycle</label>
                  <select value={formBillingCycle} onChange={(e) => setFormBillingCycle(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent">
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="one_time">One Time</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="deprecated">Deprecated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Display Order</label>
                  <input type="number" value={formDisplayOrder} onChange={(e) => setFormDisplayOrder(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Plan Limits</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max Agents (0=unlimited)</label>
                    <input type="number" min="0" value={formLimits.maxAgents} onChange={(e) => setFormLimits(prev => ({ ...prev, maxAgents: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monthly AI Credits (0=unlimited)</label>
                    <input type="number" min="0" value={formLimits.monthlyAiCredits} onChange={(e) => setFormLimits(prev => ({ ...prev, monthlyAiCredits: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max Call Duration (min)</label>
                    <input type="number" min="0" value={formLimits.maxCallDurationMinutes} onChange={(e) => setFormLimits(prev => ({ ...prev, maxCallDurationMinutes: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max Team Members (0=unlimited)</label>
                    <input type="number" min="0" value={formLimits.maxTeamMembers} onChange={(e) => setFormLimits(prev => ({ ...prev, maxTeamMembers: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max Training Docs (0=unlimited)</label>
                    <input type="number" min="0" value={formLimits.maxTrainingDocs} onChange={(e) => setFormLimits(prev => ({ ...prev, maxTrainingDocs: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Allowed TTS Providers</label>
                  <div className="flex flex-wrap gap-2">
                    {TTS_PROVIDER_OPTIONS.map(p => (
                      <button key={p} type="button" onClick={() => toggleTtsProvider(p)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          formLimits.allowedTtsProviders.includes(p)
                            ? 'bg-rose-50 border-rose-300 text-rose-700'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}>
                        {formLimits.allowedTtsProviders.includes(p) && <Check className="w-3.5 h-3.5" />}
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Allowed Channels</label>
                  <div className="flex flex-wrap gap-2">
                    {CHANNEL_OPTIONS.map(ch => (
                      <button key={ch} type="button" onClick={() => toggleChannel(ch)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          formLimits.allowedChannels.includes(ch)
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}>
                        {formLimits.allowedChannels.includes(ch) && <Check className="w-3.5 h-3.5" />}
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Allowed AI Models (empty = all allowed, one per line)
                  </label>
                  <textarea value={formLimits.allowedAiModels.join('\n')}
                    onChange={(e) => setFormLimits(prev => ({ ...prev, allowedAiModels: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }))}
                    rows={3} placeholder="gpt-4o&#10;claude-3-5-sonnet"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-900">Features</h4>
                  <button type="button" onClick={addFeature}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700">+ Add Feature</button>
                </div>
                {formFeatures.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input type="text" value={feat.name} onChange={(e) => updateFeature(idx, 'name', e.target.value)}
                      placeholder="Feature name" className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
                    <input type="text" value={feat.value} onChange={(e) => updateFeature(idx, 'value', e.target.value)}
                      placeholder="Value" className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
                    <button type="button" onClick={() => updateFeature(idx, 'included', !feat.included)}
                      className={`p-1.5 rounded ${feat.included ? 'text-emerald-600' : 'text-slate-300'}`}>
                      <Check className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => removeFeature(idx)}
                      className="p-1.5 rounded text-slate-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs text-slate-400 mb-3">Stripe Integration (optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Stripe Product ID</label>
                    <input type="text" value={formStripeProductId} onChange={(e) => setFormStripeProductId(e.target.value)}
                      placeholder="prod_..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Stripe Price ID</label>
                    <input type="text" value={formStripePriceId} onChange={(e) => setFormStripePriceId(e.target.value)}
                      placeholder="price_..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving || !formName.trim() || !formPrice}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center gap-2">
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
