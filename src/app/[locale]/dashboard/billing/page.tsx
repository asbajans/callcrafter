'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  CreditCard, Loader2, AlertCircle, Check, Zap,
  Clock, Coins, Wallet, TrendingUp, ArrowUpRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function BillingPage() {
  const t = useTranslations();
  const [plans, setPlans] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [creditPackages, setCreditPackages] = useState<any[]>([]);
  const [myCredits, setMyCredits] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [planRes, subRes, creditRes, creditsRes] = await Promise.all([
        api.getPricingPlans(),
        api.getSubscriptions(),
        api.getCreditPackages(),
        api.getMyCredits().catch(() => null),
      ]);
      setPlans((planRes.docs || []).filter((p: any) => p.status === 'active').sort((a: any, b: any) => a.displayOrder - b.displayOrder));
      setSubscriptions(subRes.docs || []);
      setCreditPackages((creditRes.docs || []).filter((p: any) => p.isActive !== false).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)));
      setMyCredits(creditsRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  async function purchaseCredits(pkg: any) {
    setPurchasing(pkg.id);
    try {
      const res = await api.createCreditCheckout({
        packageId: pkg.id,
        tenantId: 0,
        successUrl: `${window.location.origin}/${window.location.pathname.split('/')[1]}/dashboard/billing?success=1`,
        cancelUrl: `${window.location.origin}/${window.location.pathname.split('/')[1]}/dashboard/billing`,
      });
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate purchase');
    } finally {
      setPurchasing(null);
    }
  }

  const currentSub = subscriptions[0];
  const currentPlan = currentSub && typeof currentSub.plan === 'object'
    ? (currentSub.plan as any)
    : plans.find((p) => p.id === currentSub?.plan);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-slate-400">{error}</p>
        <button onClick={fetchData} className="text-indigo-400 text-sm font-medium hover:text-indigo-300">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('dashboard.billing')}</h1>
        <p className="text-slate-400 mt-1">Manage your subscription and billing</p>
      </div>

      {currentPlan && (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-indigo-200 text-sm font-medium">Current Plan</p>
              <h2 className="text-2xl font-bold mt-1">{currentPlan.name}</h2>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{formatCurrency(currentPlan.price)}</p>
              <p className="text-indigo-200 text-sm">{currentPlan.billingCycle === 'yearly' ? '/year' : '/month'}</p>
            </div>
          </div>
          {currentSub && (
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-indigo-500/30">
              <div className="flex items-center gap-2 text-sm text-indigo-100">
                <Clock className="w-4 h-4" />
                <span>Current period ends {currentSub.currentPeriodEnd ? formatDate(currentSub.currentPeriodEnd) : '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-indigo-100">
                <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${
                  currentSub.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {currentSub.status ? currentSub.status.charAt(0).toUpperCase() + currentSub.status.slice(1) : '—'}
                </span>
              </div>
            </div>
          )}
          {currentPlan.features && currentPlan.features.length > 0 && (
            <div className="mt-4 pt-4 border-t border-indigo-500/30">
              <p className="text-indigo-200 text-sm font-medium mb-2">Features</p>
              <div className="grid grid-cols-2 gap-2">
                {currentPlan.features.map((feat: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-indigo-100">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{feat.name}{feat.value ? `: ${feat.value}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {currentSub?.usage && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Current Usage</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(currentSub.usage as Record<string, number>).map(([key, val]) => (
              <div key={key} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                  <Zap className="w-4 h-4" />
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </div>
                <p className="text-xl font-bold text-white">{val}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {myCredits && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Credit Balance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                <Wallet className="w-4 h-4" />
                Available Balance
              </div>
              <p className="text-3xl font-bold text-white">
                {myCredits.balance?.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">credits</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                <TrendingUp className="w-4 h-4" />
                Total Purchased
              </div>
              <p className="text-3xl font-bold text-emerald-400">
                {myCredits.totalPurchased?.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">credits</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                <ArrowUpRight className="w-4 h-4" />
                Total Used
              </div>
              <p className="text-3xl font-bold text-amber-400">
                {myCredits.totalUsed?.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">credits</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                <Clock className="w-4 h-4" />
                Expiring Soon
              </div>
              <p className="text-3xl font-bold text-rose-400">
                {myCredits.totalExpired?.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {myCredits.earliestExpiry ? `Earliest: ${formatDate(myCredits.earliestExpiry)}` : 'No expiry data'}
              </p>
            </div>
          </div>
        </div>
      )}

      {creditPackages.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Credit Packages</h2>
          <p className="text-sm text-slate-400 mb-4">Purchase credits to use AI services. Credits expire after 6 months.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {creditPackages.map((pkg: any) => (
              <div
                key={pkg.id}
                className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 hover:border-rose-500/50 hover:bg-slate-800/80 transition-all"
              >
                <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
                  <Coins className="w-4 h-4" />
                  {pkg.name}
                </div>
                <p className="text-3xl font-bold text-white mb-1">
                  {pkg.credits.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mb-4">credits</p>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-semibold text-rose-400">${pkg.price.toFixed(2)}</span>
                  <span className="text-xs text-slate-500">
                    {((pkg.price / pkg.credits) * 100).toFixed(1)}¢/credit
                  </span>
                </div>
                <button
                  onClick={() => purchaseCredits(pkg)}
                  disabled={purchasing === pkg.id}
                  className="w-full py-2 rounded-lg text-sm font-medium text-white bg-rose-500 hover:bg-rose-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {purchasing === pkg.id && <Loader2 className="w-4 h-4 animate-spin" />}
                  {purchasing === pkg.id ? 'Processing...' : 'Buy Now'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {plans.length > 0 && (
        <>
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Available Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan: any) => (
                <div
                  key={plan.id}
                  className={`bg-slate-800/50 rounded-xl border-2 p-6 ${
                    currentPlan?.id === plan.id ? 'border-indigo-500' : 'border-slate-700/50'
                  }`}
                >
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-sm text-slate-400 mt-1">{plan.description}</p>
                  )}
                  <div className="mt-4 mb-6">
                    <span className="text-3xl font-bold text-white">{formatCurrency(plan.price)}</span>
                    <span className="text-sm text-slate-400">/{plan.billingCycle === 'yearly' ? 'year' : 'month'}</span>
                  </div>
                  {plan.features && plan.features.length > 0 && (
                    <ul className="space-y-2 mb-6">
                      {plan.features.map((feat: any, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <Check className={`w-4 h-4 mt-0.5 shrink-0 ${feat.included === false ? 'text-slate-600' : 'text-emerald-400'}`} />
                          <span className={feat.included === false ? 'text-slate-500' : ''}>
                            {feat.name}{feat.value ? `: ${feat.value}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    disabled={currentPlan?.id === plan.id}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPlan?.id === plan.id
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-indigo-500 text-white hover:bg-indigo-400'
                    }`}
                  >
                    {currentPlan?.id === plan.id ? 'Current Plan' : 'Select Plan'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Plan Comparison</h2>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800">
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Feature</th>
                    {plans.map((plan: any) => (
                      <th key={plan.id} className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  <tr>
                    <td className="px-6 py-3 text-sm text-slate-300 font-medium">Price</td>
                    {plans.map((plan: any) => (
                      <td key={plan.id} className="px-4 py-3 text-sm text-white text-center font-semibold">
                        {formatCurrency(plan.price)}/{plan.billingCycle === 'yearly' ? 'yr' : 'mo'}
                      </td>
                    ))}
                  </tr>
                  {plans[0]?.features?.map((_: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-6 py-3 text-sm text-slate-300">{plans[0].features[idx]?.name || `Feature ${idx + 1}`}</td>
                      {plans.map((plan: any) => {
                        const feat = plan.features?.[idx];
                        return (
                          <td key={plan.id} className="px-4 py-3 text-center">
                            {feat?.included === false ? (
                              <span className="text-slate-600">—</span>
                            ) : (
                              <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
