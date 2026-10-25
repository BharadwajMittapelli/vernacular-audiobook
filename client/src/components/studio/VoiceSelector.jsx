import React, { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { getVoices } from '../../services/api.js';

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

export function VoiceSelector({ language, onSelect, onLanguageChange, selectedVoice }) {
  const [voices, setVoices] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getVoices(language)
      .then(setVoices)
      .catch((err) => setError(err.response?.data?.error || err.message));
  }, [language]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!voices) return <p className="text-sm text-muted-foreground">Loading voices…</p>;

  return (
    <div className="space-y-2" role="listbox" aria-label="Voices">
      {voices.map((v) => {
        const isSelected = selectedVoice === v.id;
        const initials = (v.name || '').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
        return (
          <button
            key={v.id}
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect?.({ voiceProfile: v.id, languageCode: v.languageCode })}
            className="w-full cursor-pointer text-left p-3 rounded-lg border transition-colors flex items-start gap-2.5 overflow-hidden hover:border-terracotta/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40 focus-visible:bg-terracotta/5
              ${isSelected ? 'border-terracotta bg-terracotta/5' : 'border-border bg-card'}
            "
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
              isSelected ? 'bg-terracotta text-terracotta-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium break-words">{v.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                {v.gender} · {v.accent}
              </div>
            </div>
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer ${
              isSelected ? 'bg-terracotta/15 text-terracotta' : 'bg-muted text-muted-foreground hover:bg-terracotta/10 hover:text-terracotta'
            }`}>
              <Play className="h-3 w-3" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
