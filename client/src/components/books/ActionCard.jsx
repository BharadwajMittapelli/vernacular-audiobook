import React from 'react';
import { ChevronRight } from 'lucide-react';

export function ActionCard({ icon, title, description, onClick, onShare, disabled = false }) {
  return (
    <button
      onClick={onClick ?? onShare}
      disabled={disabled}
      className={`
        w-full text-left rounded-xl border border-border bg-card p-5
        transition-all duration-150 hover:shadow-md hover:border-terracotta/30
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
        flex items-start gap-4 group
      `}
    >
      <div className="w-12 h-12 rounded-lg bg-terracotta/10 flex items-center justify-center text-terracotta shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-terracotta transition-colors shrink-0 mt-1" />
    </button>
  );
}
