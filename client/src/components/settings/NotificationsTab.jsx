import React, { useState, useEffect } from 'react';
import { Bell as BellIcon } from 'lucide-react';

const STORAGE_KEY = 'ekithab-notifications';

export function NotificationsTab() {
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [inApp, setInApp] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.emailUpdates === 'boolean') setEmailUpdates(parsed.emailUpdates);
        if (typeof parsed.inApp === 'boolean') setInApp(parsed.inApp);
      }
    } catch {}
  }, []);

  const persist = (updates) => {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...updates }));
    } catch {}
  };

  const handleEmailChange = (val) => {
    setEmailUpdates(val);
    persist({ emailUpdates: val });
    setSaved(true);
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-semibold text-foreground mb-1">Notifications</h2>
      <p className="text-sm text-muted-foreground mb-6">Manage how you receive updates from Ekithab AI.</p>

      <div className="space-y-4">
        {/* Email updates */}
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <BellIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Email updates</p>
              <p className="text-xs text-muted-foreground">Receive notifications about your audiobooks via email.</p>
            </div>
          </div>
          <button
            onClick={() => handleEmailChange(!emailUpdates)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              emailUpdates ? 'bg-terracotta' : 'bg-muted'
            }`}
            role="switch"
            aria-checked={emailUpdates}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                emailUpdates ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* In-app notifications */}
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">In-app notifications</p>
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">Not available</span>
              </div>
              <p className="text-xs text-muted-foreground">Get notified about audio generation progress and updates.</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Coming soon</span>
        </div>

        {saved && <p className="text-xs text-success mt-2">Preference saved</p>}
      </div>
    </div>
  );
}
