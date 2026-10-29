import React, { useEffect, useState, useCallback } from 'react';
import { Download, MoreVertical, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { getDownloads, deleteDownload, exportBookMp3 } from '../../services/api.js';

function formatFileSize(bytes) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

function formatExportDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${month} ${day}, ${year} · ${displayHours}:${minutes} ${ampm}`;
}

function formatRelativeExportDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

function getInitials(title) {
  return (title || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function PackageRow({
  item,
  isSelected,
  onSelect,
  onOpen,
  onRemove,
  removingId,
}) {
  const initials = getInitials(item.book_title);
  const fileSize = formatFileSize(item.file_size_bytes);
  const relDate = formatRelativeExportDate(item.exported_at);
  const absDate = formatExportDate(item.exported_at);
  const isRemoving = removingId === item.id;

  return (
    <div
      onClick={() => onSelect(item.id)}
      className={`
        flex items-center gap-4 p-4 rounded-xl border transition-colors cursor-pointer
        ${isSelected
          ? 'border-terracotta/30 bg-terracotta/5'
          : 'border-border bg-card hover:border-border/80 hover:bg-muted/30'
        }
      `}
    >
      {/* Cover thumbnail */}
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
        {item.book_cover_url ? (
          <img
            src={item.book_cover_url}
            alt={item.book_title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-terracotta font-bold text-lg">{initials}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-foreground truncate">{item.book_title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
        {item.exportType === 'chapter' ? 'Chapter Export' : 'Complete Audiobook Package'}
      </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium uppercase">
            {item.file_format || 'MP3'}
          </span>
          {fileSize && (
            <span className="text-xs text-muted-foreground">{fileSize}</span>
          )}
          {item.totalChapters !== null && item.totalChapters !== undefined && (
            <span className="text-xs text-muted-foreground">
              {item.totalChapters} chapter{item.totalChapters !== 1 ? 's' : ''}
            </span>
          )}
          {item.exportType === 'chapter' && item.fileName && (
            <span className="text-xs text-muted-foreground truncate max-w-[160px]" title={item.fileName}>
              {item.fileName}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{absDate}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(item); }}
          disabled={isRemoving}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-foreground text-background hover:opacity-90 transition-colors disabled:opacity-50"
        >
          {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Open'}
        </button>
        <div className="relative">
          <DropdownMenu onRemove={() => onRemove(item.id)} isRemoving={isRemoving} />
        </div>
      </div>
    </div>
  );
}

function DropdownMenu({ onRemove, isRemoving }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        aria-label="More options"
        disabled={isRemoving}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
                setOpen(false);
              }}
              disabled={isRemoving}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove from Downloads
            </button>
          </div>
        </>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Download className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground">No downloads yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        Export a book from My Books or Studio to see it here.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-3" />
      <p className="text-sm text-muted-foreground">Loading downloads…</p>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="h-8 w-8 text-destructive mb-3" />
      <h3 className="text-base font-semibold text-foreground">Failed to load downloads</h3>
      <p className="text-sm text-muted-foreground mt-1">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 text-sm text-terracotta hover:underline"
      >
        Retry
      </button>
    </div>
  );
}

function DetailPanel({ item, onOpen, onRemove, removingId }) {
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Download className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Select a downloaded package</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">
          Choose a package from the list to view details, replay, or open.
        </p>
      </div>
    );
  }

  const initials = getInitials(item.book_title);
  const fileSize = formatFileSize(item.file_size_bytes);
  const absDate = formatExportDate(item.exported_at);

  return (
    <div className="flex flex-col h-full">
      {/* Cover */}
      <div className="w-full aspect-square rounded-xl overflow-hidden bg-muted mb-4 flex items-center justify-center">
        {item.book_cover_url ? (
          <img
            src={item.book_cover_url}
            alt={item.book_title}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-terracotta font-bold text-4xl">{initials}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1">
        <h3 className="font-semibold text-foreground text-base truncate">{item.book_title}</h3>
        <p className="text-xs text-muted-foreground mt-1">
        {item.exportType === 'chapter' ? 'Chapter Export' : 'Complete Audiobook Package'}
      </p>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-1.5 py-0.5 rounded bg-muted font-medium uppercase">
              {item.file_format || 'MP3'}
            </span>
            {fileSize && <span>{fileSize}</span>}
            {item.totalChapters !== null && item.totalChapters !== undefined && (
              <span>{item.totalChapters} chapters</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{absDate}</p>
          <p className="text-xs text-muted-foreground truncate">
            {item.file_name}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 space-y-2">
        <button
          onClick={() => onOpen(item)}
          disabled={removingId === item.id}
          className="w-full py-2.5 rounded-lg text-sm font-medium bg-foreground text-background hover:opacity-90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {removingId === item.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download Again
            </>
          )}
        </button>
        <DropdownMenu
          onRemove={() => onRemove(item.id)}
          isRemoving={removingId === item.id}
        />
      </div>
    </div>
  );
}

export function DownloadsView({ onDownloadAgain }) {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [sortOrder, setSortOrder] = useState('newest');
  const [removingId, setRemovingId] = useState(null);

  const fetchDownloads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDownloads();
      if (res.success) {
        setDownloads(res.downloads || []);
      } else {
        setError(res.error || 'Failed to load downloads');
      }
    } catch (err) {
      setError(err.message || 'Failed to load downloads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDownloads();
  }, [fetchDownloads]);

  const sortedDownloads = [...downloads].sort((a, b) => {
    return sortOrder === 'newest'
      ? new Date(b.exported_at) - new Date(a.exported_at)
      : new Date(a.exported_at) - new Date(b.exported_at);
  });

  const selectedDownload = downloads.find((d) => d.id === selectedId);

  const handleOpen = useCallback(async (item) => {
    try {
      await onDownloadAgain(item.book_id);
    } catch (err) {
      console.error('[DownloadsView] Open failed:', err);
    }
  }, [onDownloadAgain]);

  const handleRemove = useCallback(async (id) => {
    setRemovingId(id);
    try {
      const res = await deleteDownload(id);
      if (res.success) {
        setDownloads((prev) => prev.filter((d) => d.id !== id));
        if (selectedId === id) setSelectedId(null);
      }
    } catch (err) {
      console.error('[DownloadsView] Remove failed:', err);
    } finally {
      setRemovingId(null);
    }
  }, [selectedId]);

  const handleRetry = useCallback(() => {
    fetchDownloads();
  }, [fetchDownloads]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={handleRetry} />;

  return (
    <div className="flex flex-col gap-4">
      {/* Heading */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Downloaded Packages</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Audiobook packages you have exported and downloaded.
          </p>
        </div>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="text-sm border border-border bg-background rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-terracotta/40 text-muted-foreground"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {/* List */}
      {sortedDownloads.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-3">
          {sortedDownloads.map((item) => (
            <PackageRow
              key={item.id}
              item={item}
              isSelected={selectedId === item.id}
              onSelect={setSelectedId}
              onOpen={handleOpen}
              onRemove={handleRemove}
              removingId={removingId}
            />
          ))}
        </div>
      )}

      {/* Detail panel — rendered only when a download is selected */}
      {selectedDownload && (
        <div className="mt-6 border-t border-border pt-6">
          <DetailPanel
            item={selectedDownload}
            onOpen={handleOpen}
            onRemove={handleRemove}
            removingId={removingId}
          />
        </div>
      )}
    </div>
  );
}
