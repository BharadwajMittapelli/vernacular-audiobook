import React from 'react';
import { AudioRow } from './AudioRow.jsx';
import { Loader2, AlertCircle } from 'lucide-react';

export function AudioTable({
  items,
  activeChapterId,
  isPlaying,
  onPlay,
  onSelect,
  searchQuery,
  bookFilter,
  loading = false,
  error = null,
  onRetry,
  isFavorite,
  onFavoriteToggle,
  selectedChapterId,
  onChapterUpdate,
}) {
  const filtered = items.filter((item) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      item.chapterTitle.toLowerCase().includes(q) ||
      item.bookTitle.toLowerCase().includes(q) ||
      item.language.toLowerCase().includes(q)
    );
  }).filter((item) => {
    if (!bookFilter) return true;
    return item.bookId === bookFilter;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-3" />
        <p className="text-sm text-muted-foreground">Loading playback history…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-3" />
        <h3 className="text-base font-semibold text-foreground">Failed to load playback history</h3>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 text-sm text-terracotta hover:underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (filtered.length === 0 && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-foreground">No played audio yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Play chapters in Studio to see them here.
        </p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-foreground">No audio found</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {searchQuery ? 'Try a different search term' : 'No matching chapters in playback history'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 overflow-x-hidden">
      {/* Header — single BOOK column, no separate TITLE */}
      <div className="hidden sm:flex items-center gap-3 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
        <div className="w-8 shrink-0" />
        <div className="flex-1 min-w-0">BOOK</div>
        <span className="hidden md:block w-16 shrink-0 text-center">CHAPTER</span>
        <span className="hidden md:flex w-20 shrink-0 items-center justify-center">LANGUAGE</span>
        <span className="hidden lg:block w-16 shrink-0 text-center">VOICE</span>
        <span className="w-14 shrink-0 text-right">DURATION</span>
        <span className="hidden md:block w-16 shrink-0 text-right">CREATED</span>
        <div className="w-8 shrink-0" />
        <div className="w-8 shrink-0" />
      </div>

      {filtered.map((item) => (
        <AudioRow
          key={item.chapterId}
          item={item}
          isActive={activeChapterId === item.chapterId}
          isPlaying={isPlaying}
          isSelected={selectedChapterId === item.chapterId}
          isFavorite={isFavorite ? isFavorite(item.chapterId) : false}
          onPlay={onPlay}
          onSelect={onSelect}
          onFavoriteToggle={onFavoriteToggle}
          onChapterUpdate={onChapterUpdate}
        />
      ))}
    </div>
  );
}
