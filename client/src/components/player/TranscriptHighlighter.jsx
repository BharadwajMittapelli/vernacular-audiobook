import React from 'react';

export function TranscriptHighlighter({ alignment, currentSentenceIndex, onSentenceClick }) {
  if (!alignment || alignment.length === 0) {
    return (
      <div className="prose text-muted-foreground">
        <p>No transcript available. Generate audio to see synchronized text.</p>
      </div>
    );
  }

  return (
    <div className="prose max-w-none">
      {alignment.map((entry, index) => (
        <p
          key={entry.sentenceIndex}
          onClick={() => onSentenceClick(index)}
          className={
            index === currentSentenceIndex
              ? 'cursor-pointer text-primary font-bold bg-primary/10 rounded-sm px-1 -mx-1 transition-all duration-100'
              : 'cursor-pointer text-muted-foreground transition-all duration-100'
          }
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSentenceClick(index);
            }
          }}
        >
          {entry.text}
        </p>
      ))}
    </div>
  );
}