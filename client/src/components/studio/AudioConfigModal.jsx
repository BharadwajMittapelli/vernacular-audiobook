import React from 'react';
import { X, Volume2 } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.jsx';
import { Slider } from '../ui/slider.jsx';

const LANGUAGES = [
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'en-IN', name: 'Indian English (Hinglish)', nativeName: 'Hinglish' },
];

const VOICES = [
  { id: 'female-1', name: 'Female 1', language: 'hi-IN' },
  { id: 'male-1', name: 'Male 1', language: 'hi-IN' },
  { id: 'female-1', name: 'Female 1', language: 'te-IN' },
  { id: 'male-1', name: 'Male 1', language: 'te-IN' },
  { id: 'female-1', name: 'Female 1', language: 'ta-IN' },
  { id: 'male-1', name: 'Male 1', language: 'ta-IN' },
  { id: 'female-1', name: 'Female 1', language: 'kn-IN' },
  { id: 'male-1', name: 'Male 1', language: 'kn-IN' },
  { id: 'female-1', name: 'Female 1', language: 'en-IN' },
  { id: 'male-1', name: 'Male 1', language: 'en-IN' },
];

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

  const filteredVoices = VOICES.filter(v => v.language === selectedLanguage);

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
            <label className="block text-sm font-medium mb-2">Language</label>
            <Select value={selectedLanguage} onValueChange={(value) => onGenerate({ language: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(lang => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name} ({lang.nativeName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Voice Profile</label>
            <Select value={selectedVoice} onValueChange={(value) => onGenerate({ voiceProfile: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select voice" />
              </SelectTrigger>
              <SelectContent>
                {filteredVoices.map(voice => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            onClick={() => onGenerate({ language: selectedLanguage, voiceProfile: selectedVoice, speed })}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Audio'}
          </Button>
        </div>
      </div>
    </div>
  );
}