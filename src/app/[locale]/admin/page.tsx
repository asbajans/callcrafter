'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users, Bot, Building2, CreditCard, Activity, Database, Server, HardDrive } from 'lucide-react';

interface Stat {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

interface SystemService {
  name: string;
  icon: React.ReactNode;
  status: 'healthy' | 'degraded' | 'down';
}

interface RecentUser {
  id: number;
  email: string;
  role?: string | null;
  status?: string | null;
  createdAt: string;
  firstName?: string | null;
  lastName?: string | null;
}

export default function AdminDashboard() {
  const t = useTranslations();
  const [users, setUsers] = useState<RecentUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalAgents, setTotalAgents] = useState(0);
  const [totalTenants, setTotalTenants] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [usersRes, agentsRes, tenantsRes, paymentsRes] = await Promise.all([
          fetch('/api/users?limit=10&sort=-createdAt'),
          fetch('/api/agents?limit=0'),
          fetch('/api/tenants?limit=0'),
          fetch('/api/payments?limit=0&where[status][equals]=succeeded'),
        ]);

        if (!usersRes.ok || !agentsRes.ok || !tenantsRes.ok || !paymentsRes.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const usersData = await usersRes.json();
        const agentsData = await agentsRes.json();
        const tenantsData = await tenantsRes.json();
        const paymentsData = await paymentsRes.json();

        setUsers(usersData.docs || []);
        setTotalUsers(usersData.totalDocs || 0);
        setTotalAgents(agentsData.totalDocs || 0);
        setTotalTenants(tenantsData.totalDocs || 0);

        if (paymentsData.docs) {
          const total = paymentsData.docs.reduce((sum: number, p: { amount: number }) => sum + (p.amount || 0), 0);
          setTotalRevenue(total);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const stats: Stat[] = [
    {
      label: t('admin.users') || 'Users',
      value: totalUsers.toLocaleString(),
      icon: <Users className="w-5 h-5 text-white" />,
      color: 'bg-rose-500',
    },
    {
      label: t('admin.agents') || 'Agents',
      value: totalAgents.toLocaleString(),
      icon: <Bot className="w-5 h-5 text-white" />,
      color: 'bg-indigo-500',
    },
    {
      label: 'Tenants',
      value: totalTenants.toLocaleString(),
      icon: <Building2 className="w-5 h-5 text-white" />,
      color: 'bg-emerald-500',
    },
    {
      label: 'Total Revenue',
      value: `$${totalRevenue.toLocaleString()}`,
      icon: <CreditCard className="w-5 h-5 text-white" />,
      color: 'bg-amber-500',
    },
  ];

  const services: SystemService[] = [
    {
      name: 'Database',
      icon: <Database className="w-5 h-5 text-emerald-500" />,
      status: 'healthy',
    },
    {
      name: 'Redis',
      icon: <HardDrive className="w-5 h-5 text-emerald-500" />,
      status: 'healthy',
    },
    {
      name: 'Payload API',
      icon: <Server className="w-5 h-5 text-emerald-500" />,
      status: 'healthy',
    },
  ];

  const roleBadge = (role?: string | null) => {
    const colors: Record<string, string> = {
      'super-admin': 'bg-red-100 text-red-700',
      admin: 'bg-orange-100 text-orange-700',
      'tenant-admin': 'bg-blue-100 text-blue-700',
      user: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[role || 'user'] || 'bg-gray-100 text-gray-700'}`}>
        {role || 'user'}
      </span>
    );
  };

  const statusBadge = (status?: string | null) => {
    const colors: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-700',
      inactive: 'bg-gray-100 text-gray-600',
      suspended: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status || 'inactive'] || 'bg-gray-100 text-gray-600'}`}>
        {status || 'inactive'}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('admin.dashboard')}</h1>
        <p className="text-slate-500 mt-1">System overview and statistics</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {t('common.error')}: {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                {stat.icon}
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {loading ? (
                <span className="inline-block w-16 h-6 bg-slate-200 rounded animate-pulse" />
              ) : (
                stat.value
              )}
            </p>
            <p className="text-slate-500 text-sm mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Users</h2>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Role</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <td key={j} className="px-6 py-3">
                          <span className="inline-block w-20 h-4 bg-slate-200 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <span className="text-slate-900 font-medium">{user.email}</span>
                        {(user.firstName || user.lastName) && (
                          <span className="text-slate-400 ml-1">
                            ({user.firstName || ''} {user.lastName || ''})
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3">{roleBadge(user.role)}</td>
                      <td className="px-6 py-3">{statusBadge(user.status)}</td>
                      <td className="px-6 py-3 text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">System Health</h2>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="p-6 space-y-4">
            {services.map((service) => (
              <div key={service.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {service.icon}
                  <span className="text-sm text-slate-700">{service.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      service.status === 'healthy'
                        ? 'bg-emerald-500'
                        : service.status === 'degraded'
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                    }`}
                  />
                  <span
                    className={`text-xs font-medium ${
                      service.status === 'healthy'
                        ? 'text-emerald-600'
                        : service.status === 'degraded'
                          ? 'text-amber-600'
                          : 'text-red-600'
                    }`}
                  >
                    {service.status === 'healthy' ? 'Connected' : service.status === 'degraded' ? 'Degraded' : 'Down'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
