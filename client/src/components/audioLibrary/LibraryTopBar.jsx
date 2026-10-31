import React from 'react';
import { Music, BookOpen, Heart, Download, ChevronDown } from 'lucide-react';

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
        <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">
          Audio Library
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Listen to your generated audiobooks, organize them, and continue from where you left off.
        </p>
      </div>

      {/* Tabs row with dropdown on far right */}
      <div className="flex items-center gap-6 border-b border-border pb-2.5">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === key
                ? 'border-terracotta text-terracotta font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
        <div className="ml-auto relative">
          <select
            value={bookFilter || ''}
            onChange={(e) => onBookFilterChange(e.target.value || null)}
            className="appearance-none px-8 py-1.5 pr-8 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-terracotta cursor-pointer"
          >
            <option value="">All books</option>
            {uniqueBooks.map((book) => (
              <option key={book.bookId} value={book.bookId}>
                {book.bookTitle}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
