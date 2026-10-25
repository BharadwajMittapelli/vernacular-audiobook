import React from 'react';
import { Globe, FileText, AudioLines, Sliders } from 'lucide-react';

const FEATURES = [
  {
    icon: Globe,
    title: 'Multilingual listening',
    description: 'Convert and listen to books in multiple languages.',
  },
  {
    icon: FileText,
    title: 'Synchronized reading',
    description: 'Follow along with highlighted text as you listen.',
  },
  {
    icon: AudioLines,
    title: 'Natural-sounding voices',
    description: 'High-quality AI voices in your language.',
  },
  {
    icon: Sliders,
    title: 'Flexible playback',
    description: 'Adjust speed and control your listening experience.',
  },
];

export function FeatureCards() {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-foreground mb-4">Explore what you can do</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="bg-card border border-border rounded-lg p-4"
          >
            <Icon className="h-8 w-8 text-terracotta mb-3" />
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
