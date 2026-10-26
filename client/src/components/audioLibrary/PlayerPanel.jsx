import React, { useRef, useCallback, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Download, ExternalLink, Heart } from 'lucide-react';
import { DEFAULT_VOICE_BY_LANG, LANGUAGE_FLAG, LANGUAGE_NAME } from './AudioRow.jsx';

export function PlayerPanel({
  activeChapter,
  isPlaying,
  progress,
  playbackRate,
  onPlayPause,
  onSeek,
  onSkip,
  onPlaybackRateChange,
  onDownload,
  onOpenStudio,
}) {
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeChapter) return;

    audio.src = activeChapter.audioUrl;
    audio.playbackRate = playbackRate;
    audio.play().catch(() => {});
  }, [activeChapter?.chapterId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      onSeek(audio.currentTime, audio.duration);
    };
    const onEnded = () => onPlayPause(false);
    const onLoadedMetadata = () => onSeek(0, audio.duration);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [onPlayPause, onSeek]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  if (!activeChapter) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center gap-3 p-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <p className="text-sm font-medium text-foreground">Select a chapter to play</p>
        <p className="text-xs text-muted-foreground">Choose from the library to start listening</p>
      </div>
    );
  }

  const lang = activeChapter.language || 'en-IN';
  const flag = LANGUAGE_FLAG[lang] || '🇮🇳';
  const langName = LANGUAGE_NAME[lang] || 'English';
  const voiceName = activeChapter.voiceName || DEFAULT_VOICE_BY_LANG[lang] || 'Kaveri';
  const durationStr = formatDuration(activeChapter.durationSeconds);
  const currentStr = formatDuration(Math.floor(progress.currentTime));

  return (
    <>
      <audio ref={audioRef} preload="metadata" />

      {/* Cover */}
      <div className="flex flex-col items-center text-center mb-4">
        <div className="w-40 h-40 rounded-xl overflow-hidden bg-muted shadow-lg mb-3 relative">
          {activeChapter.coverUrl ? (
            <img
              src={activeChapter.coverUrl}
              alt={activeChapter.bookTitle}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
              {(activeChapter.bookTitle || '').slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <button
          className="absolute top-3 right-3 p-1.5 rounded-full bg-background/80 hover:bg-background text-muted-foreground hover:text-terracotta transition-colors"
          aria-label="Add to favorites"
          title="Add to favorites"
        >
          <Heart className="h-4 w-4" />
        </button>
        <h2 className="font-serif text-lg font-semibold text-foreground leading-tight px-2">
          {activeChapter.chapterTitle}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">{activeChapter.bookTitle}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Chapter {String(activeChapter.sequenceNumber).padStart(2, '0')} • {durationStr}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <button
          onClick={() => onSkip(-10)}
          className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Skip back 10 seconds"
          title="Skip back 10s"
        >
          <SkipBack className="h-5 w-5" />
        </button>

        <button
          onClick={() => onPlayPause(!isPlaying)}
          className="w-12 h-12 rounded-full bg-terracotta text-white flex items-center justify-center hover:opacity-90 transition-opacity"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying
            ? <Pause className="h-5 w-5" />
            : <Play className="h-5 w-5 ml-0.5" />
          }
        </button>

        <button
          onClick={() => onSkip(10)}
          className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Skip forward 10 seconds"
          title="Skip forward 10s"
        >
          <SkipForward className="h-5 w-5" />
        </button>
      </div>

      {/* Timeline */}
      <div className="mb-4">
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(progress.duration))}
          value={Math.floor(progress.currentTime)}
          onChange={(e) => onSeek(Number(e.target.value), progress.duration)}
          className="w-full h-1 accent-terracotta cursor-pointer"
          aria-label="Seek"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{currentStr}</span>
          <span>{durationStr}</span>
        </div>
      </div>

      {/* Metadata */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Language</span>
          <span className="text-foreground flex items-center gap-1">
            <span>{flag}</span>
            <span>{langName}</span>
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Voice</span>
          <span className="text-foreground">{voiceName}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Speed</span>
          <button
            onClick={() => onPlaybackRateChange(playbackRate)}
            className="px-2 py-0.5 rounded-md bg-muted text-foreground text-xs font-medium hover:bg-terracotta/20 hover:text-terracotta transition-colors"
          >
            {playbackRate.toFixed(2)}x
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onDownload}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Download className="h-4 w-4" />
          <span>Download</span>
        </button>
        <button
          onClick={onOpenStudio}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          <span>Open in Studio</span>
        </button>
      </div>
    </>
  );
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
