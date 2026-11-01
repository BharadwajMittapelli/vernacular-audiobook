import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Play } from 'lucide-react';
import { DEFAULT_VOICE_BY_LANG, LANGUAGE_FLAG, LANGUAGE_NAME, formatDuration, formatRelativeTime } from './AudioRow.jsx';

export function ByBookView({
  books,
  activeChapterId,
  isPlaying,
  onPlay,
  onSelect,
  onFavoriteToggle,
}) {
  if (!books || books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-foreground">No played books yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Play chapters in Studio to see them organized by book.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {books.map((book) => (
        <BookCard
          key={book.bookId}
          book={book}
          activeChapterId={activeChapterId}
          isPlaying={isPlaying}
          onPlay={onPlay}
          onSelect={onSelect}
          onFavoriteToggle={onFavoriteToggle}
        />
      ))}
    </div>
  );
}

function BookCard({ book, activeChapterId, isPlaying, onPlay, onSelect, onFavoriteToggle }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={book.bookTitle} className="w-full h-full object-cover" />
          ) : (
            <span className="text-terracotta font-bold text-lg">{(book.bookTitle || '').slice(0, 2).toUpperCase()}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground truncate">{book.bookTitle}</h4>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{book.playedChaptersCount} / {book.totalChapters} chapters played</span>
            <span className="hidden sm:inline-flex">•</span>
            <span>{formatRelativeTime(book.lastPlayedAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (book.chapters.length > 0) {
                onPlay(book.chapters[0].chapterId);
              }
            }}
            className="p-2 rounded-lg bg-terracotta text-white hover:opacity-90 transition-opacity"
            aria-label="Play first chapter"
          >
            <Play className="h-4 w-4 ml-0.5" />
          </button>
          <span className="text-terracotta">
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </span>
        </div>
      </div>

      {expanded && book.chapters.length > 0 && (
        <div className="border-t border-border bg-muted/30 w-full min-w-0 overflow-hidden">
          {book.chapters.map((chapter) => (
            <ChapterRow
              key={chapter.chapterId}
              chapter={chapter}
              bookTitle={book.bookTitle}
              coverUrl={book.coverUrl}
              isActive={activeChapterId === chapter.chapterId}
              isPlaying={isPlaying}
              onPlay={onPlay}
              onSelect={onSelect}
              onFavoriteToggle={onFavoriteToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChapterRow({
  chapter,
  bookTitle,
  coverUrl,
  isActive,
  isPlaying,
  onPlay,
  onSelect,
  onFavoriteToggle,
}) {
  const language = chapter.language || 'en-IN';
  const flagEmoji = LANGUAGE_FLAG[language] || '🇮🇳';
  const langName = LANGUAGE_NAME[language] || 'English';
  const duration = formatDuration(chapter.durationSeconds);
  const timeAgo = formatRelativeTime(chapter.lastPlayedAt);

  return (
    <div
      onClick={onSelect ? () => onSelect(chapter.chapterId) : undefined}
      className={`
        flex items-center gap-4 px-4 py-3 rounded-xl transition-colors w-full min-w-0 mb-3
        ${isActive
          ? 'bg-terracotta/10 border border-terracotta/20 shadow-sm cursor-default'
          : 'hover:bg-muted/50 border border-transparent cursor-pointer'
        }
      `}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onPlay(chapter.chapterId); }}
        className={`
          w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors shadow-sm
          ${isActive && isPlaying
            ? 'bg-terracotta text-white'
            : 'bg-background border border-border text-muted-foreground hover:bg-terracotta/20 hover:text-terracotta'
          }
        `}
        aria-label={isActive && isPlaying ? 'Pause' : 'Play'}
      >
        {isActive && isPlaying
          ? <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          : <Play className="h-3.5 w-3.5 ml-0.5" />
        }
      </button>

      <div className="flex-1 min-w-0 pr-2">
        <p className={`text-sm font-semibold truncate ${isActive ? 'text-terracotta' : 'text-foreground'} font-serif leading-tight`}>
          {chapter.chapterTitle}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5 hidden sm:block">{bookTitle}</p>
      </div>

      <div className="hidden sm:flex items-center gap-2.5 w-40 shrink-0">
        <div className="w-8 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 shadow-xs">
          {coverUrl ? (
            <img src={coverUrl} alt={bookTitle} className="w-full h-full object-cover" />
          ) : (
            (bookTitle || '').slice(0, 2).toUpperCase()
          )}
        </div>
        <span className="text-xs font-medium text-foreground truncate">{bookTitle}</span>
      </div>

      <span className="hidden md:block text-xs text-muted-foreground w-24 shrink-0 font-medium text-center">
        Chapter {String(chapter.sequenceNumber || 1).padStart(2, '0')}
      </span>

      <span className="hidden md:flex text-xs text-muted-foreground w-24 shrink-0 items-center gap-1.5 font-medium justify-center">
        <span className="text-sm">{flagEmoji}</span>
        <span className="truncate">{langName}</span>
      </span>

      <span className="hidden lg:block text-xs text-muted-foreground w-24 shrink-0 truncate font-medium text-center" title={DEFAULT_VOICE_BY_LANG[language] || 'Kaveri'}>
        {DEFAULT_VOICE_BY_LANG[language] || 'Kaveri'}
      </span>

      <span className="text-xs text-muted-foreground w-16 shrink-0 text-right font-medium">
        {duration}
      </span>

      <span className="hidden sm:block text-xs text-muted-foreground w-24 shrink-0 text-right font-medium">
        {timeAgo}
      </span>

      {onFavoriteToggle && (
        <button
          onClick={(e) => { e.stopPropagation(); onFavoriteToggle(chapter.chapterId, chapter.bookId); }}
          className="shrink-0 p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors w-8 h-8 flex items-center justify-center"
          aria-label="Toggle favorite"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </button>
      )}
    </div>
  );
}