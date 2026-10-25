import React from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import { Slider } from '../ui/slider.jsx';

function Rewind10({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 10a9 9 0 1 1-.5 4" />
      <polyline points="3 14 3 10 7 10" />
      <text x="15" y="15" fontSize="8" fontWeight="bold" fill="currentColor" textAnchor="middle" dominantBaseline="middle">10</text>
    </svg>
  );
}

function Forward10({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 10a9 9 0 1 1-.5 4" />
      <polyline points="21 14 21 10 17 10" />
      <text x="9" y="15" fontSize="8" fontWeight="bold" fill="currentColor" textAnchor="middle" dominantBaseline="middle">10</text>
    </svg>
  );
}

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
  onRewind10,
  onForward10,
  onSeek,
  onRateChange,
}) {
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
      className="shrink-0 border-t border-border bg-card flex items-center h-[52px] px-4 gap-2"
      role="region"
      aria-label="Audio player"
    >
      {/* Book info */}
      {chapterTitle && (
        <div className="flex items-center gap-2 w-[120px] shrink-0 min-w-[100px]">
          {bookCoverUrl ? (
            <img
              src={bookCoverUrl}
              alt=""
              className="w-9 h-9 rounded object-cover shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded bg-terracotta/20 flex items-center justify-center text-terracotta text-xs font-bold shrink-0">
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
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRewind10}
          disabled={!hasAudio}
          aria-label="Rewind 10 seconds"
          className="rounded-full h-8 w-8 cursor-pointer"
        >
          <Rewind10 className="h-4 w-4" />
        </Button>
        <Button
          variant="default"
          size="icon"
          onClick={isPlaying ? onPause : onPlay}
          disabled={!hasAudio}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="rounded-full h-9 w-9 bg-foreground hover:bg-foreground/90 text-background cursor-pointer"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onForward10}
          disabled={!hasAudio}
          aria-label="Forward 10 seconds"
          className="rounded-full h-8 w-8 cursor-pointer"
        >
          <Forward10 className="h-4 w-4" />
        </Button>
      </div>

      {/* Elapsed time */}
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
        {formatTime(currentTime)}
      </span>

      {/* Seek slider */}
      <Slider
        min={0}
        max={duration || 1}
        step={0.1}
        value={[currentTime]}
        onValueChange={([v]) => onSeek(v)}
        disabled={!hasAudio}
        className="flex-1 min-w-0 mx-2"
        aria-label="Seek audio"
      />

      {/* Total duration */}
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
        {formatTime(duration)}
      </span>

      {/* Speed selector */}
      <div className="flex items-center gap-1.5 shrink-0">
        <label htmlFor="player-speed" className="text-xs text-muted-foreground">
          Speed
        </label>
        <select
          id="player-speed"
          value={playbackRate}
          onChange={(e) => onRateChange(parseFloat(e.target.value))}
          disabled={!hasAudio}
          className="bg-elevated border border-border rounded-full px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-terracotta/40 disabled:opacity-50 cursor-pointer"
          aria-label="Playback speed"
        >
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
            <option key={r} value={r}>{r}x</option>
          ))}
        </select>
      </div>
    </div>
  );
}
