import React from 'react';

export function TranscriptHighlighter({ alignment, currentTime = 0, onSeek }) {
  if (!alignment || alignment.length === 0) {
    return (
      <div className="prose text-muted-foreground">
        <p>No transcript available. Generate audio to see synchronized text.</p>
      </div>
    );
  }

  return (
    <div className="prose max-w-none">
      {alignment.map((entry, index) => {
        const active = currentTime >= entry.startTime && currentTime < entry.endTime;
        return (
          <p
            key={entry.sentenceIndex ?? index}
            onClick={() => onSeek?.(entry.startTime)}
            className={
              active
                ? 'cursor-pointer text-primary font-bold bg-primary/10 rounded-sm px-1 -mx-1 transition-all duration-100'
                : 'cursor-pointer text-muted-foreground transition-all duration-100'
            }
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSeek?.(entry.startTime);
              }
            }}
          >
            {entry.text}
          </p>
        );
      })}
    </div>
  );
}
