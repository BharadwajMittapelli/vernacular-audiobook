import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { VoiceSelector } from '../components/studio/VoiceSelector.jsx';
import { Slider } from '../components/ui/slider.jsx';
import { ReadAlongPlayer } from '../components/player/ReadAlongPlayer.jsx';

import { AudioConfigModal } from '../components/studio/AudioConfigModal.jsx';
import { BottomPlayer } from '../components/layout/BottomPlayer.jsx';
import { StudioLayout } from '../components/layout/StudioLayout.jsx';
import { CreditEstimateBadge } from '../components/studio/CreditEstimateBadge.jsx';
import { synthesizeAudio, synthesizeAsync, getChapterAudio, getChapterDetails, getBookDetails, getBookStatus, spatialPreview, logExport, logPlayback } from '../services/api.js';
import { useNavigate } from '../context/NavigateContext.jsx';
import { TranscriptEditor } from '../components/studio/TranscriptEditor.jsx';
import { useAudioPlayer } from '../hooks/useAudioPlayer.jsx';
import { useAudio } from '../context/AudioContext.jsx';
import { Button } from '../components/ui/button.jsx';
import { Zap, FileText, BookOpen, Info, Download, ChevronDown } from 'lucide-react';

const LABELS = {
  'en-IN': 'English',
  'hi-IN': 'Hindi',
  'te-IN': 'Telugu',
  'ta-IN': 'Tamil',
  'kn-IN': 'Kannada',
  'ml-IN': 'Malayalam',
  'mr-IN': 'Marathi',
  'bn-IN': 'Bengali',
  'gu-IN': 'Gujarati',
  'pa-IN': 'Punjabi',
};

function estimateWordCount(text) {
  if (!text) return 0;
  return text.replace(/[#*`_\[\]]/g, '').trim().split(/\s+/).filter(Boolean).length;
}

function estimateCharCount(text) {
  if (!text) return 0;
  return text.replace(/[#*`_\[\]]/g, '').trim().length;
}

function estimateReadingMinutes(text) {
  if (!text) return 0;
  return Math.ceil(estimateWordCount(text) / 160);
}

function estimateCredits(text) {
  return Math.ceil((text || '').replace(/[#*`_\[\]]/g, '').trim().length / 100);
}

function cleanOcrText(text) {
  if (!text) return '';
  return text
    .replace(/[#*`_\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ErrorBanner({ children }) {
  return (
    <div className="mb-4 rounded-lg p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm">
      {children}
    </div>
  );
}

function EmptyState({ label, sublabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <p className="text-center text-sm">{label}</p>
      {sublabel && <p className="text-center text-xs mt-1 text-muted-foreground/60">{sublabel}</p>}
    </div>
  );
}

function ChapterInfoView({ chapter, estimatedCredits, readingMinutes, wordCount, charCount, hasAudio, audioDuration }) {
  const formatDuration = (s) => {
    if (!s || !isFinite(s)) return '—';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}m ${sec.toString().padStart(2, '0')}s`;
  };

  if (!chapter) return <EmptyState label="No chapter selected" />;

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-serif font-semibold text-foreground mb-6">
        {chapter.title}
      </h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Chapter ID</p>
            <p className="text-sm text-foreground font-mono">{chapter.chapterId}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Word Count</p>
            <p className="text-sm text-foreground font-medium">{wordCount}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Character Count</p>
            <p className="text-sm text-foreground font-medium">{charCount}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Est. Reading Time</p>
            <p className="text-sm text-foreground font-medium">{readingMinutes} min</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Estimated Credits</p>
            <p className="text-sm text-terracotta font-bold">{estimatedCredits}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Audio Status</p>
            <p className="text-sm text-foreground">
              {hasAudio ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                  Generated ({formatDuration(audioDuration)})
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-muted shrink-0" />
                  Not generated
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Chapter Text</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto scrollbar-thin">
            {chapter.text}
          </p>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const activePath = window.location.pathname;
  const [book, setBook] = React.useState(null);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const [selectedLanguage, setSelectedLanguage] = React.useState('hi-IN');
  const [selectedVoice, setSelectedVoice] = React.useState(null);
  const [speed, setSpeed] = React.useState(1);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isBulk, setIsBulk] = React.useState(false);
  const [bulkStatus, setBulkStatus] = React.useState(null);
  const [audioResult, setAudioResult] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState('transcript');
  const [isExporting, setIsExporting] = React.useState(false);
  const initializedFromUrlRef = React.useRef(false);
  const [isLoadingBook, setIsLoadingBook] = React.useState(false);
  const currentBookIdRef = React.useRef(null);
  const [bookStatus, setBookStatus] = React.useState(null);
  const pollIntervalRef = React.useRef(null);
  const [isSpatialEnabled, setIsSpatialEnabled] = React.useState(false);
  const hasLoggedPlaybackRef = React.useRef(false);

  // Initialize from ?bookId query parameter on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get('bookId');
    console.log('[Dashboard] Mount with bookId:', bookId, 'path:', window.location.pathname + window.location.search);
    if (!bookId) {
      navigate('/my-books');
      return;
    }

    let cancelled = false;
    setIsLoadingBook(true);
    currentBookIdRef.current = bookId;

    // ponytail: retry on 404 to handle Supabase replication lag after book creation
    const fetchBookWithRetry = async (id, retries = 3, delayMs = 200) => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await getBookDetails(id);
          if (res?.success) return res;
        } catch (err) {
          if (err.response?.status !== 404) throw err;
          if (i < retries - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
          else throw err;
        }
      }
    };

    (async () => {
      try {
        const res = await fetchBookWithRetry(bookId);
        if (cancelled) return;
        setIsLoadingBook(false);
        if (!res || !res.success) return;
        if (!res.chapters || res.chapters.length === 0) {
          setError('No chapters found for this book');
          return;
        }
        // Fetch full chapter data (including text) via getChapterDetails for each chapter
        const chaptersWithText = await Promise.all(
          res.chapters.map(async (ch) => {
            const chapterRes = await getChapterDetails(ch.id);
            if (!chapterRes || !chapterRes.success || !chapterRes.chapter) {
              throw new Error(`Failed to load chapter: ${ch.id}`);
            }
            return {
              chapterId: ch.id,
              title: ch.title,
              text: chapterRes.chapter.text_content,
            };
          })
        );
        if (cancelled) return;
        setIsLoadingBook(false);
        const frontendBook = {
          id: res.book.id,
          title: res.book.title,
          chapters: chaptersWithText,
          coverUrl: res.book.cover_url,
        };
        setBook(frontendBook);
        setActiveIdx(0);
        setAudioResult(null);
        setBulkStatus(null);
        setError(null);
        initializedFromUrlRef.current = true;
        sessionStorage.setItem('lastBookId', bookId);
        // Load audio for first chapter
        if (chaptersWithText[0]) loadChapterAudio(chaptersWithText[0]);
      } catch (err) {
        if (cancelled) return;
        setIsLoadingBook(false);
        const status = err.response?.status;
        console.error('[Dashboard] Error loading book:', {
          bookId,
          status,
          responseData: err.response?.data,
          message: err.message,
          url: err.config?.url,
        });
        if (status === 401) {
          setError('Authentication required. Please sign in again.');
        } else if (status === 404) {
          setError('Book not found or you do not have access to it.');
          if (currentBookIdRef.current === bookId) {
            sessionStorage.removeItem('lastBookId');
          }
        } else {
          setError(err.response?.data?.error || err.message || 'Failed to load book');
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Poll for synthesis progress
  React.useEffect(() => {
    if (!book || book.status !== 'processing') return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await getBookStatus(book.id);
        if (!res?.success) return;

        setBookStatus(res);

        setBook((b) => ({
          ...b,
          status: res.book.status,
          completed_chapters: res.book.completed_chapters,
          chapters: b.chapters.map((ch) => {
            const updated = res.chapters?.find((c) => c.id === ch.chapterId || c.id === ch.id);
            return updated ? { ...ch, status: updated.status } : ch;
          }),
        }));
      } catch {
        // Transient network error — silently ignore
      }
    }, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [book?.id, book?.status]);

  const chapter = book ? book.chapters[activeIdx] : null;
  const alignment = audioResult?.alignment || [];
  const audioUrl = audioResult?.audioUrl || null;
  const { isPlaying: sharedIsPlaying, currentTime: sharedCurrentTime, duration: sharedDuration, playbackRate: sharedPlaybackRate } = useAudio();

  React.useEffect(() => {
    hasLoggedPlaybackRef.current = false;
  }, [chapter?.chapterId, book?.id]);

  const player = useAudioPlayer(audioUrl, alignment, {
    chapterId: chapter?.chapterId,
    bookId: book?.id || currentBookIdRef.current,
    onPlaybackVerified: (chapterId, bookId) => {
      // Only log playback once per chapter session — coordinate with AudioLibrary path
      if (!hasLoggedPlaybackRef.current && bookId && chapterId) {
        hasLoggedPlaybackRef.current = true;
        let attempts = 0;
        const maxAttempts = 3;
        const attemptLog = () => {
          logPlayback({ bookId, chapterId })
            .catch((err) => {
              attempts++;
              if (attempts < maxAttempts) {
                setTimeout(attemptLog, 500 * Math.pow(2, attempts - 1));
              } else {
                console.error('Failed to log playback after retries:', err);
              }
            });
        };
        attemptLog();
      }
    },
  });

  React.useEffect(() => {
    setSpeed(player.playbackRate);
  }, [player.playbackRate]);

  const estimatedCredits = chapter ? estimateCredits(chapter.text) : 0;
  const totalCredits = book
    ? book.chapters.reduce((sum, ch) => sum + estimateCredits(ch.text), 0)
    : 0;

  const loadChapterAudio = React.useCallback(async (ch) => {
    setAudioResult(null);
    try {
      const res = await getChapterDetails(ch.chapterId);
      if (res.success && res.audio) {
        setAudioResult({ audioUrl: res.audio.audioUrl, alignment: res.audio.alignment || [] });
      }
    } catch (err) {
      const status = err.response?.status;
      if (status !== 404) {
        const msg = err.response?.data?.error || err.message || `Failed to load chapter audio (${status})`;
        setError(msg);
      }
    }
  }, []);

  const selectChapter = (idx) => {
    setActiveIdx(idx);
    setAudioResult(null);
    setError(null);
    loadChapterAudio(book.chapters[idx]);
  };

  // PUT response returns { title, char_count, ... } — merge into local state,
  // keeping both id keys (uploads create chapters with `id`, GET returns `chapterId`).
  const handleChapterSaved = (c) => {
    setBook((b) => ({
      ...b,
      chapters: b.chapters.map((ch, i) =>
        i === activeIdx
          ? {
              ...ch,
              ...c,
              id: ch.id ?? c.id,
              chapterId: ch.chapterId ?? c.id,
              text: c.text_content,
            }
          : ch
      ),
    }));
  };

  const handleGenerate = async (config) => {
    if (config?.language) setSelectedLanguage(config.language);
    if (config?.voiceProfile) setSelectedVoice(config.voiceProfile);
    if (config?.speed !== undefined) setSpeed(config.speed);

    if (config?.submit && chapter) {
      setIsGenerating(true);
      setError(null);

      try {
        const language = config?.language ?? selectedLanguage;
        const voiceProfile = config?.voiceProfile ?? selectedVoice;
        const selectedSpeed = config?.speed ?? speed;

        const result = await synthesizeAudio({
          chapterId: chapter.chapterId,
          text: cleanOcrText(chapter.text),
          language,
          voiceProfile,
          speed: selectedSpeed,
        });
        setAudioResult(result);
        setIsConfigOpen(false);
      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'Failed to generate audio';
        setError(msg);
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const handleSpatialGenerate = async () => {
    if (!chapter || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const blob = await spatialPreview({
        chapterText: cleanOcrText(chapter.text),
        bookId: book?.id,
      });
      const url = URL.createObjectURL(blob);
      setAudioResult({ audioUrl: url, alignment: [] });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to generate spatial audio';
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAll = async () => {
    setIsBulk(true);
    setError(null);
    // Optimistically mark processing so the poll loop kicks in immediately
    setBook((b) => ({ ...b, status: 'processing' }));
    try {
      const res = await synthesizeAsync({
        chapters: book.chapters.map((ch) => ({
          chapterId: ch.chapterId,
          text: cleanOcrText(ch.text),
          language: selectedLanguage,
          voiceProfile: selectedVoice,
          speed,
        })),
      });
      setBulkStatus(`Queued ${res.queued}, cached ${res.cached} of ${res.totalChapters} chapters`);
    } catch (err) {
      const d = err.response?.data;
      setError(
        d?.required
          ? `${d.error} (need ${d.required}, have ${d.available})`
          : d?.error || 'Bulk synthesis failed'
      );
    } finally {
      setIsBulk(false);
    }
  };

  const downloadBlob = (blob, name, revokeMs = 1000) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), revokeMs);
  };

  const handleExport = async () => {
    if (!chapter || !audioUrl || isExporting) return;
    setIsExporting(true);
    setError(null);
    const safe = (chapter.title || '').replace(/[\\/:*?"<>|]/g, '').trim() || 'Chapter';
    try {
      downloadBlob(
        new Blob([cleanOcrText(chapter.text)], { type: 'text/plain;charset=utf-8' }),
        `${safe}.txt`
      );
      // Signed URLs expire after 1h — refresh before fetching; fall back to the held URL.
      let url = audioUrl;
      try {
        url = (await getChapterAudio(chapter.chapterId)).audioUrl || audioUrl;
      } catch {
        /* use held audioUrl */
      }
      if (!url) throw new Error('No audio URL available');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Audio fetch failed with status: ${res.status}`);
      const blob = await res.blob();
      // Don't save error JSON/HTML served with 200 as an "audio" file
      if (blob.type && !blob.type.startsWith('audio/')) {
        throw new Error(`Unexpected audio content-type: ${blob.type}`);
      }
      // Strict extension: uploads always set audio/mpeg|audio/wav (storageService.js); default .wav
      const ext = blob.type === 'audio/mpeg' || blob.type === 'audio/mp3' ? 'mp3' : 'wav';
      // ponytail: 2000ms revoke delay so large binaries aren't cancelled mid-transfer
      downloadBlob(blob, `${safe}.${ext}`, 2000);
      // Log export to history (non-blocking, fire-and-forget)
      logExport({
        bookId: currentBookIdRef.current,
        bookTitle: book?.title || 'Untitled Book',
        bookCoverUrl: book?.coverUrl,
        fileName: `${safe}.${ext}`,
        fileFormat: ext,
        fileSize: blob.size,
        exportType: 'chapter',
        bookChapterId: chapter?.chapterId,
      }).catch((err) => console.error('[Dashboard] Failed to log export:', err));
    } catch (err) {
      console.error('Export failed:', err);
      setError('Audio download failed — the link may have expired or CORS blocked it. Try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const onPlay = () => player.play();
  const onPause = () => player.pause();
  const onRewind = () => {
    if (player.currentSentenceIndex > 0) {
      player.seekToSentence(player.currentSentenceIndex - 1);
    } else {
      player.seek(Math.max(0, player.currentTime - 15));
    }
  };
  const onForward = () => {
    if (player.currentSentenceIndex >= 0 && player.currentSentenceIndex < alignment.length - 1) {
      player.seekToSentence(player.currentSentenceIndex + 1);
    } else {
      player.seek(Math.min(player.duration, player.currentTime + 15));
    }
  };
  const onRewind10 = () => {
    if (!sharedDuration) return;
    seek(Math.max(0, sharedCurrentTime - 10));
  };
  const onForward10 = () => {
    if (!sharedDuration) return;
    seek(Math.min(sharedDuration, sharedCurrentTime + 10));
  };

  const configModal = (
    <AudioConfigModal
      isOpen={isConfigOpen}
      onClose={() => setIsConfigOpen(false)}
      onGenerate={handleGenerate}
      selectedLanguage={selectedLanguage}
      selectedVoice={selectedVoice}
      speed={speed}
      estimatedCredits={estimatedCredits}
      isGenerating={isGenerating}
    />
  );

  const studioContent = (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 overflow-hidden flex">
        {/* Workspace column — header, tabs, and reading content */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Book header */}
          <div className="shrink-0 border-b border-border">
            <div className="px-4 py-1.5 flex items-center gap-3">
              <div className="w-8 h-11 shrink-0 rounded-md bg-terracotta/20 flex items-center justify-center text-terracotta text-xs font-bold overflow-hidden">
                {book?.coverUrl ? (
                  <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  book?.title?.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium truncate">{book?.title}</p>
                <h1 className="text-base font-serif font-semibold text-foreground leading-tight truncate">
                  {chapter?.title}
                </h1>
                <span className="text-[11px] text-muted-foreground">
                  Ch. {activeIdx + 1} / {book?.chapters?.length ?? 0}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => selectChapter(Math.max(0, activeIdx - 1))}
                  disabled={activeIdx === 0}
                  className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous chapter"
                >
                  &larr;
                </button>
                <button
                  onClick={() => selectChapter(Math.min((book?.chapters?.length ?? 1) - 1, activeIdx + 1))}
                  disabled={activeIdx === 0 || activeIdx === (book?.chapters?.length ?? 1) - 1}
                  className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next chapter"
                >
                  &rarr;
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="shrink-0 border-b border-border">
            <div className="px-4 pt-1 flex items-center gap-6">
              {[
                { key: 'transcript', label: 'Transcript', icon: FileText },
                { key: 'read-along', label: 'Read Along', icon: BookOpen },
                { key: 'chapter-info', label: 'Chapter Info', icon: Info },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`pb-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === key
                      ? 'border-terracotta text-terracotta'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Reading content */}
          <div className="flex-1 overflow-y-auto px-8 py-3 scrollbar-thin">
            {error && <ErrorBanner>{error}</ErrorBanner>}
            {book?.status === 'processing' && (
              <div className="mb-4 rounded-lg p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm">
                Processing Audio:{' '}
                {bookStatus?.book?.completed_chapters ?? book?.completed_chapters ?? 0} of{' '}
                {bookStatus?.book?.total_chapters ?? book?.total_chapters ?? book?.chapters?.length ?? 0} chapters done
              </div>
            )}
            {bulkStatus && (
              <div className="mb-4 rounded-lg p-3 bg-terracotta/10 border border-terracotta/20 text-terracotta text-sm">
                {bulkStatus}
              </div>
            )}

            {activeTab === 'transcript' && (
              <div>
                <TranscriptEditor chapter={chapter} onSaved={handleChapterSaved} onError={setError} />
              </div>
            )}

            {activeTab === 'read-along' && (
              <div>
                <ReadAlongPlayer
                  audioUrl={audioUrl}
                  alignment={alignment}
                  chapterText={chapter?.text}
                  currentTime={player.currentTime}
                  currentSentenceIndex={player.currentSentenceIndex}
                  onSeek={(s) => player.seek(s)}
                />
              </div>
            )}

            {activeTab === 'chapter-info' && (
              <div>
                <ChapterInfoView
                  chapter={chapter}
                  estimatedCredits={estimatedCredits}
                  readingMinutes={estimateReadingMinutes(chapter?.text)}
                  wordCount={estimateWordCount(chapter?.text)}
                  charCount={estimateCharCount(chapter?.text)}
                  hasAudio={!!audioResult}
                  audioDuration={player.duration}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Audio Settings Panel */}
        <div className="min-w-[260px] max-w-[360px] w-[30%] shrink-0 border-l border-border bg-card flex flex-col min-h-0">
          {/* Scrollable settings content */}
          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 scrollbar-thin">
            {/* Title */}
            <div>
              <h3 className="text-sm font-semibold text-foreground">Audio settings</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose language, voice and speed to generate audio.
              </p>
            </div>

            {/* Language dropdown */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Language
              </p>
              <div className="relative">
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full appearance-none bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground pr-8 focus:outline-none focus:ring-2 focus:ring-terracotta/40 cursor-pointer"
                >
                  {Object.entries(LABELS).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Voice cards */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Voice
              </p>
              <div className="w-full space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin">
                <VoiceSelector
                  language={selectedLanguage}
                  selectedVoice={selectedVoice}
                  onSelect={({ voiceProfile, languageCode }) => {
                    setSelectedVoice(voiceProfile);
                    if (languageCode) setSelectedLanguage(languageCode);
                  }}
                  onLanguageChange={(lang) => setSelectedLanguage(lang)}
                />
              </div>
            </div>

            {/* Playback speed slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Playback speed
                </p>
                <span className="text-xs text-terracotta font-medium">{speed.toFixed(1)}x ›</span>
              </div>
              <Slider
                min={0.5}
                max={2}
                step={0.1}
                value={[speed]}
                onValueChange={([v]) => setSpeed(v)}
                className="terracotta-slider"
              />
            </div>

            {/* Spatial 3D Engine Toggle */}
            <div className="flex items-center gap-3 p-3 bg-muted/40 border border-border rounded-xl my-1">
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground flex items-center gap-2">
                  Spatial 3D Engine
                  <span className="text-[10px] bg-terracotta/10 text-terracotta px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                    AI Director
                  </span>
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  Multi-track spatial audio staging via FFmpeg
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isSpatialEnabled}
                  onChange={(e) => setIsSpatialEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-terracotta"></div>
              </label>
            </div>

            {/* Estimated credits card */}
            <div className="rounded-lg p-3 flex items-center justify-between border border-border bg-muted/50">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Estimated credits
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Based on {estimateReadingMinutes(chapter?.text)} min of audio
                </p>
              </div>
              <span className="text-lg font-bold text-terracotta">{estimatedCredits}</span>
            </div>
          </div>

          {/* Fixed action buttons — always visible at bottom */}
          <div className="shrink-0 px-3 pb-3 flex flex-col gap-2">
            {/* Generate Audio */}
            <button
              onClick={() => isSpatialEnabled ? handleSpatialGenerate() : handleGenerate({ language: selectedLanguage, voiceProfile: selectedVoice, speed, submit: true })}
              disabled={isGenerating || (!isSpatialEnabled && (!selectedVoice || !chapter))}
              className="w-full bg-foreground text-background rounded-lg py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-opacity flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  {isSpatialEnabled ? 'Generate Spatial' : 'Generate Audio'}
                </>
              )}
            </button>

            {/* Export Package */}
            <button
              onClick={handleExport}
              disabled={!audioUrl || isExporting}
              title="Downloads transcript and audio for this chapter"
              className="w-full border border-border rounded-lg py-3 text-sm font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center justify-center gap-2"
            >
              {isExporting ? (
                <>
                  <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  Preparing…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export Package
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoadingBook) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading book…</span>
        </div>
      </div>
    );
  }

  if (!book && error) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border bg-sidebar/50 h-14 flex items-center px-4">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold tracking-tight text-foreground">Ekithab AI</span>
            <span className="text-xs text-muted-foreground font-medium">Audiobook</span>
          </div>
          <div className="ml-auto">
            <Button onClick={async () => { await signOut(); window.location.href = '/'; }} variant="outline">Logout</Button>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-xl text-center">
            <ErrorBanner>{error}</ErrorBanner>
            <div className="flex gap-3 justify-center mt-4">
              <Button onClick={() => window.location.reload()} variant="outline">
                Retry
              </Button>
              <Button onClick={() => navigate('/my-books')} variant="default">
                Return to My Books
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <StudioLayout
        book={book}
        activeChapterIdx={activeIdx}
        chapter={chapter}
        onChapterSelect={selectChapter}
        onNavClick={navigate}
        activePath={activePath}
        bottomBar={
          <BottomPlayer
            audioUrl={audioUrl}
            isPlaying={sharedIsPlaying}
            currentTime={sharedCurrentTime}
            duration={sharedDuration}
            playbackRate={sharedPlaybackRate}
            currentChapterTitle={chapter?.title}
            bookTitle={book?.title}
            bookCoverUrl={book?.coverUrl}
            onPlay={onPlay}
            onPause={onPause}
            onRewind10={onRewind10}
            onForward10={onForward10}
            onSeek={(seconds) => seek(seconds)}
            onRateChange={(rate) => { setSpeed(rate); setPlaybackRate(rate); }}
          />
        }
      >
        {studioContent}
      </StudioLayout>
      {configModal}
    </>
  );
}

export default Dashboard;