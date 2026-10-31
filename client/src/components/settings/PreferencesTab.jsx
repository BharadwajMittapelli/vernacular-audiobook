import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { updatePreferences } from '../../services/api.js';

const LABELS = {
  'en-IN': 'English',
  'hi-IN': 'Hindi',
  'te-IN': 'Telugu',
  'ta-IN': 'Tamil',
  'kn-IN': 'Kannada',
  'ml-IN': 'Malayalam',
  'mr-IN': 'Marathi',
  'bn-IN': 'Bengali',
  'gu-IN': 'Gujarati',
  'pa-IN': 'Punjabi',
};

const STORAGE_KEY = 'ekithab-preferences';

export function PreferencesTab() {
  const { session } = useAuth();
  const [language, setLanguage] = useState('hi-IN');
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncErr, setSyncErr] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.language && LABELS[parsed.language]) {
          setLanguage(parsed.language);
          return;
        }
      }
    } catch {}
    const meta = session?.user?.user_metadata?.preferred_language;
    if (meta && LABELS[meta]) {
      setLanguage(meta);
    }
  }, [session]);

  const handleChange = async (val) => {
    setLanguage(val);
    setSaved(false);
    setSyncErr('');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ language: val }));
      setSyncing(true);
      const res = await updatePreferences({ language: val });
      if (res?.success) {
        setSaved(true);
      } else {
        setSyncErr(res?.error || 'Failed to save on server — kept locally');
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to save on server — kept locally';
      setSyncErr(msg);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-semibold text-foreground mb-1">Preferences</h2>
      <p className="text-sm text-muted-foreground mb-6">Manage your language and application preferences.</p>

      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Language</label>
          <div className="relative">
            <select
              value={language}
              onChange={(e) => handleChange(e.target.value)}
              disabled={syncing}
              className="w-full appearance-none bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground pr-8 focus:outline-none focus:ring-2 focus:ring-terracotta/40 cursor-pointer disabled:opacity-60"
            >
              {Object.entries(LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          {saved && !syncErr && <p className="text-xs text-success mt-1.5">Saved</p>}
          {syncErr && <p className="text-xs text-destructive mt-1.5">{syncErr}</p>}
        </div>

        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-sm font-medium text-foreground">More preferences coming soon</p>
          <p className="text-xs text-muted-foreground mt-1">Additional preference settings will be available in a future update.</p>
        </div>
      </div>
    </div>
  );
}
