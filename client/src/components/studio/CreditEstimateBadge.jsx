import React from 'react';

export function CreditEstimateBadge({ text, language }) {
  const cleanText = text.replace(/[#*`_\[\]]/g, '');
  const credits = Math.ceil(cleanText.length / 100);

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
      <span>~{credits} credits</span>
      <span className="text-muted-foreground">({cleanText.length} chars)</span>
    </div>
  );
}