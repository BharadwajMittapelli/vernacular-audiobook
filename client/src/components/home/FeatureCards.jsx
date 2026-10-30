import React from 'react';
import { FileText, Mic, Sliders, Smartphone } from 'lucide-react';

const FEATURES = [
  {
    icon: FileText,
    title: 'Multiple Formats',
    description: 'Upload PDF, EPUB, DOCX and more.',
    bg: '#f0fdf4', // soft green
  },
  {
    icon: Mic,
    title: 'Natural Voices',
    description: 'High-quality, multilingual AI voices.',
    bg: '#eff6ff', // soft blue
  },
  {
    icon: Sliders,
    title: 'Custom Experience',
    description: 'Adjust speed, voice and listening preferences.',
    bg: '#fff7ed', // soft orange
  },
  {
    icon: Smartphone,
    title: 'Listen Anywhere',
    description: 'On web, mobile or on the go.',
    bg: '#faf5ff', // soft purple
  },
];

export function FeatureCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {FEATURES.map(({ icon: Icon, title, description, bg }) => (
        <div
          key={title}
          className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow"
        >
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center mb-3"
            style={{ backgroundColor: bg }}
          >
            <Icon className="h-6 w-6 text-terracotta" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
      ))}
    </div>
  );
}
