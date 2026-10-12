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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-background rounded-lg border shadow-lg p-6 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Audio Configuration</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Voice</label>
            <VoiceSelector
              language={selectedLanguage}
              onSelect={({ voiceProfile, languageCode }) =>
                onGenerate({ voiceProfile, language: languageCode })
              }
              onLanguageChange={(language) => onGenerate({ language })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Speed: {speed.toFixed(1)}x
            </label>
            <Slider
              value={[speed]}
              onValueChange={([v]) => onGenerate({ speed: v })}
              min={0.5}
              max={2}
              step={0.1}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-md">
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
            {isGenerating ? 'Generating...' : 'Generate Audio'}
          </Button>
        </div>
      </div>
    </div>
  );
}
