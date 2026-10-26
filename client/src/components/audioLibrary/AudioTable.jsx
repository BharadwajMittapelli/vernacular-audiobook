import React from 'react';
import { AudioRow } from './AudioRow.jsx';

export function AudioTable({
  items,
  activeChapterId,
  isPlaying,
  onPlayPause,
  onClick,
  searchQuery,
  bookFilter,
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

  if (filtered.length === 0 && items.length === 0) return null;

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-foreground">No audio found</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {searchQuery ? 'Try a different search term' : 'Generate chapters in Studio to see them here'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="hidden sm:flex items-center gap-3 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="w-8" />
        <span className="flex-1">Title</span>
        <span className="w-28">Book</span>
        <span className="w-16">Chapter</span>
        <span className="w-20">Language</span>
        <span className="w-16">Voice</span>
        <span className="w-12 text-right">Duration</span>
        <span className="w-20 hidden">Created</span>
        <span className="w-8" />
      </div>

      {filtered.map((item) => (
        <AudioRow
          key={item.chapterId}
          item={item}
          isActive={activeChapterId === item.chapterId}
          isPlaying={isPlaying}
          onPlayPause={onPlayPause}
          onClick={() => onClick(item.chapterId)}
        />
      ))}
    </div>
  );
}
