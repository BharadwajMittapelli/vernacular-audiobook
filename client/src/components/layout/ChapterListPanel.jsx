import React from 'react';

function estimateMinutes(ch) {
  if (!ch || !ch.text) return 0;
  const words = ch.text.replace(/[#*`_\[\]]/g, '').trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / 160);
}

export function ChapterListPanel({ book, activeChapterIdx, onChapterSelect }) {
  if (!book) return null;

  return (
    <div className="px-3 pb-2 border-t border-border pt-3">
      <div className="flex items-center gap-2 px-1 mb-2">
        <div className="w-6 h-8 shrink-0 rounded bg-terracotta/20 flex items-center justify-center text-[9px] font-bold text-terracotta">
          {book.title?.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">{book.title}</p>
          <p className="text-xs text-muted-foreground">{book.chapters.length} chapters</p>
        </div>
      </div>
      <p className="px-1 mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Chapters
      </p>
      <div className="space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin">
        {book.chapters.map((ch, i) => {
          const dotColor = {
            completed: 'bg-green-500',
            processing: 'bg-yellow-500 animate-pulse',
            failed: 'bg-red-500',
            pending: 'bg-gray-300',
          }[ch.status] ?? 'bg-gray-300';
          return (
            <button
              key={ch.chapterId}
              onClick={() => onChapterSelect?.(i)}
              className={`
                w-full flex items-center text-left px-1 py-1.5 rounded-md text-sm transition-colors
                ${i === activeChapterIdx
                  ? 'bg-terracotta/10 text-terracotta font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }
              `}
              aria-current={i === activeChapterIdx ? 'true' : undefined}
            >
              <span className="text-xs text-muted-foreground shrink-0 mr-1.5 font-mono">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
              <span className="truncate flex-1">{ch.title}</span>
              <span className="text-xs text-muted-foreground shrink-0 ml-1">
                {estimateMinutes(ch)}m
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}