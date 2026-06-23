'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Globe, Bell, Key, Loader2, AlertCircle, Save,
  Eye, EyeOff, CheckCircle, Plus,
} from 'lucide-react';
import { api, getUser, setUser } from '@/lib/api';

interface UserPrefs {
  language: string;
  timezone: string;
  emailAlerts: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
}

export default function SettingsPage() {
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<UserPrefs>({
    language: 'en', timezone: 'UTC',
    emailAlerts: true, dailyDigest: false, weeklyReport: true,
  });
  const [userId, setUserId] = useState<string | null>(null);

  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const user = getUser();
    if (user) {
      setUserId(user.id);
      const meta = user.metadata || {};
      setPrefs({
        language: meta.language || 'en',
        timezone: meta.timezone || 'UTC',
        emailAlerts: meta.emailAlerts !== false,
        dailyDigest: meta.dailyDigest === true,
        weeklyReport: meta.weeklyReport !== false,
      });
    }
    setLoading(false);
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const savePrefs = async (section: string, data: Partial<UserPrefs>) => {
    if (!userId) return;
    setSaving(section);
    try {
      const user = getUser();
      const updated = await api.updateUser(userId, {
        metadata: { ...(user?.metadata || {}), ...data },
      });
      if (updated) {
        setUser(updated);
        showSuccess(`${section} settings saved`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const addApiKey = async () => {
    if (!newKeyName.trim()) return;
    const key = `cc_${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`;
    const entry = { id: `key_${Date.now()}`, name: newKeyName, key, created: new Date().toISOString() };
    setApiKeys([...apiKeys, entry]);
    setNewKeyName('');
    showSuccess('API key created');
  };

  const deleteApiKey = (id: string) => {
    setApiKeys(apiKeys.filter((k) => k.id !== id));
    showSuccess('API key deleted');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('dashboard.settings')}</h1>
        <p className="text-slate-500 mt-1">Manage your account settings</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">General</h2>
            <p className="text-sm text-slate-500">Language and timezone preferences</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
            <select
              value={prefs.language}
              onChange={(e) => setPrefs({ ...prefs, language: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="en">English</option>
              <option value="tr">Türkçe</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
            <select
              value={prefs.timezone}
              onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="UTC">UTC</option>
              <option value="Europe/Istanbul">Europe/Istanbul (UTC+3)</option>
              <option value="America/New_York">America/New_York (UTC-5)</option>
              <option value="America/Chicago">America/Chicago (UTC-6)</option>
              <option value="America/Denver">America/Denver (UTC-7)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
              <option value="Europe/London">Europe/London (UTC+0)</option>
              <option value="Europe/Berlin">Europe/Berlin (UTC+1)</option>
              <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
            </select>
          </div>
        </div>
        <button
          onClick={() => savePrefs('general', { language: prefs.language, timezone: prefs.timezone })}
          disabled={saving === 'general'}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving === 'general' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('common.save')}
        </button>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
            <p className="text-sm text-slate-500">Email notification preferences</p>
          </div>
        </div>
        <div className="space-y-4 mb-6">
          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-700/50 hover:bg-slate-800 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-white">Email Alerts</p>
              <p className="text-xs text-slate-500">Receive alerts for important events</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.emailAlerts}
              onChange={(e) => setPrefs({ ...prefs, emailAlerts: e.target.checked })}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5"
            />
          </label>
          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-700/50 hover:bg-slate-800 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-white">Daily Digest</p>
              <p className="text-xs text-slate-500">Daily summary of conversations and activity</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.dailyDigest}
              onChange={(e) => setPrefs({ ...prefs, dailyDigest: e.target.checked })}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5"
            />
          </label>
          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-700/50 hover:bg-slate-800 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-white">Weekly Report</p>
              <p className="text-xs text-slate-500">Weekly performance and usage report</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.weeklyReport}
              onChange={(e) => setPrefs({ ...prefs, weeklyReport: e.target.checked })}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5"
            />
          </label>
        </div>
        <button
          onClick={() => savePrefs('notifications', { emailAlerts: prefs.emailAlerts, dailyDigest: prefs.dailyDigest, weeklyReport: prefs.weeklyReport })}
          disabled={saving === 'notifications'}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving === 'notifications' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('common.save')}
        </button>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
            <Key className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">API Keys</h2>
            <p className="text-sm text-slate-500">Manage API keys for programmatic access</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {apiKeys.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No API keys created yet</p>
          ) : (
            apiKeys.map((ak) => (
              <div key={ak.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-700/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{ak.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                      {showKey[ak.id] ? ak.key : `${ak.key.slice(0, 8)}••••••••${ak.key.slice(-4)}`}
                    </code>
                    <button
                      onClick={() => setShowKey({ ...showKey, [ak.id]: !showKey[ak.id] })}
                      className="text-slate-400 hover:text-slate-300"
                    >
                      {showKey[ak.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => deleteApiKey(ak.id)}
                  className="text-red-400 hover:text-red-600 text-sm font-medium ml-4"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-3">
          <input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            onKeyDown={(e) => e.key === 'Enter' && addApiKey()}
          />
          <button
            onClick={addApiKey}
            disabled={!newKeyName.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Key
          </button>
        </div>
      </div>
    </div>
  );
}
