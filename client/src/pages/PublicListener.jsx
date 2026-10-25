import React, { useEffect, useState } from 'react';
import { useNavigate } from '../context/NavigateContext.jsx';
import { getPublicBook } from '../services/api.js';
import { ReadAlongPlayer } from '../components/player/ReadAlongPlayer.jsx';
import { useAudioPlayer } from '../hooks/useAudioPlayer.jsx';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

export default function PublicListener({ bookId }) {
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [audioResult, setAudioResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getPublicBook(bookId);
        if (cancelled) return;
        if (!res?.success || !res.book) {
          setError('Book not found or not published yet');
          setLoading(false);
          return;
        }
        setBook(res.book);
        setChapters(res.chapters || []);
        const first = res.chapters?.[0];
        if (first) setAudioResult({ audioUrl: first.audioUrl, alignment: first.alignment || [] });
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.status === 404
          ? 'Book not found or not published yet'
          : err.response?.data?.error || err.message || 'Failed to load book');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookId]);

  const chapter = chapters[activeIdx];
  const player = useAudioPlayer(audioResult?.audioUrl, audioResult?.alignment || []);

  const selectChapter = (idx) => {
    setActiveIdx(idx);
    setAudioResult({
      audioUrl: chapters[idx]?.audioUrl || null,
      alignment: chapters[idx]?.alignment || [],
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading audiobook…</span>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-destructive mb-4">{error || 'Book not found'}</p>
        <button onClick={() => navigate('/')} className="text-sm text-terracotta hover:underline">
          ← Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/')} className="p-1.5 rounded-md hover:bg-muted" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{book.title}</p>
          <p className="text-xs text-muted-foreground">{chapters.length} chapters</p>
        </div>
      </header>

      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <button
          onClick={() => selectChapter(Math.max(0, activeIdx - 1))}
          disabled={activeIdx === 0}
          className="p-1 rounded hover:bg-muted disabled:opacity-40"
          aria-label="Previous chapter"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-xs text-muted-foreground flex-1 text-center truncate">
          {activeIdx + 1} / {chapters.length} · {chapter?.title}
        </span>
        <button
          onClick={() => selectChapter(Math.min(chapters.length - 1, activeIdx + 1))}
          disabled={activeIdx === chapters.length - 1}
          className="p-1 rounded hover:bg-muted disabled:opacity-40"
          aria-label="Next chapter"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <main className="flex-1 overflow-y-auto p-4">
        <ReadAlongPlayer
          audioUrl={audioResult?.audioUrl}
          alignment={audioResult?.alignment || []}
          chapterText={chapter?.text}
          currentTime={player.currentTime}
          currentSentenceIndex={player.currentSentenceIndex}
          onSeek={(s) => player.seek(s)}
        />
      </main>

      <footer className="shrink-0 border-t border-border px-4 py-3 flex items-center justify-center gap-4">
        <button
          onClick={() => (player.isPlaying ? player.pause() : player.play())}
          className="bg-terracotta text-background w-12 h-12 rounded-full flex items-center justify-center hover:opacity-90"
          aria-label={player.isPlaying ? 'Pause' : 'Play'}
        >
          {player.isPlaying ? '⏸' : '▶'}
        </button>
      </footer>
    </div>
  );
}
