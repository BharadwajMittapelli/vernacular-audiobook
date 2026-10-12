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

export function VoiceSelector({ language, onSelect, onLanguageChange }) {
  const [voices, setVoices] = useState(null);
  const [error, setError] = useState(null);
  const [fallbackLang, setFallbackLang] = useState('all');

  useEffect(() => {
    // fetch once; tab filtering is client-side to stay under the 60/min voice limiter
    getVoices()
      .then(setVoices)
      .catch((err) => setError(err.response?.data?.error || err.message));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!voices) return <p className="text-sm text-muted-foreground">Loading voices…</p>;

  const active = language || fallbackLang;
  const shown = active === 'all' ? voices : voices.filter((v) => v.languageCode === active);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1" role="tablist">
        {['all', ...new Set(voices.map((v) => v.languageCode))].map((code) => (
          <button
            key={code}
            role="tab"
            aria-selected={active === code}
            onClick={() => {
              setFallbackLang(code);
              if (code !== 'all') onLanguageChange?.(code);
            }}
            className={
              active === code
                ? 'px-3 py-1 rounded-full text-sm bg-primary text-primary-foreground'
                : 'px-3 py-1 rounded-full text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }
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
            aria-selected={false}
            onClick={() => onSelect?.({ voiceProfile: v.id, languageCode: v.languageCode })}
            className="text-left p-3 rounded-lg border hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="font-medium">{v.name}</div>
            <div className="text-xs text-muted-foreground capitalize">
              {v.gender} · {v.accent}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
