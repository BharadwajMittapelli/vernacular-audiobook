import React from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import { Slider } from '../ui/slider.jsx';

/**
 * Rewind 10 seconds.
 * Circular arrow with an upper-left arrowhead and centered "10".
 */
function Rewind10({ className = 'h-8 w-8' }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Circular rewind arc */}
      <path
        d="M 9 11 A 12 12 0 1 1 7 22"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Upper-left arrowhead */}
      <path
        d="M 15 5 L 7 5 L 7 13"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Centered 10-second label */}
      <text
        x="18"
        y="20"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="9"
        fontWeight="600"
        fill="currentColor"
        stroke="none"
      >
        10
      </text>
    </svg>
  );
}

/**
 * Forward 10 seconds.
 * Circular arrow with an upper-right arrowhead and centered "10".
 */
function Forward10({ className = 'h-8 w-8' }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Circular forward arc */}
      <path
        d="M 27 11 A 12 12 0 1 0 29 22"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Upper-right arrowhead */}
      <path
        d="M 21 5 L 29 5 L 29 13"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Centered 10-second label */}
      <text
        x="18"
        y="20"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="9"
        fontWeight="600"
        fill="currentColor"
        stroke="none"
      >
        10
      </text>
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

      {/* Play controls: Rewind | Play/Pause | Forward */}
      <div className="flex items-center justify-center gap-5 shrink-0">
        {/* Rewind 10 seconds */}
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label="Rewind 10 seconds"
          title="Rewind 10 seconds"
          disabled={!hasAudio}
          onClick={onRewind10}
          className="h-8 w-8 shrink-0 rounded-full p-0 text-foreground hover:bg-transparent"
        >
          <Rewind10 className="h-8 w-8" />
        </Button>

        {/* Main Play/Pause control */}
        <Button
          type="button"
          variant="default"
          size="icon"
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          title={isPlaying ? 'Pause' : 'Play'}
          disabled={!hasAudio}
          onClick={isPlaying ? onPause : onPlay}
          className="h-12 w-12 shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90"
        >
          {isPlaying ? (
            <Pause className="h-6 w-6" fill="currentColor" />
          ) : (
            <Play className="h-6 w-6" fill="currentColor" />
          )}
        </Button>

        {/* Forward 10 seconds */}
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label="Forward 10 seconds"
          title="Forward 10 seconds"
          disabled={!hasAudio}
          onClick={onForward10}
          className="h-8 w-8 shrink-0 rounded-full p-0 text-foreground hover:bg-transparent"
        >
          <Forward10 className="h-8 w-8" />
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

      {/* Playback speed selector */}
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
            <option key={r} value={r}>
              {r}x
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
