import React from 'react';
import { Play, Pause } from 'lucide-react';

export function AudioRow({ item, isActive, isPlaying, onPlayPause, onClick }) {
  const language = item.language || 'en-IN';
  const voiceName = item.voiceName || 'Kaveri';
  const duration = formatDuration(item.durationSeconds);
  const timeAgo = formatRelativeTime(item.createdAt);

  const flagEmoji = LANGUAGE_FLAG[language] || '🇮🇳';
  const langName = LANGUAGE_NAME[language] || 'English';

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors
        ${isActive
          ? 'bg-terracotta/10 border border-terracotta/20'
          : 'hover:bg-muted border border-transparent'
        }
      `}
    >
      {/* Play toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onPlayPause(item.chapterId); }}
        className={`
          w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors
          ${isActive && isPlaying
            ? 'bg-terracotta text-white'
            : 'bg-muted text-muted-foreground hover:bg-terracotta/20 hover:text-terracotta'
          }
        `}
        aria-label={isActive && isPlaying ? 'Pause' : 'Play'}
      >
        {isActive && isPlaying
          ? <Pause className="h-3.5 w-3.5" />
          : <Play className="h-3.5 w-3.5" />
        }
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? 'text-terracotta' : 'text-foreground'}`}>
          {item.chapterTitle}
        </p>
        <p className="text-xs text-muted-foreground truncate">{item.bookTitle}</p>
      </div>

      {/* Book cover + name */}
      <div className="flex items-center gap-2 w-28 shrink-0">
        <div className="w-8 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
          {item.coverUrl ? (
            <img src={item.coverUrl} alt={item.bookTitle} className="w-full h-full object-cover" />
          ) : (
            (item.bookTitle || '').slice(0, 2).toUpperCase()
          )}
        </div>
        <span className="text-xs text-muted-foreground truncate">{item.bookTitle}</span>
      </div>

      {/* Chapter number */}
      <span className="text-xs text-muted-foreground w-16 shrink-0">
        Chapter {String(item.sequenceNumber).padStart(2, '0')}
      </span>

      {/* Language */}
      <span className="text-xs text-muted-foreground w-20 shrink-0 flex items-center gap-1">
        <span>{flagEmoji}</span>
        <span className="truncate">{langName}</span>
      </span>

      {/* Voice */}
      <span className="text-xs text-muted-foreground w-16 shrink-0 truncate" title={voiceName}>
        {voiceName}
      </span>

      {/* Duration */}
      <span className="text-xs text-muted-foreground w-12 shrink-0 text-right">
        {duration}
      </span>

      {/* Created */}
      <span className="text-xs text-muted-foreground w-20 shrink-0 hidden sm:block">
        {timeAgo}
      </span>

      {/* More */}
      <button
        className="shrink-0 p-1.5 rounded-md hover:bg-muted text-muted-foreground"
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
  if (!dateStr) return '';
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

export { LANGUAGE_FLAG, LANGUAGE_NAME, DEFAULT_VOICE_BY_LANG };
export { MoreHorizontal } from 'lucide-react';
