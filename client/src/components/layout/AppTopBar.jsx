import React from 'react';
import { Search, Bell, Menu } from 'lucide-react';

export function AppTopBar({ onMenuClick }) {
  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-6 gap-4 sticky top-0 z-10 shrink-0">
      <button className="lg:hidden" onClick={onMenuClick}><Menu className="h-5 w-5" /></button>
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input placeholder="Search..." className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-terracotta/40 focus:outline-none" />
      </div>
      <div className="ml-auto flex items-center gap-4">
        <button className="p-2 text-muted-foreground hover:text-foreground"><Bell className="h-5 w-5" /></button>
      </div>
    </header>
  );
}
