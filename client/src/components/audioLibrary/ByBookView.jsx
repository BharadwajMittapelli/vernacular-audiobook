import React from 'react';
import { AudioRow } from './AudioRow.jsx';
import { Loader2, BookOpen } from 'lucide-react';
import { DEFAULT_VOICE_BY_LANG, LANGUAGE_FLAG, LANGUAGE_NAME } from './AudioRow.jsx';

export function ByBookView({
  books,
  activeChapterId,
  isPlaying,
  onPlay,
  onSelect,
  onFavoriteToggle,
  loading = false,
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-3" />
        <p className="text-sm text-muted-foreground">Loading books…</p>
      </div>
    );
  }

  if (!loading && books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <BookOpen className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground">No books yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Generate an audiobook in Studio to see it here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {books.map((book) => (
        <div key={book.bookId} className="mb-6">
          <div className="flex items-center gap-3 mb-2 px-4">
            <div className="w-8 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
              {book.coverUrl ? (
                <img src={book.coverUrl} alt={book.bookTitle} className="w-full h-full object-cover" />
              ) : (
                (book.bookTitle || '').slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{book.bookTitle}</h3>
              <p className="text-xs text-muted-foreground">
                {book.playedChaptersCount} of {book.totalChapters} chapters played
              </p>
            </div>
          </div>

          <div className="ml-4 space-y-1 border-l-2 border-border pl-4">
            {book.chapters.map((ch) => {
              const language = ch.language || 'en-IN';
              const item = {
                chapterId: ch.chapterId,
                chapterTitle: ch.chapterTitle,
                bookId: book.bookId,
                bookTitle: book.bookTitle,
                coverUrl: book.coverUrl,
                language,
                durationSeconds: ch.durationSeconds,
                createdAt: ch.lastPlayedAt,
                sequenceNumber: ch.sequenceNumber,
                voiceName: DEFAULT_VOICE_BY_LANG[language] || 'Kaveri',
                flag: LANGUAGE_FLAG[language] || '\u{1F1EE}\u{1F1F3}',
                langName: LANGUAGE_NAME[language] || 'English',
              };
              return (
                <AudioRow
                  key={ch.chapterId}
                  item={item}
                  isActive={activeChapterId === ch.chapterId}
                  isPlaying={isPlaying}
                  isFavorite={false}
                  onPlay={onPlay}
                  onSelect={onSelect}
                  onFavoriteToggle={onFavoriteToggle}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
