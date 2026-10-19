import React from 'react';
import { TranscriptHighlighter } from './TranscriptHighlighter.jsx';

export function ReadAlongPlayer({
  audioUrl,
  alignment,
  chapterText,
  currentTime = 0,
  currentSentenceIndex = -1,
  onSeek,
}) {
  // Priority 1: Audio exists with alignment data — show synchronized transcript
  if (audioUrl && alignment?.length > 0) {
    return (
      <TranscriptHighlighter
        alignment={alignment}
        currentTime={currentTime}
        currentSentenceIndex={currentSentenceIndex}
        onSeek={onSeek}
      />
    );
  }

  // Priority 2: Audio exists but alignment missing — show sync-unavailable message
  if (audioUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-center text-sm">No synchronization data available</p>
        <p className="text-center text-xs mt-1 text-muted-foreground/60">
          Audio is ready but alignment data is missing
        </p>
      </div>
    );
  }

  // Priority 3: Chapter text exists — show plain formatted text
  const hasText = chapterText && chapterText.trim().length > 0;
  if (hasText) {
    return (
      <div className="max-w-prose mx-auto font-serif text-base leading-relaxed whitespace-pre-wrap text-foreground px-4">
        {chapterText}
      </div>
    );
  }

  // Priority 4: No content available — empty state
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <p className="text-center text-sm">No content available</p>
      <p className="text-center text-xs mt-1 text-muted-foreground/60">
        Load a book or generate audio to view the transcript
      </p>
    </div>
  );
}
