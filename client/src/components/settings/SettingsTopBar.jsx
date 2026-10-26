import React from 'react';
import { Search, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from '../../context/NavigateContext.jsx';

export function SettingsTopBar() {
  const { signOut, session } = useAuth();
  const navigate = useNavigate();
  const user = session?.user;
  const fullName = user?.user_metadata?.full_name || user?.email || 'User';
  const initials = fullName
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-6 gap-4 shrink-0">
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search books, chapters, or audio..."
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

        <button
          onClick={async () => { await signOut(); window.location.href = '/'; }}
          className="h-8 w-8 rounded-full bg-terracotta text-terracotta-foreground hover:opacity-90 text-xs font-semibold flex items-center justify-center transition-opacity"
          aria-label="Sign out"
          title="Sign out"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="h-full w-full rounded-full object-cover" />
          ) : (
            initials
          )}
        </button>
      </div>
    </header>
  );
}
