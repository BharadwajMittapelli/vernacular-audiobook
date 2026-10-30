import React from 'react';
import { BookOpen, Mic, Library, Settings, LogOut, Coins } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const NAV_ITEMS = [
  { label: 'Home', icon: BookOpen, route: '/home' },
  { label: 'My Books', icon: BookOpen, route: '/my-books' },
  { label: 'Audio Library', icon: Library, route: '/audio-library' },
  { label: 'Studio', icon: Mic, route: '/' },
  { label: 'Settings', icon: Settings, route: '/settings' },
];

export function HomeSidebar({ activePath, onNavClick, credits, fullName, email, avatarUrl, initials, isMobileOpen, onCloseMobile }) {
  const { session } = useAuth();

  const handleLogout = async () => {
    await session?.signOut?.();
    window.location.href = '/';
  };

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 flex flex-col
          bg-sidebar border-r border-border
          transition-transform duration-200 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-0
        `}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex items-center gap-3 px-5 h-14 border-b border-border shrink-0">
          <BookOpen className="h-6 w-6 text-terracotta" />
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight text-foreground">Ekithab AI</span>
            <span className="text-sm text-muted-foreground font-medium">Books. Voices. Anywhere.</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePath === item.route;
            const isRoute = item.route && item.route !== '#';
            return (
              <button
                key={item.label}
                onClick={() => {
                  if (!isRoute) return;
                  onNavClick?.(item.route);
                }}
                disabled={!isRoute}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                  transition-colors
                  ${isActive
                    ? 'bg-terracotta/10 text-terracotta font-medium'
                    : isRoute
                      ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      : 'text-muted-foreground opacity-60 cursor-not-allowed'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-3 pb-2 border-t border-border pt-3">
          <div className="flex items-center gap-2 px-1 mb-2">
            <div className="w-8 h-10 shrink-0 rounded bg-terracotta/10 flex items-center justify-center text-terracotta">
              <Coins className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-foreground uppercase tracking-tight">Credits remaining</p>
              <p className="text-sm font-bold text-foreground">
                {typeof credits === 'number' ? credits : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border shrink-0">
          {session?.user ? (
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName} className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-terracotta/10 text-terracotta flex items-center justify-center text-xs font-semibold">
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="shrink-0 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-success shrink-0" />
              <span>Studio Online</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
