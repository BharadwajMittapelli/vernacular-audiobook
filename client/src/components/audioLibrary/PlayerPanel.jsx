import React, { useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Download, ExternalLink, Heart, ChevronDown, Camera } from 'lucide-react';
import { DEFAULT_VOICE_BY_LANG, LANGUAGE_FLAG, LANGUAGE_NAME } from './AudioRow.jsx';
import { uploadArtwork } from '../../services/api.js';

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
  onArtworkUpdate,
}) {
  const fileInputRef = useRef(null);

  const handleArtworkClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/jpeg')) {
      alert('Only JPEG images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size exceeds 5MB limit.');
      return;
    }

    try {
      const result = await uploadArtwork(activeChapter.bookId, file);
      onArtworkUpdate?.(result.coverUrl);
    } catch (err) {
      console.error('Failed to upload artwork:', err);
      alert('Failed to upload artwork.');
    }
  };

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
  const durationSec = Math.max(1, Math.floor(progress.duration));
  const currentTimeSec = Math.min(progress.currentTime, durationSec);
  const progressPct = durationSec > 0 && Number.isFinite(currentTimeSec)
    ? Math.min(100, Math.max(0, (currentTimeSec / durationSec) * 100))
    : 0;
  const durationStr = formatDuration(activeChapter.durationSeconds);
  const currentStr = formatDuration(Math.floor(currentTimeSec));

  return (
    <div className="pb-4">
      {/* Cover */}
      <div className="flex flex-col items-center text-center mb-3 relative">
        <div 
          className="w-44 h-44 rounded-xl overflow-hidden bg-muted shadow-xl mb-4 relative cursor-pointer group"
          onClick={handleArtworkClick}
        >
          {activeChapter.coverUrl ? (
            <>
              <img
                src={activeChapter.coverUrl}
                alt={activeChapter.bookTitle}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-muted-foreground group-hover:bg-muted/80 transition-colors">
              <div className="flex flex-col items-center gap-2">
                <span>{(activeChapter.bookTitle || '').slice(0, 2).toUpperCase()}</span>
                <Camera className="h-5 w-5 text-muted-foreground/50" />
              </div>
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle?.();
            }}
            className={`absolute top-4 right-4 p-1.5 rounded-full bg-background/90 backdrop-blur-sm hover:bg-background transition-colors shadow-md ${
              isFavorite ? 'text-terracotta' : 'text-muted-foreground hover:text-terracotta'
            }`}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        <h2 className="font-serif text-lg font-semibold text-foreground leading-tight px-2 max-w-full">
          {activeChapter.chapterTitle}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{activeChapter.bookTitle}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Chapter {String(activeChapter.sequenceNumber).padStart(2, '0')} • {durationStr}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-4">
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
          className="w-14 h-14 rounded-full bg-terracotta text-white flex items-center justify-center hover:opacity-90 transition-opacity shadow-lg"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying
            ? <Pause className="h-6 w-6" />
            : <Play className="h-6 w-6 ml-0.5" />
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
          max={durationSec}
          value={currentTimeSec}
          onChange={(e) => onSeek(Number(e.target.value))}
          style={{
            background: `linear-gradient(to right, hsl(var(--terracotta)) ${progressPct}%, hsl(var(--border)) ${progressPct}%)`,
          }}
          className="w-full h-[5px] accent-terracotta cursor-pointer appearance-none rounded-full
            [&::-webkit-slider-runnable-track]:h-[5px] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-terracotta [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:mt-[-5.5px]
            [&::-moz-range-track]:h-[5px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent
            [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-terracotta [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:mt-[-5.5px]"
          aria-label="Seek"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1.5 font-medium">
          <span>{currentStr}</span>
          <span>{durationStr}</span>
        </div>
      </div>

      {/* Metadata */}
      <div className="space-y-2 mb-4 p-4 rounded-xl bg-muted/50 border border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Language</span>
          <span className="text-foreground flex items-center gap-1.5">
            <span className="text-sm">{flag}</span>
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
