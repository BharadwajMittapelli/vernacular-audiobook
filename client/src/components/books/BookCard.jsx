import React from 'react';
import { MoreHorizontal, Trash2, Download, Loader2 } from 'lucide-react';
import { exportBookMp3 } from '../../services/api.js';

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

export function BookCard({ book, onOpen, onDelete, onShare, deleting }) {
  const [downloading, setDownloading] = React.useState(false);
  const initials = (book.title || '').slice(0, 2).toUpperCase();

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await exportBookMp3(book.id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const contentDisp = res.headers['content-disposition'] || '';
      const match = contentDisp.match(/filename\*?=['"]?(?:UTF-8'')?([^"';\s]+)['"]?/);
      const filename = match ? decodeURIComponent(match[1]) : `${book.title || 'audiobook'}.mp3`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error('[BookCard] Export failed:', err);
    } finally {
      setDownloading(false);
    }
  };

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
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2 px-4">
          <button
            onClick={onOpen}
            className="bg-background text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          >
            Open
          </button>
          {onShare && (
            <button
              onClick={(e) => { e.stopPropagation(); onShare(); }}
              className="bg-terracotta text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
            >
              Share
            </button>
          )}
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
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onDelete && (
              <button
                onClick={onDelete}
                disabled={deleting === book.id}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Delete book"
                title="Delete book"
              >
                {deleting === book.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            {book.status === 'completed' && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                aria-label="Download MP3"
                title="Download MP3"
              >
                {downloading ? (
                  <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin block" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
