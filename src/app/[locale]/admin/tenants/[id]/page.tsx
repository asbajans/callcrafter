'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { ArrowLeft, Wallet, Activity, AlertCircle, Plus, History, CreditCard } from 'lucide-react';
import Link from 'next/link';

interface TenantDetail {
  id: number;
  name: string;
  domain?: string | null;
  isActive?: boolean | null;
}

interface CreditInfo {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  totalExpired: number;
  lastTopUpAt?: string | null;
  earliestExpiry?: string | null;
  monthlyLimit?: number | null;
}

interface Transaction {
  id: number;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  source: string;
  description?: string | null;
  createdAt: string;
}

export default function TenantDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;
  const tenantId = params.id as string;
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddCredits, setShowAddCredits] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [tenantRes, creditRes, txRes] = await Promise.all([
          fetch(`/api/tenants/${tenantId}`),
          fetch(`/api/credit-transactions?where[tenant][equals]=${tenantId}&sort=-createdAt&limit=50`),
          fetch(`/api/tenant-credits?where[tenant][equals]=${tenantId}&limit=1`),
        ]);
        if (!tenantRes.ok) throw new Error('Failed to fetch tenant');
        const tenantData = await tenantRes.json();
        setTenant(tenantData);

        if (txRes.ok) {
          const txData = await txRes.json();
          setTransactions(txData.docs || []);
        }

        if (creditRes.ok) {
          const creditData = await creditRes.json();
          if (creditData.docs?.[0]) {
            setCreditInfo(creditData.docs[0]);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tenant');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [tenantId]);

  async function handleAddCredits() {
    const amount = parseInt(addAmount);
    if (!amount || amount <= 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description: addDescription || undefined }),
      });
      if (!res.ok) throw new Error('Failed to add credits');
      setShowAddCredits(false);
      setAddAmount('');
      setAddDescription('');

      // Refresh data
      const [creditRes, txRes] = await Promise.all([
        fetch(`/api/tenant-credits?where[tenant][equals]=${tenantId}&limit=1`),
        fetch(`/api/credit-transactions?where[tenant][equals]=${tenantId}&sort=-createdAt&limit=50`),
      ]);
      if (creditRes.ok) {
        const creditData = await creditRes.json();
        if (creditData.docs?.[0]) setCreditInfo(creditData.docs[0]);
      }
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.docs || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add credits');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="w-32 h-8 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="w-16 h-4 bg-slate-200 rounded animate-pulse mb-2" />
              <div className="w-24 h-8 bg-slate-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!tenant) {
    return <div className="text-center py-12 text-slate-400">Tenant not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/${locale}/admin/tenants`}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{tenant.name}</h1>
          {tenant.domain && <p className="text-slate-500 text-sm">{tenant.domain}</p>}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Wallet className="w-4 h-4" />
            Current Balance
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {(creditInfo?.balance ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">credits</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <CreditCard className="w-4 h-4" />
            Total Purchased
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            {(creditInfo?.totalPurchased ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Activity className="w-4 h-4" />
            Total Used
          </div>
          <p className="text-2xl font-bold text-rose-600">
            {(creditInfo?.totalUsed ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <History className="w-4 h-4" />
            Total Expired
          </div>
          <p className="text-2xl font-bold text-amber-600">
            {(creditInfo?.totalExpired ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setShowAddCredits(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Credits
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-1 px-6 py-3 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'overview' ? 'bg-rose-50 text-rose-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'transactions' ? 'bg-rose-50 text-rose-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <History className="w-4 h-4" />
              Transaction History
            </div>
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Status</span>
                <span className={`font-medium ${tenant.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {tenant.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Monthly Limit</span>
                <span className="font-medium">{creditInfo?.monthlyLimit ?? 'Unlimited'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Last Top-Up</span>
                <span className="font-medium">
                  {creditInfo?.lastTopUpAt ? new Date(creditInfo.lastTopUpAt).toLocaleString() : 'Never'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Earliest Expiry</span>
                <span className="font-medium">
                  {creditInfo?.earliestExpiry ? new Date(creditInfo.earliestExpiry).toLocaleString() : 'No expiry set'}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Type</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Description</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Amount</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Balance</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      No transactions yet
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isPositive = tx.amount > 0;
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-slate-500 text-xs">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            tx.type === 'purchase' ? 'bg-emerald-100 text-emerald-700' :
                            tx.type === 'manual_add' ? 'bg-blue-100 text-blue-700' :
                            tx.type === 'usage' ? 'bg-rose-100 text-rose-700' :
                            tx.type === 'expired' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-700">{tx.description || '-'}</td>
                        <td className={`px-6 py-3 text-right font-medium ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isPositive ? '+' : ''}{tx.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right text-slate-500">
                          {tx.balanceAfter.toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-slate-500 text-xs">{tx.source}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddCredits && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddCredits(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Add Credits</h3>
              <button onClick={() => setShowAddCredits(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (credits)</label>
                <input
                  type="number"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="1000"
                  min="1"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={addDescription}
                  onChange={(e) => setAddDescription(e.target.value)}
                  placeholder="Manual top-up"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => setShowAddCredits(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCredits}
                disabled={saving || !addAmount || parseInt(addAmount) <= 0}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Add Credits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
