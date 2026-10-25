import React from 'react';
import { Upload, FileText, Headphones } from 'lucide-react';

export function BookEmptyState({ onUpload }) {
  return (
    <div className="border-2 border-dashed border-border rounded-xl p-12 text-center mb-8">
      <div className="flex justify-center mb-4">
        <div className="w-20 h-20 bg-terracotta/10 rounded-full flex items-center justify-center">
          <Headphones className="h-10 w-10 text-terracotta" />
        </div>
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">Bring your next book to life</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
        Upload a document and turn it into a multilingual audiobook with synchronized reading.
      </p>
      <button
        onClick={onUpload}
        className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        <Upload className="h-4 w-4" />
        Upload a Document
      </button>
      <p className="text-xs text-muted-foreground mt-4">
        Supports PDF, EPUB, TXT, MD
      </p>
    </div>
  );
}
