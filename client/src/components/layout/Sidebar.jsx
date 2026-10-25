import React from 'react';
import { BookOpen, Mic, Library, Settings, Menu, X } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const NAV_ITEMS = [
  { label: 'Studio', icon: Mic, route: '/' },
  { label: 'My Books', icon: BookOpen, route: '/my-books' },
  { label: 'Audio Library', icon: Library, route: '#', active: false },
  { label: 'Settings', icon: Settings, route: '#', active: false },
];

function estimateMinutes(ch) {
  if (!ch || !ch.text) return 0;
  const words = ch.text.replace(/[#*`_\[\]]/g, '').trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / 160);
}

export function Sidebar({ book, activeChapterIdx, onChapterSelect, onNavClick, isMobileOpen, onCloseMobile, activePath }) {
  const { session } = useAuth();
  const user = session?.user;
  const avatarUrl = user?.user_metadata?.avatar_url || null;
  const fullName = user?.user_metadata?.full_name || user?.email || 'User';
  const email = user?.email || '';
  const initials = fullName
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <>
      {/* Mobile overlay */}
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
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-14 border-b border-border shrink-0">
          <BookOpen className="h-6 w-6 text-terracotta" />
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight text-foreground">Ekithab AI</span>
            <span className="text-sm text-muted-foreground font-medium">Audiobook</span>
          </div>
          <button
            className="ml-auto lg:hidden p-1 rounded-md hover:bg-elevated"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isRoute = item.route && item.route !== '#';
            const isActive = isRoute && activePath === item.route;
            return (
              <button
                key={item.label}
                onClick={() => {
                  if (!isRoute) return;
                  if (item.route === '/') {
                    const params = new URLSearchParams(window.location.search);
                    const urlBookId = params.get('bookId');
                    if (urlBookId) {
                      return;
                    }
                    const remembered = sessionStorage.getItem('lastBookId');
                    if (remembered) {
                      onNavClick?.('/?bookId=' + remembered);
                    } else {
                      onNavClick?.('/my-books');
                    }
                    return;
                  }
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

        {/* Current Book section */}
        {book && (
          <div className="px-3 pb-2 border-t border-border pt-3">
            <div className="flex items-center gap-2 px-1 mb-2">
              <div className="w-6 h-8 shrink-0 rounded bg-terracotta/20 flex items-center justify-center text-[9px] font-bold text-terracotta">
                {book.title?.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">{book.title}</p>
                <p className="text-xs text-muted-foreground">{book.chapters.length} chapters</p>
              </div>
            </div>
            <p className="px-1 mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Chapters
            </p>
            <div className="space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin">
              {book.chapters.map((ch, i) => (
                <button
                  key={ch.chapterId}
                  onClick={() => onChapterSelect?.(i)}
                  className={`
                    w-full flex items-center text-left px-1 py-1.5 rounded-md text-sm transition-colors
                  ${i === activeChapterIdx
                    ? 'bg-terracotta/10 text-terracotta font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }
                  `}
                  aria-current={i === activeChapterIdx ? 'true' : undefined}
                >
                  <span className="text-xs text-muted-foreground shrink-0 mr-1.5 font-mono">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="truncate flex-1">{ch.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-1">
                    {estimateMinutes(ch)}m
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer status */}
        <div className="px-5 py-3 border-t border-border shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <div className="w-2 h-2 rounded-full bg-success shrink-0" />
            <span>Studio Online</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-muted-foreground/80">Ready to create</span>
          </div>
          {user ? (
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
