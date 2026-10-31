import React from 'react';
import { Play, Pause, MoreHorizontal, Heart } from 'lucide-react';

export function AudioRow({ item, isActive, isPlaying, isFavorite, onPlay, onSelect, onFavoriteToggle }) {
  const language = item.language || 'en-IN';
  const voiceName = item.voiceName || 'Kaveri';
  const duration = formatDuration(item.durationSeconds);
  const timeAgo = formatRelativeTime(item.createdAt);

  const flagEmoji = LANGUAGE_FLAG[language] || '🇮🇳';
  const langName = LANGUAGE_NAME[language] || 'English';

  return (
    <div
      onClick={onSelect ? () => onSelect(item.chapterId) : undefined}
      className={`
        flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors
        ${isActive
          ? 'bg-terracotta/10 border border-terracotta/20 shadow-sm cursor-default'
          : 'hover:bg-muted/50 border border-transparent cursor-pointer'
        }
      `}
    >
      {/* Play toggle - aligned with Title column */}
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
          ? <Pause className="h-3.5 w-3.5" />
          : <Play className="h-3.5 w-3.5 ml-0.5" />
        }
      </button>

      {/* Title column - flex-1 */}
      <div className="flex-1 min-w-0 pr-2">
        <p className={`text-sm font-semibold truncate ${isActive ? 'text-terracotta' : 'text-foreground'} font-serif leading-tight`}>
          {item.chapterTitle}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5 hidden sm:block">{item.bookTitle}</p>
      </div>

      {/* Book cover + name column - w-48 */}
      <div className="hidden sm:flex items-center gap-2.5 w-48 shrink-0">
        <div className="w-8 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 shadow-xs">
          {item.coverUrl ? (
            <img src={item.coverUrl} alt={item.bookTitle} className="w-full h-full object-cover" />
          ) : (
            (item.bookTitle || '').slice(0, 2).toUpperCase()
          )}
        </div>
        <span className="text-xs font-medium text-foreground truncate">{item.bookTitle}</span>
      </div>

      {/* Chapter column - w-28 */}
      <span className="hidden md:block text-xs text-muted-foreground w-28 shrink-0 font-medium text-center">
        Chapter {String(item.sequenceNumber || 1).padStart(2, '0')}
      </span>

      {/* Language column - w-28 */}
      <span className="hidden md:flex text-xs text-muted-foreground w-28 shrink-0 items-center gap-1.5 font-medium justify-center">
        <span className="text-sm">{flagEmoji}</span>
        <span className="truncate">{langName}</span>
      </span>

      {/* Voice column - w-28 */}
      <span className="hidden lg:block text-xs text-muted-foreground w-28 shrink-0 truncate font-medium text-center" title={voiceName}>
        {voiceName}
      </span>

      {/* Duration column - w-20 */}
      <span className="text-xs text-muted-foreground w-20 shrink-0 text-right font-medium">
        {duration}
      </span>

      {/* Created column - w-28 */}
      <span className="hidden sm:block text-xs text-muted-foreground w-28 shrink-0 text-right font-medium">
        {timeAgo}
      </span>

      {/* Favorite toggle */}
      {onFavoriteToggle && (
        <button
          onClick={(e) => { e.stopPropagation(); onFavoriteToggle(item.chapterId, item.bookId); }}
          className={`shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors w-8 h-8 flex items-center justify-center ${
            isFavorite ? 'text-terracotta' : 'text-muted-foreground hover:text-terracotta'
          }`}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      )}

      {/* Actions column - w-10 */}
      <button
        onClick={(e) => { e.stopPropagation(); }}
        className="shrink-0 p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors w-8 h-8 flex items-center justify-center"
        aria-label="More options"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '2 days ago';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

const LANGUAGE_FLAG = {
  'en-IN': '🇺🇸',
  'hi-IN': '🇮🇳',
  'ta-IN': '🇮🇳',
  'te-IN': '🇮🇳',
  'kn-IN': '🇮🇳',
  'ml-IN': '🇮🇳',
  'mr-IN': '🇮🇳',
  'bn-IN': '🇮🇳',
  'gu-IN': '🇮🇳',
  'pa-IN': '🇮🇳',
  'hi-en': '🇮🇳',
};

const LANGUAGE_NAME = {
  'en-IN': 'English',
  'hi-IN': 'Hindi',
  'ta-IN': 'Tamil',
  'te-IN': 'Telugu',
  'kn-IN': 'Kannada',
  'ml-IN': 'Malayalam',
  'mr-IN': 'Marathi',
  'bn-IN': 'Bengali',
  'gu-IN': 'Gujarati',
  'pa-IN': 'Punjabi',
  'hi-en': 'Hinglish',
};

const DEFAULT_VOICE_BY_LANG = {
  'en-IN': 'Kaveri',
  'hi-IN': 'Deepak',
  'ta-IN': 'Asmita',
  'te-IN': 'Suhana',
  'kn-IN': 'Saanvi',
  'ml-IN': 'Reshma',
  'mr-IN': 'Zahira',
  'bn-IN': 'Kirra',
  'gu-IN': 'Falak',
  'pa-IN': 'Mehuli',
  'hi-en': 'Poorvi',
};

export { LANGUAGE_FLAG, LANGUAGE_NAME, DEFAULT_VOICE_BY_LANG, formatDuration, formatRelativeTime };

