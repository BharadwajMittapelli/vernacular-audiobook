import React from 'react';

// mirrors server stripMarkdown (textProcessor.js) — same formula as estimateCredits in App
const stripMarkdown = (text) => text.replace(/[#*`_\[\]]/g, '');
const estimateCredits = (text) => Math.ceil(stripMarkdown(text || '').trim().length / 100);

export function CreditEstimateBadge({ text }) {
  const chars = stripMarkdown(text || '').trim().length;
  const credits = estimateCredits(text);

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-active text-primary rounded-full text-xs font-medium">
      <span>~{credits} credits</span>
      <span className="text-muted-foreground">({chars} chars)</span>
    </div>
  );
}
