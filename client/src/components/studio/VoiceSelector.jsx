import React, { useEffect, useState } from 'react';
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
  const [filterLang, setFilterLang] = useState('all');

  useEffect(() => {
    getVoices(language)
      .then(setVoices)
      .catch((err) => setError(err.response?.data?.error || err.message));
  }, [language]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!voices) return <p className="text-sm text-muted-foreground">Loading voices…</p>;

  const shown = filterLang === 'all' ? voices : voices.filter((v) => v.languageCode === filterLang);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Language">
        {['all', ...new Set(voices.map((v) => v.languageCode))].map((code) => (
          <button
            key={code}
            role="tab"
            aria-selected={filterLang === code}
            onClick={() => {
              setFilterLang(code);
              if (code !== 'all') onLanguageChange?.(code);
            }}
            className={`
              px-3 py-1 rounded-full text-xs font-medium transition-colors
              ${filterLang === code
                ? 'bg-primary text-primary-foreground'
                : 'bg-elevated text-muted-foreground hover:text-foreground hover:bg-secondary'
              }
            `}
          >
            {code === 'all' ? 'All' : LABELS[code] || code}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2" role="listbox" aria-label="Voices">
        {shown.map((v) => (
          <button
            key={v.id}
            role="option"
            aria-selected={selectedVoice === v.id}
            onClick={() => onSelect?.({ voiceProfile: v.id, languageCode: v.languageCode })}
            className={`
              text-left p-3 rounded-lg border transition-colors
              hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
              ${selectedVoice === v.id ? 'border-primary bg-primary/10' : 'border-border bg-card'}
            `}
          >
            <div className="text-sm font-medium truncate">{v.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5 capitalize">
              {v.gender} · {v.accent}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
