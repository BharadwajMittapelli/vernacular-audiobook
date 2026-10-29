import React from 'react';
import { Music, BookOpen, Heart, Download } from 'lucide-react';

export function LibraryTopBar({
  activeTab,
  onTabChange,
  books,
  bookFilter,
  onBookFilterChange,
}) {
  const tabs = [
    { key: 'all',     label: 'All Audio',   icon: Music },
    { key: 'by-book', label: 'By Book',     icon: BookOpen },
    { key: 'favorites', label: 'Favorites',  icon: Heart },
    { key: 'downloads', label: 'Downloads',  icon: Download },
  ];

  const uniqueBooks = [...new Map(books.map((b) => [b.bookId, b])).values()];

  return (
    <div className="mb-0">
      {/* Stacked title */}
      <div className="mb-4">
        <h1 className="text-3xl font-semibold text-foreground">
          Audio Library
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Listen to your generated audiobooks, organize them, and continue from where you left off.
        </p>
      </div>

      {/* Tabs row with dropdown on far right */}
      <div className="flex items-center gap-6 border-b border-border">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === key
                ? 'border-terracotta text-terracotta'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
            {key !== 'all' && key !== 'downloads' && (
              <span className="text-[10px] bg-terracotta/10 text-terracotta px-1.5 py-0.5 rounded-full">
                Soon
              </span>
            )}
          </button>
        ))}
        <select
          value={bookFilter || ''}
          onChange={(e) => onBookFilterChange(e.target.value || null)}
          className="ml-auto px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border"
        >
          <option value="">All books</option>
          {uniqueBooks.map((book) => (
            <option key={book.bookId} value={book.bookId}>
              {book.bookTitle}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
