import React from 'react';
import { BookOpen, Mic, Library, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const NAV_ITEMS = [
  { label: 'Studio', icon: Mic, route: '/' },
  { label: 'My Books', icon: BookOpen, route: '/my-books' },
  { label: 'Audio Library', icon: Library, route: '/audio-library' },
  { label: 'Settings', icon: Settings, route: '/settings' },
];

export function AudioLibrarySidebar({ items = [], activePath, onNavClick }) {
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

  // Build recent books list from items: unique books sorted by last_opened_at desc
  const bookMap = new Map();
  for (const item of items) {
    if (!bookMap.has(item.bookId)) {
      bookMap.set(item.bookId, {
        bookId: item.bookId,
        bookTitle: item.bookTitle,
        coverUrl: item.coverUrl,
        bookLastOpenedAt: item.bookLastOpenedAt,
        chapterCount: 0,
      });
    }
    const b = bookMap.get(item.bookId);
    b.chapterCount += 1;
  }

  const recentBooks = [...bookMap.values()]
    .sort((a, b) => new Date(b.bookLastOpenedAt || 0) - new Date(a.bookLastOpenedAt || 0))
    .slice(0, 5);

  return (
    <aside
      className="fixed top-0 left-0 z-50 h-full w-64 flex flex-col bg-sidebar border-r border-border lg:translate-x-0 lg:static lg:z-0"
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
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePath === item.route;
          return (
            <button
              key={item.label}
              onClick={() => onNavClick?.(item.route)}
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                transition-colors
                ${isActive
                  ? 'bg-terracotta/10 text-terracotta font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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

      {/* Recent Books */}
      {recentBooks.length > 0 && (
        <div className="px-3 pb-2 border-t border-border pt-3">
          <p className="px-1 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Books
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
            {recentBooks.map((book) => (
              <div
                key={book.bookId}
                className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors"
              >
                <div className="w-7 h-9 rounded-md overflow-hidden bg-muted shrink-0">
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt={book.bookTitle}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                      {(book.bookTitle || '').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{book.bookTitle}</p>
                  <p className="text-xs text-muted-foreground">{book.chapterCount} chapter{book.chapterCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
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
  );
}
