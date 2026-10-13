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
  if (!audioUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-center text-sm">No audio generated yet</p>
        <p className="text-center text-xs mt-1 text-muted-foreground/60">
          Open Configure to generate audio for this chapter
        </p>
      </div>
    );
  }

  return (
    <TranscriptHighlighter
      alignment={alignment}
      currentTime={currentTime}
      currentSentenceIndex={currentSentenceIndex}
      onSeek={onSeek}
    />
  );
}
