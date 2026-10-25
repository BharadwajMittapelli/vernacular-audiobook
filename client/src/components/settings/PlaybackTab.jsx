import React, { useState, useEffect } from 'react';
import { Slider } from '../ui/slider.jsx';
import { VoiceSelector } from '../studio/VoiceSelector.jsx';
import { getVoices } from '../../services/api.js';

const PLAYBACK_STORAGE_KEY = 'ekithab-playback';
const DEFAULT_SPEED = 1.0;

export function PlaybackTab() {
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('hi-IN');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PLAYBACK_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.speed) setSpeed(parsed.speed);
        if (parsed.voice) setSelectedVoice(parsed.voice);
        if (parsed.language) setSelectedLanguage(parsed.language);
      }
    } catch {}
  }, []);

  const persist = (updates) => {
    try {
      const current = JSON.parse(localStorage.getItem(PLAYBACK_STORAGE_KEY) || '{}');
      localStorage.setItem(PLAYBACK_STORAGE_KEY, JSON.stringify({ ...current, ...updates }));
    } catch {}
  };

  const handleSpeedChange = (vals) => {
    const v = vals[0];
    setSpeed(v);
    persist({ speed: v });
    setSaved(false);
  };

  const handleVoiceSelect = ({ voiceProfile, languageCode }) => {
    setSelectedVoice(voiceProfile);
    if (languageCode) {
      setSelectedLanguage(languageCode);
      persist({ language: languageCode });
    }
    persist({ voice: voiceProfile });
    setSaved(true);
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-semibold text-foreground mb-1">Playback</h2>
      <p className="text-sm text-muted-foreground mb-6">Configure your default listening preferences.</p>

      <div className="space-y-6">
        {/* Speed */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground">Default playback speed</label>
            <span className="text-sm text-terracotta font-medium">{speed.toFixed(1)}x</span>
          </div>
          <Slider
            min={0.5}
            max={2}
            step={0.1}
            value={[speed]}
            onValueChange={handleSpeedChange}
            className="terracotta-slider"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            This setting applies to future audio generations.
          </p>
        </div>

        {/* Voice */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Default voice</label>
          <div className="relative">
            <select
              value={selectedLanguage}
              onChange={(e) => { setSelectedLanguage(e.target.value); persist({ language: e.target.value }); }}
              className="w-full appearance-none bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground pr-8 focus:outline-none focus:ring-2 focus:ring-terracotta/40 cursor-pointer mb-4"
            >
              <option value="en-IN">English</option>
              <option value="hi-IN">Hindi</option>
              <option value="te-IN">Telugu</option>
              <option value="ta-IN">Tamil</option>
              <option value="kn-IN">Kannada</option>
              <option value="ml-IN">Malayalam</option>
              <option value="mr-IN">Marathi</option>
              <option value="bn-IN">Bengali</option>
              <option value="gu-IN">Gujarati</option>
              <option value="pa-IN">Punjabi</option>
            </select>
          </div>
          <VoiceSelector
            language={selectedLanguage}
            selectedVoice={selectedVoice}
            onSelect={handleVoiceSelect}
            onLanguageChange={(lang) => { setSelectedLanguage(lang); persist({ language: lang }); }}
          />
          <p className="text-xs text-muted-foreground mt-2">
            This setting applies to future audio generations.
          </p>
          {saved && <p className="text-xs text-success mt-1">Saved</p>}
        </div>
      </div>
    </div>
  );
}
