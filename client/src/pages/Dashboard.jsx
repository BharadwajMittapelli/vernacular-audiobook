import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { VoiceSelector } from '../components/studio/VoiceSelector.jsx';
import { Slider } from '../components/ui/slider.jsx';
import { ReadAlongPlayer } from '../components/player/ReadAlongPlayer.jsx';
import { BookUploader } from '../components/studio/BookUploader.jsx';
import { AudioConfigModal } from '../components/studio/AudioConfigModal.jsx';
import { BottomPlayer } from '../components/layout/BottomPlayer.jsx';
import { MainLayout } from '../components/layout/MainLayout.jsx';
import { CreditEstimateBadge } from '../components/studio/CreditEstimateBadge.jsx';
import { synthesizeAudio, synthesizeAsync, getChapterAudio } from '../services/api.js';
import { cleanOcrText } from '../services/textNormalizer.js';
import { TranscriptEditor } from '../components/studio/TranscriptEditor.jsx';
import { useAudioPlayer } from '../hooks/useAudioPlayer.jsx';
import { Button } from '../components/ui/button.jsx';
import { Zap, FileText, BookOpen, Info, Download } from 'lucide-react';

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

  const chapter = book ? book.chapters[activeIdx] : null;
  const alignment = audioResult?.alignment || [];
  const audioUrl = audioResult?.audioUrl || null;
  const player = useAudioPlayer(audioUrl, alignment);

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
      const res = await getChapterAudio(ch.chapterId);
      if (res.success) setAudioResult(res);
    } catch (err) {
      const status = err.response?.status;
      if (status !== 404) {
        const msg = err.response?.data?.error || err.message || `Failed to load chapter audio (${status})`;
        setError(msg);
      }
    }
  }, []);

  const handleDocumentLoaded = ({ title, chapters }) => {
    setBook({ title, chapters });
    setActiveIdx(0);
    setAudioResult(null);
    setBulkStatus(null);
    setError(null);
    loadChapterAudio(chapters[0]);
  };

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

  const resetBook = () => {
    setBook(null);
    setActiveIdx(0);
    setAudioResult(null);
    setBulkStatus(null);
    setError(null);
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

  const generateAll = async () => {
    setIsBulk(true);
    setError(null);
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
      {/* Book header */}
      <div className="shrink-0 px-8 py-2 flex items-center gap-4 border-b border-border">
        <div className="w-12 h-16 shrink-0 rounded-md bg-terracotta/20 flex items-center justify-center text-terracotta text-sm font-bold">
          {book?.title?.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5 font-medium">{book?.title}</p>
          <h1 className="text-3xl font-serif font-semibold text-foreground leading-tight">
            {chapter?.title}
          </h1>
          <span className="text-xs text-muted-foreground mt-0.5 shrink-0">
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

      <div className="shrink-0 px-8 pt-1 flex items-center gap-6">
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

      {/* Main content + right panel */}
      <div className="flex-1 overflow-hidden flex">
        {/* Central workspace — scrolls independently */}
        <div className="flex-1 overflow-y-auto px-8 py-3 scrollbar-thin">
          {error && <ErrorBanner>{error}</ErrorBanner>}
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
            <ChapterInfoView
              chapter={chapter}
              estimatedCredits={estimatedCredits}
              readingMinutes={estimateReadingMinutes(chapter?.text)}
              wordCount={estimateWordCount(chapter?.text)}
              charCount={estimateCharCount(chapter?.text)}
              hasAudio={!!audioResult}
              audioDuration={player.duration}
            />
          )}
        </div>

        {/* Right Audio Settings Panel */}
        <div className="w-[320px] shrink-0 border-l border-border bg-card flex flex-col overflow-y-auto scrollbar-thin px-4 py-4 gap-4">
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
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full appearance-none bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground pr-8 focus:outline-none focus:ring-2 focus:ring-terracotta/40 cursor-pointer"
            >
              {Object.entries(LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>

          {/* Voice cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Voice
              </p>
              <button className="text-xs text-terracotta font-medium hover:underline">
                View all &rarr;
              </button>
            </div>
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

          {/* Playback speed slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Playback speed
              </p>
              <span className="text-xs text-terracotta font-medium">{speed.toFixed(1)}x &rsaquo;</span>
            </div>
            <Slider
              min={0.5}
              max={2}
              step={0.1}
              value={[speed]}
              onValueChange={([v]) => { setSpeed(v); player.setPlaybackRate(v); }}
              className="terracotta-slider"
            />
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

          {/* Generate Audio */}
          <button
            onClick={() =>
              handleGenerate({
                language: selectedLanguage,
                voiceProfile: selectedVoice,
                speed,
                submit: true,
              })
            }
            disabled={isGenerating || !selectedVoice || !chapter}
            className="w-full bg-foreground text-background rounded-lg py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Generate Audio
              </>
            )}
          </button>

          {/* Export Package */}
          <button
            onClick={handleExport}
            disabled={!audioUrl || isExporting}
            title="Downloads transcript and audio for this chapter"
            className="w-full border border-border rounded-lg py-3 text-sm font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
  );

  if (!book) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border bg-sidebar/50 h-14 flex items-center px-4">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold tracking-tight text-foreground">Ekithab AI</span>
            <span className="text-xs text-muted-foreground font-medium">Audiobook</span>
          </div>
          <div className="ml-auto">
            <Button onClick={signOut} variant="outline">Logout</Button>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-xl">
            <BookUploader onDocumentLoaded={handleDocumentLoaded} />
          </div>
          {error && (
            <div className="px-4 pb-4">
              <div className="max-w-xl mx-auto rounded-lg p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            </div>
          )}
        </main>
        {configModal}
      </div>
    );
  }

  return (
    <>
      <MainLayout
        book={book}
        activeChapterIdx={activeIdx}
        chapter={chapter}
        onChapterSelect={selectChapter}
        onLoadNewBook={resetBook}
        onOpenConfig={() => setIsConfigOpen(true)}
        bottomBar={
          <BottomPlayer
            audioUrl={audioUrl}
            isPlaying={player.isPlaying}
            currentTime={player.currentTime}
            duration={player.duration}
            playbackRate={player.playbackRate}
            currentChapterTitle={chapter?.title}
            bookTitle={book?.title}
            bookCoverUrl={book?.coverUrl}
            onPlay={onPlay}
            onPause={onPause}
            onRewind={onRewind}
            onForward={onForward}
            onSeek={(seconds) => player.seek(seconds)}
            onRateChange={(rate) => { setSpeed(rate); player.setPlaybackRate(rate); }}
          />
        }
      >
        {studioContent}
      </MainLayout>
      {configModal}
    </>
  );
}

export default Dashboard;