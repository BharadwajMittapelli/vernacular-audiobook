import React from 'react';
import { Play, ChevronRight } from 'lucide-react';

export function ContinueListening({ history, activeChapter, currentTime, duration, onPlay, onViewAll }) {
  const safeItems = Array.isArray(history) ? history : [];
  const booksMap = new Map();
  for (const item of safeItems) {
    if (!booksMap.has(item.bookId)) {
      booksMap.set(item.bookId, {
        id: item.bookId,
        title: item.bookTitle,
        coverUrl: item.coverUrl,
        lastOpenedAt: item.bookLastOpenedAt || item.createdAt,
        chapters: [],
      });
    }
    booksMap.get(item.bookId).chapters.push(item);
  }

  const sortedBooks = [...booksMap.values()]
    .sort((a, b) => new Date(b.lastOpenedAt) - new Date(a.lastOpenedAt))
    .slice(0, 3);

  if (sortedBooks.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Continue Listening</h2>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-terracotta hover:underline flex items-center gap-1"
          >
            View all
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {sortedBooks.map((book) => {
          const latestChapter = book.chapters[0];
          const isActive = activeChapter?.chapterId === latestChapter.chapterId;
          const totalSec = isActive && duration ? duration : (latestChapter.durationSeconds || 0);
          const currentSec = isActive ? Math.floor(currentTime) : 0;
          const progressPct = totalSec > 0 ? Math.min(1, currentSec / totalSec) : 0;

          const currentStr = formatDuration(currentSec);
          const totalStr = formatDuration(totalSec);

          return (
            <div
              key={book.id}
              className="flex-shrink-0 w-56 bg-card border border-border rounded-xl p-3 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onPlay(latestChapter.chapterId)}
            >
              <div className="w-full h-28 rounded-lg overflow-hidden bg-muted mb-2 relative">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">
                    {(book.title || '').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-terracotta flex items-center justify-center">
                    <Play className="h-5 w-5 text-white ml-0.5" />
                  </div>
                </div>
              </div>
              <p className="text-sm font-semibold text-foreground truncate">{book.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Chapter {String(latestChapter.sequenceNumber || 1).padStart(2, '0')} • {latestChapter.chapterTitle}
              </p>
              {isActive && totalSec > 0 && (
                <div className="mt-2">
                  <div className="h-1 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full bg-terracotta rounded-full transition-all duration-300"
                      style={{ width: `${progressPct * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{currentStr}</span>
                    <span>{totalStr}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
