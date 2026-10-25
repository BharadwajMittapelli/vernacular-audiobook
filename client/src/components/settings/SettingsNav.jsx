import React from 'react';
import {
  User,
  Globe,
  Sliders,
  CreditCard,
  Bell as BellIcon,
} from 'lucide-react';

const TABS = [
  { key: 'account', label: 'Account', sub: 'Profile and security', icon: User },
  { key: 'preferences', label: 'Preferences', sub: 'Language and audio', icon: Globe },
  { key: 'playback', label: 'Playback', sub: 'Default listening settings', icon: Sliders },
  { key: 'credits', label: 'Credits', sub: 'Usage and billing', icon: CreditCard },
  { key: 'notifications', label: 'Notifications', sub: 'Email and updates', icon: BellIcon },
];

export function SettingsNav({ activeTab, onTabChange }) {
  return (
    <nav className="w-60 shrink-0" aria-label="Settings navigation">
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                ${isActive
                  ? 'bg-terracotta/8 border-l-2 border-terracotta'
                  : 'border-l-2 border-transparent hover:bg-muted'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-terracotta' : 'text-muted-foreground'}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium truncate ${isActive ? 'text-terracotta' : 'text-foreground'}`}>
                  {tab.label}
                </p>
                <p className="text-xs text-muted-foreground truncate">{tab.sub}</p>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
