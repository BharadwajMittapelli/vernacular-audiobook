import { useState, useEffect } from 'react';

/**
 * RateLimitBanner - Displays rate limit warnings with countdown
 */
export function RateLimitBanner({ isVisible, retryAfterMs, onClose }) {
  const [remainingMs, setRemainingMs] = useState(retryAfterMs || 60000);

  useEffect(() => {
    if (!isVisible || remainingMs <= 0) return;

    const interval = setInterval(() => {
      setRemainingMs((prev) => Math.max(0, prev - 100));
    }, 100);

    return () => clearInterval(interval);
  }, [isVisible, remainingMs]);

  if (!isVisible) return null;

  const seconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const displayTime = minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm animate-in fade-in slide-in-from-top-2">
      <div className="bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-amber-900">Processing queued</h3>
            <p className="text-sm text-amber-700 mt-1">
              Audio synthesis is rate-limited. Your request is queued and will process automatically.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-amber-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.max(0, ((60000 - remainingMs) / 60000) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-amber-600 font-mono">{displayTime}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-amber-400 hover:text-amber-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to track rate limit state across the app
 */
export function useRateLimit() {
  const [rateLimitState, setRateLimitState] = useState({
    isLimited: false,
    retryAfterMs: 0,
    queuedRequests: 0,
  });

  const triggerRateLimit = (retryAfterMs = 60000) => {
    setRateLimitState({
      isLimited: true,
      retryAfterMs,
      queuedRequests: 0,
    });
  };

  const clearRateLimit = () => {
    setRateLimitState({
      isLimited: false,
      retryAfterMs: 0,
      queuedRequests: 0,
    });
  };

  return { rateLimitState, triggerRateLimit, clearRateLimit };
}
