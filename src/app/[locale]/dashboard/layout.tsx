'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { analytics } from '@/lib/analytics';

const navItems = [
  { href: '', labelKey: 'overview', icon: 'LayoutDashboard' },
  { href: 'agents', labelKey: 'agents', icon: 'Bot' },
  { href: 'phone', labelKey: 'phone', icon: 'Phone' },
  { href: 'whatsapp', labelKey: 'whatsapp', icon: 'MessageCircle' },
  { href: 'trunk', labelKey: 'trunk', icon: 'Network' },
  { href: 'training', labelKey: 'training', icon: 'FileText' },
  { href: 'conversations', labelKey: 'conversations', icon: 'MessageSquare' },
  { href: 'billing', labelKey: 'billing', icon: 'CreditCard' },
  { href: 'settings', labelKey: 'settings', icon: 'Settings' },
];

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  Bot: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  Phone: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  ),
  Network: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
  FileText: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  MessageCircle: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  ),
  MessageSquare: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  ),
  CreditCard: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
  Settings: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

function LiveCallIndicator() {
  const [activeCalls, setActiveCalls] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/calls/active');
        if (res.ok) {
          const data = await res.json();
          setActiveCalls(data.count || 0);
          setVisible(true);
        }
      } catch {
        setVisible(false);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!visible || activeCalls === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/60 border border-emerald-700/50 rounded-full text-xs">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-emerald-400 font-medium">
        {activeCalls} aktif çağrı
      </span>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();
  const params = useParams();
  const locale = params.locale as string;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ id: number; email: string; firstName?: string; lastName?: string; role: string; tenant?: any } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(u => setUser(u))
      .catch(() => {});
  }, []);

  useEffect(() => {
    analytics.track('page_view', { path: pathname, locale });
  }, [pathname, locale]);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    const segments = pathname.split('/');
    const last = segments[segments.length - 1];
    // overview is the index page
    if (href === '') {
      return last === 'dashboard' || last === '';
    }
    return pathname.includes(`/dashboard/${href}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar: fixed overlay on mobile, flex child on desktop */}
      <aside
        className={`w-64 flex flex-col bg-slate-950 border-r border-white/[0.06] shrink-0 fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.06] shrink-0">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
            <span className="text-white font-extrabold text-sm tracking-wider">CC</span>
          </div>
          <div>
            <span className="font-bold text-base text-white">CallCrafter</span>
            <span className="block text-[10px] text-indigo-400 font-medium uppercase tracking-widest -mt-0.5">AI Call Center</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          <p className="px-3 pt-1 pb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
            Ana Menü
          </p>
          {navItems.slice(0, 4).map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href ? `/${locale}/dashboard/${item.href}` : `/${locale}/dashboard`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  active
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent'
                }`}
              >
                <span className={`shrink-0 transition-colors ${active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                  {iconMap[item.icon]}
                </span>
                {t(`dashboard.${item.labelKey}`)}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
                )}
              </Link>
            );
          })}

          <p className="px-3 pt-4 pb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
            Yönetim
          </p>
          {navItems.slice(4).map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={`/${locale}/dashboard/${item.href}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  active
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent'
                }`}
              >
                <span className={`shrink-0 transition-colors ${active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                  {iconMap[item.icon]}
                </span>
                {t(`dashboard.${item.labelKey}`)}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/[0.06] px-4 py-4 shrink-0 space-y-2">
          <Link
            href={`/${locale}/dashboard/settings`}
            className="flex items-center gap-3 hover:bg-white/[0.04] rounded-lg px-1 py-1 transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">
                {user ? (user.firstName?.[0] || user.email[0]).toUpperCase() : '?'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">
                {user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email : '...'}
              </p>
              <p className="text-xs text-slate-500 truncate">{user?.email || '...'}</p>
            </div>
            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>

          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = `/${locale}/auth/login`;
            }}
            className="flex items-center gap-3 w-full px-1 py-1.5 rounded-lg text-sm text-slate-500 hover:text-red-400 hover:bg-red-950/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            {t('auth.logout')}
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-white/[0.06]">
          <div className="flex items-center justify-between px-4 sm:px-6 h-14">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                className="lg:hidden text-slate-400 hover:text-slate-200 p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Toggle sidebar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>

              {/* Breadcrumb / page title area */}
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="text-slate-500">Dashboard</span>
                <svg className="w-3.5 h-3.5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                <span className="text-slate-300 font-medium capitalize">
                  {pathname.split('/').filter(Boolean).pop()?.replace('-', ' ') || t('dashboard.overview')}
                </span>
              </div>

              <LiveCallIndicator />
            </div>

            <div className="flex items-center gap-2">
              {/* Language switcher */}
              <div className="flex items-center gap-1 text-xs bg-white/[0.05] border border-white/[0.08] px-2.5 py-1.5 rounded-lg">
                <button
                  onClick={() => {
                    const segments = pathname.split('/').filter(Boolean);
                    if (segments[0] === 'tr') return;
                    segments[0] = 'tr';
                    window.location.href = '/' + segments.join('/');
                  }}
                  className={`font-medium transition-colors px-1 ${locale === 'tr' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  TR
                </button>
                <span className="text-slate-700">|</span>
                <button
                  onClick={() => {
                    const segments = pathname.split('/').filter(Boolean);
                    if (segments[0] === 'en') return;
                    segments[0] = 'en';
                    window.location.href = '/' + segments.join('/');
                  }}
                  className={`font-medium transition-colors px-1 ${locale === 'en' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  EN
                </button>
              </div>

              {/* Notification bell */}
              <button className="relative w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </button>

              {/* Avatar */}
              <Link
                href={`/${locale}/dashboard/settings`}
                className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg hover:opacity-80 transition-opacity"
              >
                <span className="text-white font-bold text-sm">
                  {user ? (user.firstName?.[0] || user.email[0]).toUpperCase() : '?'}
                </span>
              </Link>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-slate-950">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}