import React, { useState, useEffect } from 'react';
import { Coins, BookOpen, Headphones } from 'lucide-react';
import { getSettingsStats } from '../../services/api.js';

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '0 min';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export function CreditsTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSettingsStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || err.message || 'Failed to load credits');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-semibold text-foreground mb-1">Credits</h2>
      <p className="text-sm text-muted-foreground mb-6">View your credit balance and usage.</p>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <Coins className="h-5 w-5 text-terracotta mb-2" />
          <p className="text-2xl font-bold text-foreground">{stats?.credits ?? '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">Credits remaining</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <BookOpen className="h-5 w-5 text-terracotta mb-2" />
          <p className="text-2xl font-bold text-foreground">{stats?.booksCount ?? '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">Books uploaded</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <Headphones className="h-5 w-5 text-terracotta mb-2" />
          <p className="text-2xl font-bold text-foreground">{formatDuration(stats?.totalAudioSeconds ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">Audio generated</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm font-medium text-foreground">Credit history coming soon</p>
        <p className="text-xs text-muted-foreground mt-1">
          A detailed transaction history will be available in a future update.
        </p>
      </div>
    </div>
  );
}
