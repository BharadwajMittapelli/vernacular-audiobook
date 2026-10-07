import React from 'react';
import { Settings, Volume2, BookOpen } from 'lucide-react';
import { AudioConfigModal } from './components/studio/AudioConfigModal.jsx';
import { ReadAlongPlayer } from './components/player/ReadAlongPlayer.jsx';
import { CreditEstimateBadge } from './components/studio/CreditEstimateBadge.jsx';
import { synthesizeAudio } from './services/api.js';
import { Button } from './components/ui/button.jsx';

const DEFAULT_TEXT = `# Welcome to eKithab Audio

This is a sample chapter demonstrating the **Read-Along** feature. 

The text will be highlighted in sync with the audio playback. You can click on any sentence to jump to that position.

Support for multiple **Indic languages** including Hindi, Telugu, Tamil, Kannada, and Indian English.`;

function calculateCredits(text) {
  return Math.ceil(text.replace(/[#*`_\[\]]/g, '').length / 100);
}

function App() {
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const [selectedLanguage, setSelectedLanguage] = React.useState('hi-IN');
  const [selectedVoice, setSelectedVoice] = React.useState('female-1');
  const [speed, setSpeed] = React.useState(1);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [audioResult, setAudioResult] = React.useState(null);
  const [error, setError] = React.useState(null);

  const estimatedCredits = calculateCredits(DEFAULT_TEXT);

  const handleGenerate = async (config) => {
    if (config?.language) setSelectedLanguage(config.language);
    if (config?.voiceProfile) setSelectedVoice(config.voiceProfile);
    if (config?.speed !== undefined) setSpeed(config.speed);

    if (!config?.language && !config?.voiceProfile && config?.speed === undefined) {
      setIsGenerating(true);
      setError(null);
      
      try {
        const request = {
          chapterId: 'sample-chapter-1',
          text: DEFAULT_TEXT,
          language: selectedLanguage,
          voiceProfile: selectedVoice,
          speed,
        };
        
        const result = await synthesizeAudio(request);
        setAudioResult(result);
        setIsConfigOpen(false);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to generate audio');
      } finally {
        setIsGenerating(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">eKithab Audio</span>
          </div>
          <Button variant="ghost" onClick={() => setIsConfigOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </header>

      <main className="container mx-auto flex-1 p-4">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Chapter Content</h2>
              <CreditEstimateBadge text={DEFAULT_TEXT} language={selectedLanguage} />
              <ReadAlongPlayer
                audioUrl={audioResult?.audioUrl || null}
                alignment={audioResult?.alignment || []}
                chapterText={DEFAULT_TEXT}
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
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Credits Used</span>
                    <span className="text-primary font-medium">{estimatedCredits}</span>
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
                  <span className="text-muted-foreground">Chapter ID</span>
                  <span className="font-mono">sample-chapter-1</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Characters</span>
                  <span>{DEFAULT_TEXT.replace(/[#*`_\[\]]/g, '').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Credits</span>
                  <span className="text-primary font-medium">{estimatedCredits}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
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