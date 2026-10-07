import React from 'react';
import { Play, Pause, SkipBack, FastForward } from 'lucide-react';
import { Button } from '../ui/button.jsx';

export function PlaybackControls({
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  onPlay,
  onPause,
  onSeek,
  onRewind,
  onRateChange,
}) {
  const formatTime = (time) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    onSeek(percent * duration);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4">
      <div className="bg-background/95 backdrop-blur-sm border rounded-full shadow-lg p-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onRewind}>
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button
              variant="default"
              size="lg"
              className="h-12 w-12"
              onClick={isPlaying ? onPause : onPlay}
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onSeek(currentTime + 15)}>
              <FastForward className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <div
              className="flex-1 h-2 bg-secondary rounded-full cursor-pointer relative"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-primary rounded-full transition-all duration-75"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-10">
              {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{playbackRate.toFixed(1)}x</span>
            <select
              value={playbackRate}
              onChange={(e) => onRateChange(parseFloat(e.target.value))}
              className="bg-secondary border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}