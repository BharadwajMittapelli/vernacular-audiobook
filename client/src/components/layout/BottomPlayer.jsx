import React from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '../ui/button.jsx';

function formatTime(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function BottomPlayer({
  audioUrl,
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  currentChapterTitle,
  bookTitle,
  bookCoverUrl,
  onPlay,
  onPause,
  onRewind,
  onForward,
  onSeek,
  onRateChange,
}) {
  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    onSeek(percent * (duration || 1));
  };

  const hasAudio = !!audioUrl;
  const chapterTitle = currentChapterTitle || '';
  const initials = (chapterTitle || bookTitle || 'A')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="shrink-0 border-t border-border bg-card flex flex-col h-auto min-h-[72px]"
      role="region"
      aria-label="Audio player"
    >
      {/* Progress bar */}
      <div
        className="h-4 flex items-center px-4 cursor-pointer"
        onClick={handleProgressClick}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration || 0}
        aria-valuenow={currentTime || 0}
      >
        <div className="flex-1 h-1 bg-border rounded-full relative overflow-hidden">
          <div
            className="h-full bg-terracotta rounded-full transition-[width] duration-75"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
          <div
            className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-terracotta -translate-y-1/2"
            style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, transform: 'translate(-50%, -50%)' }}
          />
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        {/* Cover + title */}
        {chapterTitle && (
          <div className="flex items-center gap-2 w-32 shrink-0 min-w-[120px]">
            {bookCoverUrl ? (
              <img
                src={bookCoverUrl}
                alt=""
                className="w-10 h-10 rounded object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded bg-terracotta/20 flex items-center justify-center text-terracotta text-xs font-bold shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">
                {chapterTitle}
              </p>
              {bookTitle && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {bookTitle}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Play controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRewind}
            disabled={!hasAudio}
            aria-label="Previous"
            className="rounded-full h-8 w-8"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={isPlaying ? onPause : onPlay}
            disabled={!hasAudio}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="rounded-full h-10 w-10 bg-foreground hover:bg-foreground/90 text-background"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onForward}
            disabled={!hasAudio}
            aria-label="Next"
            className="rounded-full h-8 w-8"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Timestamps */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums shrink-0">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div className="flex-1 min-w-0" />

        {/* Speed */}
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="player-speed" className="text-xs text-muted-foreground">
            Speed
          </label>
          <select
            id="player-speed"
            value={playbackRate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
            disabled={!hasAudio}
            className="bg-elevated border border-border rounded-full px-3 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-terracotta/40 disabled:opacity-50 cursor-pointer"
            aria-label="Playback speed"
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
              <option key={r} value={r}>{r}x</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
