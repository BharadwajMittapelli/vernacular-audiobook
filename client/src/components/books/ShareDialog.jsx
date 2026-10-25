import React from 'react';
import { X, Link } from 'lucide-react';

export function ShareDialog({ isOpen, onClose, bookTitle, bookId }) {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !bookId) return null;

  const shareUrl = `${window.location.origin}/listen/${bookId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.getElementById('share-url-input');
      el?.select();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-xl p-6 max-w-md w-full mx-4 relative shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Link className="h-5 w-5 text-terracotta" />
          <h2 className="text-lg font-semibold text-foreground">Share "{bookTitle}"</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Anyone with this link can listen to your audiobook on their device.
        </p>

        <div className="flex gap-2">
          <input
            id="share-url-input"
            readOnly
            value={shareUrl}
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-muted text-sm text-muted-foreground"
          />
          <button
            onClick={handleCopy}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              copied
                ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                : 'bg-terracotta text-background hover:opacity-90'
            }`}
          >
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
