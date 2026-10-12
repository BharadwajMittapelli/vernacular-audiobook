import React, { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { splitChapters } from '../../services/chapterSplitter.js';

const MAX_MB = 20;

export function BookUploader({ onDocumentLoaded }) {
  const [dragOver, setDragOver] = useState(false);
  const [msg, setMsg] = useState(null); // { kind: 'error' | 'notice', text }

  const handleFile = (file) => {
    if (!file) return;
    setMsg(null);
    if (file.size > MAX_MB * 1024 * 1024) {
      return setMsg({ kind: 'error', text: `File exceeds the ${MAX_MB} MB limit` });
    }
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf' || ext === 'epub') {
      return setMsg({
        kind: 'notice',
        text: 'PDF & EPUB support requires server-side processing (Backend endpoint pending).',
      });
    }
    if (ext !== 'txt' && ext !== 'md') {
      return setMsg({ kind: 'error', text: 'Unsupported file type — use .txt or .md' });
    }
    const reader = new FileReader();
    reader.onload = () => {
      const chapters = splitChapters(reader.result);
      if (!chapters.length) {
        return setMsg({ kind: 'error', text: 'No readable text found in file' });
      }
      onDocumentLoaded({ title: file.name.replace(/\.[^.]+$/, ''), chapters });
    };
    reader.onerror = () => setMsg({ kind: 'error', text: 'Failed to read file' });
    reader.readAsText(file);
  };

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
      >
        <UploadCloud className="h-10 w-10 text-muted-foreground" />
        <span className="font-medium">Drop a book here, or click to browse</span>
        <span className="text-sm text-muted-foreground">
          .txt and .md parse in-browser · .pdf and .epub coming via server
        </span>
        <input
          type="file"
          accept=".txt,.md,.pdf,.epub"
          className="sr-only"
          onChange={(e) => {
            handleFile(e.target.files[0]);
            e.target.value = '';
          }}
        />
      </label>
      {msg && (
        <p
          className={`mt-3 rounded-md p-3 text-sm ${
            msg.kind === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted'
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
