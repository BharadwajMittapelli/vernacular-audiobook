import React from 'react';

export function TranscriptHighlighter({ alignment, currentSentenceIndex = -1, onSeek }) {
  const containerRef = React.useRef(null);
  const nodeByIndex = React.useRef({});
  const [autoFollow, setAutoFollow] = React.useState(true);

  // Auto-scroll fires only when the active sentence INDEX changes (or follow
  // is toggled back on), never on every timeupdate tick.
  React.useEffect(() => {
    if (autoFollow && currentSentenceIndex >= 0) {
      nodeByIndex.current[currentSentenceIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentSentenceIndex, autoFollow]);

  if (!alignment || alignment.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        <p>No transcript available.</p>
        <p className="mt-1 text-xs">Generate audio to see synchronized text.</p>
      </div>
    );
  }

  const suspendFollow = () => setAutoFollow(false);
  const handleSentenceActivate = (startTime) => {
    setAutoFollow(true);
    onSeek?.(startTime);
  };

  return (
    <div
      ref={containerRef}
      onWheel={suspendFollow}
      onTouchMove={suspendFollow}
      className="max-w-prose mx-auto max-h-[60vh] overflow-y-auto scrollbar-thin pr-2 space-y-1 font-serif text-base leading-relaxed"
      role="log"
      aria-label="Transcript"
      aria-live="polite"
    >
      {!autoFollow && (
        <div className="sticky top-0 z-10 flex justify-center py-2 pointer-events-none">
          <button
            onClick={() => setAutoFollow(true)}
            className="pointer-events-auto rounded-full border border-border bg-background/90 backdrop-blur px-3 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
          >
            Jump to current
          </button>
        </div>
      )}
      {alignment.map((entry, index) => {
        const isActive = index === currentSentenceIndex;
        return (
          <p
            key={entry.sentenceIndex ?? index}
            ref={(el) => {
              if (el) nodeByIndex.current[index] = el;
              else delete nodeByIndex.current[index];
            }}
            onClick={() => handleSentenceActivate(entry.startTime)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSentenceActivate(entry.startTime);
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
