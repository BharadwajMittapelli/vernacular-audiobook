import React from 'react';
import { Menu, LogOut as LogoutIcon, Bell } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export function TopBar({
  chapter,
  activeIdx,
  onMenuClick,
}) {
  const { signOut, session } = useAuth();
  const user = session?.user;
  const fullName = user?.user_metadata?.full_name || user?.email || 'User';
  const initials = fullName
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-14 border-b border-border bg-sidebar/50 backdrop-blur-sm flex items-center justify-between px-4 gap-3 shrink-0">
      <button
        className="lg:hidden p-1.5 rounded-md hover:bg-elevated"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-2 ml-auto shrink-0">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          title="Notifications"
          className="relative"
        >
          <Bell className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            await signOut();
            window.location.href = '/';
          }}
          aria-label="Sign out"
          title="Sign out"
          className="h-8 w-8 rounded-full bg-terracotta text-terracotta-foreground hover:bg-terracotta/90 text-xs font-semibold"
        >
          {initials}
        </Button>
      </div>
    </header>
  );
}