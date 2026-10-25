import React, { useState, useEffect } from 'react';
import { Coins, BookOpen, Headphones, Calendar } from 'lucide-react';
import { getSettingsStats } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '0 min';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function formatMemberSince(isoStr) {
  if (!isoStr) return '—';
  const date = new Date(isoStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function AccountOverviewCard() {
  const { session } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSettingsStats()
      .then((data) => { if (!cancelled) setStats(data); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.error || err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const memberSince = formatMemberSince(session?.user?.created_at);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/2 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-foreground mb-1">Account overview</h3>
      <p className="text-xs text-muted-foreground mb-4">Your current plan and usage.</p>

      <div className="rounded-lg p-3 bg-terracotta/5 border border-terracotta/10 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 13V9a2 2 0 002-2m9 0h2" />
          </svg>
          <span className="text-sm font-semibold text-foreground">Free Plan</span>
        </div>
        <p className="text-xs text-muted-foreground">Get started with Ekithab AI</p>
        <button className="mt-3 w-full py-2 rounded-lg bg-terracotta text-background text-sm font-semibold hover:opacity-90 transition-opacity">
          Upgrade Plan
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Coins className="h-3.5 w-3.5" />
            Credits remaining
          </span>
          <span className="font-medium text-foreground">{stats?.credits ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            Books uploaded
          </span>
          <span className="font-medium text-foreground">{stats?.booksCount ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Headphones className="h-3.5 w-3.5" />
            Audio generated
          </span>
          <span className="font-medium text-foreground">{formatDuration(stats?.totalAudioSeconds ?? 0)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Member since
          </span>
          <span className="font-medium text-foreground">{memberSince}</span>
        </div>
      </div>
    </div>
  );
}
