import React from 'react';

export function RecentlyOpenedCard({ book, onOpen }) {
  const initials = (book.title || '').slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 hover:shadow-md transition-shadow">
      <div className="w-12 h-16 shrink-0 rounded-lg overflow-hidden bg-terracotta/10 flex items-center justify-center text-terracotta font-bold text-sm">
        {book.cover_url ? (
          <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground truncate">{book.title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {book.total_chapters} chapter{book.total_chapters !== 1 ? 's' : ''}
        </p>
      </div>
      <button
        onClick={onOpen}
        className="shrink-0 bg-foreground text-background text-xs font-medium px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
      >
        Open
      </button>
    </div>
  );
}
