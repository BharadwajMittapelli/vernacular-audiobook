import React from 'react';

export function TranscriptHighlighter({ alignment, currentSentenceIndex = -1, onSeek }) {
  if (!alignment || alignment.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        <p>No transcript available.</p>
        <p className="mt-1 text-xs">Generate audio to see synchronized text.</p>
      </div>
    );
  }

  return (
    <div
      className="max-w-prose mx-auto space-y-1 font-serif text-base leading-relaxed"
      role="log"
      aria-label="Transcript"
      aria-live="polite"
    >
      {alignment.map((entry, index) => {
        const isActive = index === currentSentenceIndex;
        return (
          <p
            key={entry.sentenceIndex ?? index}
            onClick={() => onSeek?.(entry.startTime)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSeek?.(entry.startTime);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`Play: ${entry.text}`}
            aria-current={isActive ? 'true' : undefined}
            className={`
              px-3 py-1.5 rounded-md cursor-pointer transition-colors
              ${isActive
                ? 'bg-terracotta/10 text-foreground font-medium'
                : 'text-foreground hover:bg-muted'
              }
            `}
          >
            {entry.text}
          </p>
        );
      })}
    </div>
  );
}
