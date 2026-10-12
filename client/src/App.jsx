import React from 'react';
import { Settings, Volume2, BookOpen, Upload } from 'lucide-react';
import { AudioConfigModal } from './components/studio/AudioConfigModal.jsx';
import { ReadAlongPlayer } from './components/player/ReadAlongPlayer.jsx';
import { CreditEstimateBadge } from './components/studio/CreditEstimateBadge.jsx';
import { BookUploader } from './components/studio/BookUploader.jsx';
import { synthesizeAudio, synthesizeAsync, getChapterAudio } from './services/api.js';
import { Button } from './components/ui/button.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select.jsx';

// mirrors server stripMarkdown (textProcessor.js) — same formula as CreditEstimateBadge
const estimateCredits = (text) => Math.ceil(text.replace(/[#*`_\[\]]/g, '').trim().length / 100);

function App() {
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
  const estimatedCredits = chapter ? estimateCredits(chapter.text) : 0;
  const totalCredits = book
    ? book.chapters.reduce((sum, ch) => sum + estimateCredits(ch.text), 0)
    : 0;

  const loadChapterAudio = React.useCallback(async (ch) => {
    setAudioResult(null);
    try {
      const res = await getChapterAudio(ch.chapterId);
      if (res.success) setAudioResult(res);
    } catch {
      // 404 = not generated yet, normal state
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
        const result = await synthesizeAudio({
          chapterId: chapter.chapterId,
          text: chapter.text,
          language: selectedLanguage,
          voiceProfile: selectedVoice,
          speed,
        });
        setAudioResult(result);
        setIsConfigOpen(false);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to generate audio');
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

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">
              eKithab Audio{book ? ` · ${book.title}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {book && (
              <Button variant="ghost" onClick={resetBook}>
                <Upload className="h-4 w-4 mr-2" />
                Load New Book
              </Button>
            )}
            <Button variant="ghost" onClick={() => setIsConfigOpen(true)} disabled={!book}>
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto flex-1 p-4">
        {!book ? (
          <div className="mx-auto max-w-2xl py-12">
            <BookUploader onDocumentLoaded={handleDocumentLoaded} />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="rounded-lg border bg-card p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold truncate">{chapter.title}</h2>
                  {book.chapters.length > 1 && (
                    <Select
                      value={String(activeIdx)}
                      onValueChange={(v) => selectChapter(Number(v))}
                    >
                      <SelectTrigger className="w-56 shrink-0">
                        <SelectValue placeholder="Chapter" />
                      </SelectTrigger>
                      <SelectContent>
                        {book.chapters.map((ch, i) => (
                          <SelectItem key={ch.chapterId} value={String(i)}>
                            {ch.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <CreditEstimateBadge text={chapter.text} />
                <ReadAlongPlayer
                  audioUrl={audioResult?.audioUrl || null}
                  alignment={audioResult?.alignment || []}
                  chapterText={chapter.text}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Volume2 className="h-5 w-5" />
                  Audio Status
                </h3>
                {audioResult ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span>{audioResult.durationSeconds.toFixed(1)}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sentences</span>
                      <span>{audioResult.alignment.length}</span>
                    </div>
                    <Button variant="outline" className="w-full mt-2" onClick={() => setIsConfigOpen(true)}>
                      Regenerate
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <p>No audio generated yet</p>
                    <Button variant="outline" className="mt-2 w-full" onClick={() => setIsConfigOpen(true)}>
                      Generate Audio
                    </Button>
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={generateAll}
                  disabled={isBulk || isGenerating || !selectedVoice}
                >
                  {isBulk ? 'Queueing…' : `Generate All (${totalCredits} credits)`}
                </Button>
                {bulkStatus && (
                  <p className="mt-2 p-2 text-sm bg-primary/10 text-primary rounded-md">{bulkStatus}</p>
                )}
                {error && (
                  <div className="mt-3 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                    {error}
                  </div>
                )}
              </div>

              <div className="rounded-lg border bg-card p-4">
                <h3 className="font-semibold mb-3">Chapter Info</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chapter</span>
                    <span>{activeIdx + 1} / {book.chapters.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Characters</span>
                    <span>{chapter.text.replace(/[#*`_\[\]]/g, '').trim().length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. Credits</span>
                    <span className="text-primary font-medium">{estimatedCredits}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

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
    </div>
  );
}

export default App;
