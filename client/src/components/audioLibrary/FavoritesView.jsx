import React from 'react';
import { Play, Heart } from 'lucide-react';
import { DEFAULT_VOICE_BY_LANG, LANGUAGE_FLAG, LANGUAGE_NAME, formatDuration, formatRelativeTime } from './AudioRow.jsx';

export function FavoritesView({
  items,
  activeChapterId,
  isPlaying,
  onPlay,
  onSelect,
  onFavoriteToggle,
  selectedChapterId,
}) {
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Heart className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground">No favorites yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Click the heart icon on any chapter to add it to your favorites.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 overflow-x-hidden">
      <div className="hidden sm:flex items-center gap-3 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
        <div className="w-8 shrink-0" />
        <div className="flex-1 min-w-0">BOOK</div>
        <span className="hidden md:block w-16 shrink-0 text-center">CHAPTER</span>
        <span className="hidden md:flex w-20 shrink-0 items-center justify-center">LANGUAGE</span>
        <span className="hidden lg:block w-16 shrink-0 text-center">VOICE</span>
        <span className="w-14 shrink-0 text-right">DURATION</span>
        <span className="hidden md:block w-16 shrink-0 text-right">CREATED</span>
        <div className="w-8 shrink-0" />
      </div>

      {items.map((item) => (
        <FavoriteRow
          key={item.chapterId}
          item={item}
          isActive={activeChapterId === item.chapterId}
          isPlaying={isPlaying}
          isSelected={selectedChapterId === item.chapterId}
          onPlay={onPlay}
          onSelect={onSelect}
          onFavoriteToggle={onFavoriteToggle}
        />
      ))}
    </div>
  );
}

function FavoriteRow({ item, isActive, isPlaying, isSelected, onPlay, onSelect, onFavoriteToggle }) {
  const language = item.language || 'en-IN';
  const voiceName = item.voiceName || DEFAULT_VOICE_BY_LANG[language] || 'Kaveri';
  const duration = formatDuration(item.durationSeconds);
  const timeAgo = formatRelativeTime(item.createdAt);

  const flagEmoji = LANGUAGE_FLAG[language] || '🇮🇳';
  const langName = LANGUAGE_NAME[language] || 'English';
  const bookInitials = (item.bookTitle || '').slice(0, 2).toUpperCase();

  return (
    <div
      onClick={onSelect ? () => onSelect(item.chapterId) : undefined}
      className="flex items-center gap-3 px-3 py-3 rounded-xl bg-terracotta/10 border border-terracotta/20 shadow-sm"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onPlay(item.chapterId); }}
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

      {/* Book column — chapter title + thumbnail + book name */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate font-serif leading-tight ${isSelected ? 'text-terracotta' : 'text-foreground'}`}>
          {item.chapterTitle}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="w-6 h-6 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
            {item.coverUrl ? (
              <img src={item.coverUrl} alt={item.bookTitle} className="w-full h-full object-cover" />
            ) : (
              bookInitials
            )}
          </div>
          <span className="text-xs text-muted-foreground truncate">{item.bookTitle}</span>
        </div>
      </div>

      <span className="hidden md:block text-xs text-muted-foreground w-16 shrink-0 font-medium text-center">
        Chapter {String(item.sequenceNumber || 1).padStart(2, '0')}
      </span>

      <span className="hidden md:flex text-xs text-muted-foreground w-20 shrink-0 items-center gap-1.5 font-medium justify-center">
        <span className="text-sm">{flagEmoji}</span>
        <span className="truncate">{langName}</span>
      </span>

      <span className="hidden lg:block text-xs text-muted-foreground w-16 shrink-0 truncate font-medium text-center" title={voiceName}>
        {voiceName}
      </span>

      <span className="text-xs text-muted-foreground w-14 shrink-0 text-right font-medium">
        {duration}
      </span>

      <span className="hidden md:block text-xs text-muted-foreground w-16 shrink-0 text-right font-medium">
        {timeAgo}
      </span>

      {onFavoriteToggle && (
        <button
          onClick={(e) => { e.stopPropagation(); onFavoriteToggle(item.chapterId, item.bookId); }}
          className="shrink-0 p-1.5 rounded-lg hover:bg-muted text-terracotta transition-colors w-8 h-8 flex items-center justify-center"
          aria-label="Remove from favorites"
        >
          <Heart className="h-4 w-4 fill-current" />
        </button>
      )}
    </div>
  );
}
