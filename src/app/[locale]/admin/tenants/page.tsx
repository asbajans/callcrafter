'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Building2, Plus, AlertCircle, Search, Wallet, Activity } from 'lucide-react';

interface Tenant {
  id: number;
  name: string;
  domain?: string | null;
  isActive?: boolean | null;
  createdAt: string;
  credits?: { balance: number; totalUsed: number };
}

export default function AdminTenantsPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/tenants?limit=100&sort=-createdAt&depth=1');
      if (!res.ok) throw new Error('Failed to fetch tenants');
      const data = await res.json();

      // Fetch credit info for each tenant
      const tenantsWithCredits = await Promise.all(
        (data.docs || []).map(async (tenant: Tenant) => {
          try {
            const creditRes = await fetch(`/api/tenant-credits?where[tenant][equals]=${tenant.id}&limit=1`);
            if (creditRes.ok) {
              const creditData = await creditRes.json();
              if (creditData.docs?.[0]) {
                return { ...tenant, credits: creditData.docs[0] };
              }
            }
          } catch {}
          return { ...tenant, credits: { balance: 0, totalUsed: 0 } };
        }),
      );

      setTenants(tenantsWithCredits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTenants() }, [fetchTenants]);

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.domain && t.domain.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tenants</h1>
          <p className="text-slate-500 mt-1">Manage tenant accounts and credit balances</p>
        </div>
        <Link
          href={`/${locale}/admin/tenants/add`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Tenant
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search tenants..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="w-24 h-4 bg-slate-200 rounded animate-pulse mb-3" />
              <div className="w-16 h-3 bg-slate-200 rounded animate-pulse mb-2" />
              <div className="w-20 h-3 bg-slate-200 rounded animate-pulse" />
            </div>
          ))
        ) : filteredTenants.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400">
            <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No tenants found
          </div>
        ) : (
          filteredTenants.map((tenant) => (
            <Link
              key={tenant.id}
              href={`/${locale}/admin/tenants/${tenant.id}`}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:border-rose-200 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900 group-hover:text-rose-600 transition-colors">
                    {tenant.name}
                  </h3>
                  {tenant.domain && (
                    <p className="text-xs text-slate-400 mt-0.5">{tenant.domain}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  tenant.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tenant.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Wallet className="w-3.5 h-3.5" />
                  <span className="font-medium text-slate-700">{(tenant.credits?.balance ?? 0).toLocaleString()}</span>
                  <span className="text-xs">credits</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Activity className="w-3.5 h-3.5" />
                  <span className="text-xs">{(tenant.credits?.totalUsed ?? 0).toLocaleString()} used</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
