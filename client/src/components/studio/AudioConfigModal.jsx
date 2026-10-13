import React from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import { Slider } from '../ui/slider.jsx';
import { VoiceSelector } from './VoiceSelector.jsx';

export function AudioConfigModal({
  isOpen,
  onClose,
  onGenerate,
  selectedLanguage,
  selectedVoice,
  speed,
  estimatedCredits,
  isGenerating,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Audio configuration"
    >
      <div className="w-full max-w-md bg-card border rounded-xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Audio Configuration</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">Voice</label>
            <VoiceSelector
              language={selectedLanguage}
              selectedVoice={selectedVoice}
              onSelect={({ voiceProfile, languageCode }) =>
                onGenerate({ voiceProfile, language: languageCode })
              }
              onLanguageChange={(language) => onGenerate({ language })}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Speed</label>
              <span className="text-sm text-muted-foreground">{speed.toFixed(1)}x</span>
            </div>
            <Slider
              value={[speed]}
              onValueChange={([v]) => onGenerate({ speed: v })}
              min={0.5}
              max={2}
              step={0.1}
            />
          </div>

          <div className="flex items-center justify-between px-4 py-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Estimated Credits</span>
            <span className="text-lg font-bold text-primary">{estimatedCredits}</span>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() =>
              onGenerate({
                language: selectedLanguage,
                voiceProfile: selectedVoice,
                speed,
                submit: true,
              })
            }
            disabled={isGenerating || !selectedVoice}
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                Generating…
              </span>
            ) : 'Generate Audio'}
          </Button>
        </div>
      </div>
    </div>
  );
}
