import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

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
  const [language, setLanguage] = useState('hi-IN');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.language && LABELS[parsed.language]) {
          setLanguage(parsed.language);
        }
      }
    } catch {}
  }, []);

  const handleChange = (val) => {
    setLanguage(val);
    setSaved(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ language: val }));
      setSaved(true);
    } catch {}
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
              className="w-full appearance-none bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground pr-8 focus:outline-none focus:ring-2 focus:ring-terracotta/40 cursor-pointer"
            >
              {Object.entries(LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          {saved && <p className="text-xs text-success mt-1.5">Saved</p>}
        </div>

        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-sm font-medium text-foreground">More preferences coming soon</p>
          <p className="text-xs text-muted-foreground mt-1">Additional preference settings will be available in a future update.</p>
        </div>
      </div>
    </div>
  );
}
