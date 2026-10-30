import React from 'react';
import { Menu, Bell, Search, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export function HomeTopBar({ onMenuClick, onLogout, fullName, initials }) {
  const { session } = useAuth();

  return (
    <header className="h-14 border-b border-border bg-sidebar/50 backdrop-blur-sm flex items-center justify-between px-4 gap-3 shrink-0">
      <button
        className="lg:hidden p-1.5 rounded-md hover:bg-elevated"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search your books…"
          className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
        />
      </div>

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <button
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>
        <div className="relative flex items-center gap-2">
          <button
            onClick={onLogout}
            className="h-8 w-8 rounded-full bg-terracotta text-terracotta-foreground hover:opacity-90 text-xs font-semibold flex items-center justify-center transition-opacity"
            aria-label="Sign out"
            title="Sign out"
          >
            {initials}
          </button>
          <span className="text-sm font-medium text-foreground hidden sm:inline">{fullName}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:inline" />
        </div>
      </div>
    </header>
  );
}
