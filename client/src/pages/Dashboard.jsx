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
import { useAudioPlayer } from '../hooks/useAudioPlayer.jsx';
import { Button } from '../components/ui/button.jsx';

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

  const chapter = book ? book.chapters[activeIdx] : null;
  const alignment = audioResult?.alignment || [];
  const audioUrl = audioResult?.audioUrl || null;
  const player = useAudioPlayer(audioUrl, alignment);

  const estimateCredits = (text) => Math.ceil(text.replace(/[#*`_\[\]]/g, '').trim().length / 100);
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
          text: chapter.text,
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
          text: ch.text,
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
    <MainLayout
      book={book}
      activeChapterIdx={activeIdx}
      chapter={chapter}
      onChapterSelect={selectChapter}
      onLoadNewBook={resetBook}
      onOpenConfig={() => setIsConfigOpen(true)}
    >
      <div className="h-full flex flex-col overflow-hidden">
        {/* Top panel: transcript area */}
        <div className="flex-1 overflow-hidden flex gap-0">
          {/* Transcript */}
          <div className="flex-1 overflow-hidden flex flex-col min-w-0">
            <div className="px-6 pt-5 pb-3 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold truncate">{chapter.title}</h2>
              </div>
              <div className="mt-2">
                <CreditEstimateBadge text={chapter.text} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-4 scrollbar-thin">
              <ReadAlongPlayer
                audioUrl={audioUrl}
                alignment={alignment}
                chapterText={chapter.text}
                onPlay={onPlay}
                onPause={onPause}
                onRewind={onRewind}
                onForward={onForward}
              />
            </div>
          </div>
          {/* Voice, language and speed controls */}
          <div className="w-full min-w-[15rem] md:w-[18rem] border-l border-border bg-sidebar p-3 flex flex-col gap-4">
            <VoiceSelector
              language={selectedLanguage}
              selectedVoice={selectedVoice}
              onSelect={({ voiceProfile, languageCode }) => {
                setSelectedVoice(voiceProfile);
                if (languageCode) setSelectedLanguage(languageCode);
              }}
              onLanguageChange={(language) => setSelectedLanguage(language)}
            />
            <div className="text-xs text-muted-foreground font-medium" >Speed</div>
            <Slider
              min={0.7}
              max={2}
              step={0.1}
              value={[speed]}
              onValueChange={([v]) => setSpeed(v)}
            />
            <Button
              variant="outline"
              size="sm"
              className="self-end"
              disabled={!audioResult}
              onClick={resetBook}
            >
              Reset book
            </Button>
          </div>
        </div>
        {error && (
          <div className="px-4 py-2 border-b border-destructive/20 bg-destructive/5">
            <p className="text-sm text-destructive px-6">{error}</p>
          </div>
        )}
        <BottomPlayer
          audioUrl={audioUrl}
          isPlaying={player.isPlaying}
          currentTime={player.currentTime}
          duration={player.duration}
          playbackRate={player.playbackRate}
          currentChapterTitle={chapter?.title}
          onPlay={onPlay}
          onPause={onPause}
          onRewind={onRewind}
          onForward={onForward}
          onSeek={(seconds) => player.seek(seconds)}
          onRateChange={(rate) => player.setPlaybackRate(rate)}
        />
      </div>
      {configModal}
    </MainLayout>
  );
}

export default Dashboard;
