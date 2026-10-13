import React from 'react';
import { BookOpen, Mic, Library, Settings, Menu, X } from 'lucide-react';
import { Button } from '../ui/button.jsx';

const NAV_ITEMS = [
  { label: 'Studio', icon: Mic, active: true },
  { label: 'My Projects', icon: BookOpen, active: false },
  { label: 'Audio Library', icon: Library, active: false },
  { label: 'Settings', icon: Settings, active: false },
];

export function Sidebar({ book, activeChapterIdx, onChapterSelect, onNavClick, isMobileOpen, onCloseMobile }) {
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
          <BookOpen className="h-5 w-5 text-primary" />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tight text-foreground">Ekithab AI</span>
            <span className="text-xs text-muted-foreground font-medium">Audiobook</span>
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
            const disabled = !item.active;
            return (
              <button
                key={item.label}
                onClick={() => onNavClick?.(item.label)}
                disabled={disabled}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                  transition-colors
          ${disabled
            ? 'text-muted-foreground opacity-60 cursor-not-allowed'
            : item.label === 'Studio'
              ? 'bg-active text-primary font-medium'
              : 'text-secondary-text hover:text-foreground hover:bg-muted'
          }
                `}
                aria-current={item.label === 'Studio' ? 'page' : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Chapter list */}
        {book && (
          <div className="px-3 pb-3 border-t border-border pt-3">
            <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Chapters
            </p>
            <div className="space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin">
              {book.chapters.map((ch, i) => (
                <button
                  key={ch.chapterId}
                  onClick={() => onChapterSelect?.(i)}
                  className={`
                    w-full text-left px-3 py-1.5 rounded-md text-sm truncate transition-colors
                  ${i === activeChapterIdx
                    ? 'bg-active text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }
                  `}
                  aria-current={i === activeChapterIdx ? 'true' : undefined}
                >
                  {ch.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer credit area */}
        <div className="px-5 py-4 border-t border-border shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-success shrink-0" />
            <span>Studio Online</span>
          </div>
        </div>
      </aside>
    </>
  );
}
