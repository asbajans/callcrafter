'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard, Eye } from 'lucide-react';

interface AdminPayment {
  id: number;
  amount: number;
  currency?: string | null;
  status?: 'pending' | 'succeeded' | 'failed' | 'refunded' | null;
  subscription?: number | { id: number; stripeSubscriptionId?: string | null } | null;
  description?: string | null;
  createdAt: string;
  paidAt?: string | null;
}

const statusColors: Record<string, string> = {
  succeeded: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300',
  pending: 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300',
  failed: 'bg-red-100 text-red-700 ring-1 ring-red-300',
  refunded: 'bg-blue-100 text-blue-700 ring-1 ring-blue-300',
};

export default function AdminPaymentsPage() {
  const t = useTranslations();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<AdminPayment | null>(null);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/payments?limit=100&sort=-createdAt&depth=1');
      if (!res.ok) throw new Error('Failed to fetch payments');
      const data = await res.json();
      setPayments(data.docs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const formatCurrency = (amount: number, currency?: string | null) => {
    const curr = (currency || 'usd').toUpperCase();
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr, minimumFractionDigits: 2 }).format(amount / 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('admin.payments')}</h1>
          <p className="text-slate-500 mt-1">View and manage payment transactions</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200">
          <CreditCard className="w-4 h-4" />
          {payments.length} transactions
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{t('common.error')}: {error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Amount</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Currency</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Description</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-6 py-3">
                        <span className="inline-block w-16 h-4 bg-slate-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 text-xs text-slate-400">#{payment.id}</td>
                    <td className="px-6 py-3 font-medium text-slate-900">
                      {formatCurrency(payment.amount, payment.currency)}
                    </td>
                    <td className="px-6 py-3 text-slate-600 uppercase text-xs">{(payment.currency || 'usd').toUpperCase()}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[payment.status || 'pending']}`}>
                        {payment.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-xs max-w-[200px] truncate">
                      {payment.description || '—'}
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-xs">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => setSelectedPayment(payment)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedPayment(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Payment Details</h3>
              <button onClick={() => setSelectedPayment(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <Eye className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">ID</span>
                <span className="text-slate-900 font-medium">#{selectedPayment.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount</span>
                <span className="text-slate-900 font-medium">{formatCurrency(selectedPayment.amount, selectedPayment.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[selectedPayment.status || 'pending']}`}>
                  {selectedPayment.status || 'pending'}
                </span>
              </div>
              {selectedPayment.description && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Description</span>
                  <span className="text-slate-900">{selectedPayment.description}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Created</span>
                <span className="text-slate-900">{new Date(selectedPayment.createdAt).toLocaleString()}</span>
              </div>
              {selectedPayment.paidAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Paid At</span>
                  <span className="text-slate-900">{new Date(selectedPayment.paidAt).toLocaleString()}</span>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => setSelectedPayment(null)}
                className="w-full px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
