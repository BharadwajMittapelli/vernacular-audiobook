import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
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
  onPlay,
  onPause,
  onSeek,
  onRewind,
  onForward,
  onRateChange,
}) {
  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    onSeek(percent * duration);
  };

  const hasAudio = !!audioUrl;

  return (
    <div
      className="shrink-0 border-t border-border bg-card h-20 flex flex-col"
      role="region"
      aria-label="Audio player"
    >
      {/* Progress bar */}
          <div className="flex-1 h-1.5 bg-border rounded-full cursor-pointer" onClick={handleProgressClick}>
        <div
          className="h-full bg-primary transition-[width] duration-75"
          style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>

      <div className="flex-1 flex items-center gap-3 px-4">
        {/* Chapter label */}
        {currentChapterTitle && (
          <div className="hidden sm:block w-48 shrink-0">
            <p className="text-xs font-medium text-foreground truncate">{currentChapterTitle}</p>
            <p className="text-xs text-muted-foreground">Chapter</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRewind}
            disabled={!hasAudio}
            aria-label="Previous sentence"
            title="Previous sentence"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={isPlaying ? onPause : onPlay}
            disabled={!hasAudio}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="h-9 w-9"
          >
            {isPlaying
              ? <Pause className="h-4 w-4" />
              : <Play className="h-4 w-4" />
            }
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onForward}
            disabled={!hasAudio}
            aria-label="Next sentence"
            title="Next sentence"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Time + seek */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="text-xs text-muted-foreground w-10 text-right shrink-0 tabular-nums">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 h-1.5 bg-elevated rounded-full cursor-pointer" />
          <span className="text-xs text-muted-foreground w-10 shrink-0 tabular-nums">
            {formatTime(duration)}
          </span>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-2 shrink-0">
          <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={playbackRate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
            disabled={!hasAudio}
            className="bg-elevated border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 cursor-pointer"
            aria-label="Playback speed"
          >
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1}>1x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
        </div>
      </div>
    </div>
  );
}
