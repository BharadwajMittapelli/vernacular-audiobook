import React from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';

export function ContinueListening({ onViewAll }) {
  return (
    <div className="mt-8 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl font-semibold text-foreground">Continue Listening</h2>
        <button
          onClick={onViewAll}
          className="text-sm text-terracotta font-medium hover:underline flex items-center gap-1"
        >
          <span>View all</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="border border-dashed border-border rounded-xl p-8 text-center bg-card/50">
        <div className="w-12 h-12 rounded-full bg-terracotta/10 flex items-center justify-center mx-auto mb-3">
          <BookOpen className="h-6 w-6 text-terracotta" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">No listening history yet</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
          Pick up where you left off after playing an audiobook in Creator Studio or My Books.
        </p>
        <button
          onClick={onViewAll}
          className="inline-flex items-center gap-2 bg-terracotta text-terracotta-foreground text-xs font-medium px-4 py-2 rounded-lg hover:bg-terracotta/90 transition-colors"
        >
          <span>Browse My Books</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
