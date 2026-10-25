import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

export function DangerZoneCard() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">Danger zone</h3>
        <p className="text-xs text-muted-foreground mb-4">These actions are permanent.</p>

        <button
          onClick={() => setShowModal(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-destructive text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Delete account
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-base font-semibold text-foreground mb-2">Delete account</h3>
            <p className="text-sm text-muted-foreground mb-5">
              This will permanently delete your account and all your data, including uploaded books and generated audio.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                disabled
                className="flex-1 px-3 py-2 rounded-lg border border-destructive text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors opacity-50 cursor-not-allowed"
                title="Account deletion is not yet available"
              >
                Delete account
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Account deletion is not yet available. Contact support for assistance.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
