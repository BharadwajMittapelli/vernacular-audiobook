import React from 'react';
import { Upload, Bell, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export function MyBooksTopBar({ onUploadBook, onLogout }) {
  const { session } = useAuth();
  const user = session?.user;
  const fullName = user?.user_metadata?.full_name || user?.email || 'User';
  const initials = fullName
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-14 border-b border-border bg-sidebar/50 backdrop-blur-sm flex items-center px-4 gap-3 shrink-0">
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search books, chapters, or topics..."
          className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
        />
      </div>

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <button
          onClick={onUploadBook}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-terracotta text-background text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
        >
          <Upload className="h-4 w-4" />
          Upload a Book
        </button>

        <button
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>

        <button
          onClick={onLogout}
          className="h-8 w-8 rounded-full bg-terracotta text-terracotta-foreground hover:opacity-90 text-xs font-semibold flex items-center justify-center shrink-0 transition-opacity"
          aria-label="Sign out"
          title="Sign out"
        >
          {initials}
        </button>
      </div>
    </header>
  );
}
