import React from 'react';

// ponytail: mirrors server stripMarkdown (textProcessor.js) for credit parity — the
// single util + parity self-check (client/test/creditParity.selfcheck.mjs) arrives
// with the Phase 1b studio refactor.
const stripMarkdown = (text) => text.replace(/[#*`_\[\]]/g, '');
const estimateCredits = (text) => Math.ceil(stripMarkdown(text).trim().length / 100);

export function CreditEstimateBadge({ text }) {
  const chars = stripMarkdown(text || '').trim().length;
  const credits = estimateCredits(text || '');

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
      <span>~{credits} credits</span>
      <span className="text-muted-foreground">({chars} chars)</span>
    </div>
  );
}
