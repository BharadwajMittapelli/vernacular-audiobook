import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Download, ExternalLink, Heart, ChevronDown } from 'lucide-react';
import { DEFAULT_VOICE_BY_LANG, LANGUAGE_FLAG, LANGUAGE_NAME } from './AudioRow.jsx';

export function PlayerPanel({
  activeChapter,
  isPlaying,
  progress,
  playbackRate,
  isFavorite,
  onPlayPause,
  onSeek,
  onSkip,
  onPlaybackRateChange,
  onFavoriteToggle,
  onDownload,
  onOpenStudio,
}) {
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
    <div>
      {/* Cover */}
      <div className="flex flex-col items-center text-center mb-6 relative">
        <div className="w-52 h-52 rounded-xl overflow-hidden bg-muted shadow-xl mb-3 relative">
          {activeChapter.coverUrl ? (
            <img
              src={activeChapter.coverUrl}
              alt={activeChapter.bookTitle}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-muted-foreground">
              {(activeChapter.bookTitle || '').slice(0, 2).toUpperCase()}
            </div>
          )}
          <button
            onClick={onFavoriteToggle}
            className={`absolute top-4 right-4 p-2 rounded-full bg-background/90 backdrop-blur-sm hover:bg-background transition-colors shadow-md ${
              isFavorite ? 'text-terracotta' : 'text-muted-foreground hover:text-terracotta'
            }`}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>
        <h2 className="font-serif text-xl font-semibold text-foreground leading-tight px-2 max-w-full">
          {activeChapter.chapterTitle}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{activeChapter.bookTitle}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Chapter {String(activeChapter.sequenceNumber).padStart(2, '0')} • {durationStr}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          onClick={() => onSkip(-10)}
          className="p-2.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Skip back 10 seconds"
          title="Skip back 10s"
        >
          <SkipBack className="h-5 w-5" />
        </button>

        <button
          onClick={() => onPlayPause(!isPlaying)}
          className="w-16 h-16 rounded-full bg-terracotta text-white flex items-center justify-center hover:opacity-90 transition-opacity shadow-lg"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying
            ? <Pause className="h-6 w-6" />
            : <Play className="h-6 w-6 ml-0.5" />
          }
        </button>

        <button
          onClick={() => onSkip(10)}
          className="p-2.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Skip forward 10 seconds"
          title="Skip forward 10s"
        >
          <SkipForward className="h-5 w-5" />
        </button>
      </div>

      {/* Timeline */}
      <div className="mb-6">
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(progress.duration))}
          value={Math.floor(progress.currentTime)}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full h-1.5 accent-terracotta cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-terracotta [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-terracotta [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white"
          aria-label="Seek"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1.5 font-medium">
          <span>{currentStr}</span>
          <span>{durationStr}</span>
        </div>
      </div>

      {/* Metadata */}
      <div className="space-y-3 mb-6 p-4 rounded-xl bg-muted/50 border border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Language</span>
          <span className="text-foreground flex items-center gap-1.5">
            <span className="text-base">{flag}</span>
            <span className="font-medium">{langName}</span>
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Voice</span>
          <div className="flex items-center gap-1.5">
            <span className="text-foreground font-medium">{voiceName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Speed</span>
          <button
            onClick={onPlaybackRateChange}
            className="px-3 py-1 rounded-lg bg-background border border-border text-foreground text-xs font-medium hover:bg-terracotta/10 hover:text-terracotta hover:border-terracotta/30 transition-colors"
          >
            {playbackRate.toFixed(1)}x
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onDownload}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity w-full"
        >
          <Download className="h-4 w-4" />
          <span>Download Audio</span>
        </button>
        <button
          onClick={onOpenStudio}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-muted hover:border-terracotta/50 transition-colors w-full"
        >
          <ExternalLink className="h-4 w-4" />
          <span>Open in Studio</span>
        </button>
      </div>
    </div>
  );
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
