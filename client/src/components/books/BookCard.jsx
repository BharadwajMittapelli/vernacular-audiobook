import React from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';

function getStatusColor(status) {
  switch (status) {
    case 'completed': return 'bg-success/10 text-success';
    case 'processing': return 'bg-primary/10 text-primary';
    case 'failed': return 'bg-destructive/10 text-destructive';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'completed': return 'Done';
    case 'processing': return 'Processing';
    case 'failed': return 'Failed';
    default: return 'Pending';
  }
}

export function BookCard({ book, onOpen, onDelete }) {
  const initials = (book.title || '').slice(0, 2).toUpperCase();

  return (
    <div className="group relative bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-[2/3] bg-muted relative overflow-hidden">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-terracotta/10 text-terracotta font-bold text-2xl">
            {initials}
          </div>
        )}
        <div className="absolute top-2 right-2">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getStatusColor(book.status)}`}>
            {getStatusLabel(book.status)}
          </span>
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <button
            onClick={onOpen}
            className="bg-background text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          >
            Open
          </button>
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-foreground truncate" title={book.title}>
          {book.title}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {book.total_chapters} chapter{book.total_chapters !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={onOpen}
            className="text-xs font-medium text-terracotta hover:underline"
          >
            Open
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Delete book"
              title="Delete book"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
