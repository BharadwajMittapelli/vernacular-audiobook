import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, LogOut } from 'lucide-react';

export function LogoutConfirmDialog({ isOpen, onClose, onConfirm, loading }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4"
      onClick={() => {
        if (!loading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-dialog-title"
      aria-busy={loading}
      ref={dialogRef}
      tabIndex={-1}
    >
      <div
        className="bg-background rounded-3xl p-8 w-full max-w-lg relative shadow-xl border border-border/40"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
          disabled={loading}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Centered icon in terracotta square */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-terracotta/10 flex items-center justify-center">
            <LogOut className="h-7 w-7 text-terracotta" />
          </div>
        </div>

        {/* Centered heading */}
        <h2 id="logout-dialog-title" className="text-xl font-bold text-center text-foreground mb-2">
          Are you sure you want to logout?
        </h2>

        {/* Centered description */}
        <p className="text-sm text-center text-muted-foreground mb-8">
          You will be signed out of your Swar Studio account.
        </p>

        {/* Two equal-width buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-medium bg-terracotta text-white hover:opacity-90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Logging out...
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4" />
                Logout
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}