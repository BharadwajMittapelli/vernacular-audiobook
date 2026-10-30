import React from 'react';
import { useAudio } from '../../context/AudioContext.jsx';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';

export function GlobalPlayer() {
  const { activeChapter, isPlaying, currentTime, duration, play, pause, seek } = useAudio();

  if (!activeChapter) return null;

  const formatTime = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-20 bg-card border-t border-border flex items-center px-6 gap-6 shrink-0 z-40 sticky bottom-0">
      <div className="flex items-center gap-3 w-64 shrink-0">
        <div className="w-12 h-14 bg-muted rounded overflow-hidden shrink-0">
          {activeChapter.coverUrl ? (
            <img src={activeChapter.coverUrl} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-bold bg-terracotta/10 text-terracotta">
              {(activeChapter.bookTitle || '').slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{activeChapter.chapterTitle || 'Chapter'}</p>
          <p className="text-xs text-muted-foreground truncate">{activeChapter.bookTitle || 'Audiobook'}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center gap-1.5 max-w-xl mx-auto">
        <div className="flex items-center gap-4">
          <button onClick={() => seek(Math.max(0, currentTime - 10))} className="text-muted-foreground hover:text-foreground">
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={() => isPlaying ? pause() : play(activeChapter)}
            className="w-10 h-10 rounded-full bg-terracotta text-white flex items-center justify-center hover:opacity-95 transition-opacity"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>
          <button onClick={() => seek(Math.min(duration, currentTime + 10))} className="text-muted-foreground hover:text-foreground">
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        <div className="w-full flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="flex-1 accent-terracotta h-1 bg-border rounded-lg cursor-pointer"
          />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="w-64 flex items-center justify-end gap-3 shrink-0">
        <Volume2 className="h-4 w-4 text-muted-foreground" />
        <div className="w-24 h-1 bg-border rounded-lg" />
      </div>
    </div>
  );
}
