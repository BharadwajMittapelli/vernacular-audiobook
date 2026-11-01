import React, { useState, useRef } from 'react';
import { Play, Pause, MoreHorizontal, Heart } from 'lucide-react';
import { renameChapter } from '../../services/api.js';

export function AudioRow({ item, isActive, isPlaying, isFavorite, isSelected, onPlay, onSelect, onFavoriteToggle, onChapterUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const originalTitleRef = useRef(item.chapterTitle);

  const language = item.language || 'en-IN';
  const voiceName = item.voiceName || 'Kaveri';
  const duration = formatDuration(item.durationSeconds);
  const timeAgo = formatRelativeTime(item.createdAt);

  const flagEmoji = LANGUAGE_FLAG[language] || '🇮🇳';
  const langName = LANGUAGE_NAME[language] || 'English';
  const bookInitials = (item.bookTitle || '').slice(0, 2).toUpperCase();

  const handleTitleClick = () => {
    if (!isEditing) {
      setEditValue(item.chapterTitle);
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setError('Title cannot be empty');
      return;
    }
    if (trimmed === originalTitleRef.current) {
      setIsEditing(false);
      return;
    }
    if (saving) return;

    setSaving(true);
    setError('');
    try {
      const updatedChapter = await renameChapter(item.chapterId, trimmed);
      if (onChapterUpdate) {
        onChapterUpdate(updatedChapter);
      }
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
      setEditValue(originalTitleRef.current);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
    setEditValue(originalTitleRef.current);
  };

  const handleBlur = () => {
    handleCancel();
  };

  return (
    <div
      onClick={onSelect ? () => onSelect(item.chapterId) : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect?.(item.chapterId);
        }
      }}
      className="flex items-center gap-3 px-3 py-3 rounded-xl bg-terracotta/10 border border-terracotta/20 shadow-sm"
    >
      {/* Play toggle */}
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

      {/* Book column — chapter title + thumbnail + book name */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
              onBlur={handleBlur}
              className="text-sm font-semibold text-foreground font-serif leading-tight border-b border-terracotta bg-transparent outline-none px-1 -mx-1 w-full truncate"
              autoFocus
              disabled={saving}
            />
            {error && <span className="text-xs text-destructive">{error}</span>}
          </div>
        ) : (
          <p
            onClick={handleTitleClick}
            className={`text-sm font-semibold truncate font-serif leading-tight cursor-text hover:bg-muted/50 rounded px-1 -mx-1 transition-colors ${isSelected ? 'text-terracotta' : 'text-foreground'}`}
          >
            {item.chapterTitle}
          </p>
        )}
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

      {/* Chapter column */}
      <span className="hidden md:block text-xs text-muted-foreground w-16 shrink-0 font-medium text-center">
        Chapter {String(item.sequenceNumber || 1).padStart(2, '0')}
      </span>

      {/* Language column */}
      <span className="hidden md:flex text-xs text-muted-foreground w-20 shrink-0 items-center gap-1.5 font-medium justify-center">
        <span className="text-sm">{flagEmoji}</span>
        <span className="truncate">{langName}</span>
      </span>

      {/* Voice column */}
      <span className="hidden lg:block text-xs text-muted-foreground w-16 shrink-0 truncate font-medium text-center" title={voiceName}>
        {voiceName}
      </span>

      {/* Duration column */}
      <span className="text-xs text-muted-foreground w-14 shrink-0 text-right font-medium">
        {duration}
      </span>

      {/* Created column */}
      <span className="hidden md:block text-xs text-muted-foreground w-16 shrink-0 text-right font-medium">
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

      {/* Actions */}
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
