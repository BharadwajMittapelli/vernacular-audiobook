import React, { useState } from 'react';
import { UploadCloud, FileText } from 'lucide-react';
import { splitChapters } from '../../services/chapterSplitter.js';
import { uploadDocument } from '../../services/api.js';

const MAX_MB = 20;

export function BookUploader({ onDocumentLoaded }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleFile = (file) => {
    if (!file || uploading) return;
    setMsg(null);
    if (file.size > MAX_MB * 1024 * 1024) {
      return setMsg({ kind: 'error', text: `File exceeds the ${MAX_MB} MB limit` });
    }
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf' || ext === 'epub') {
      setUploading(true);
      return uploadDocument(file)
        .then((res) => {
          if (!res || typeof res.title !== 'string' || !Array.isArray(res.chapters)) {
            throw new Error('Invalid server response: expected { title, chapters }');
          }
          onDocumentLoaded(res);
        })
        .catch((err) =>
          setMsg({ kind: 'error', text: err.response?.data?.error || err.message || 'Upload failed' })
        )
        .finally(() => setUploading(false));
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
    <div className="space-y-4">
      <div className="text-center mb-6">
        <FileText className="h-10 w-10 text-primary mx-auto mb-3" />
        <h2 className="text-xl font-semibold mb-1">Start a New Project</h2>
        <p className="text-sm text-muted-foreground">
          Upload a book to begin generating audiobooks
        </p>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        className={`
          flex cursor-pointer flex-col items-center justify-center gap-3
          rounded-xl border-2 border-dashed p-12 text-center transition-all duration-150
          ${dragOver
            ? 'border-primary bg-active scale-[1.01]'
            : 'border-border hover:border-primary/40 hover:bg-muted/50'
          }
          ${uploading ? 'pointer-events-none opacity-70' : ''}
        `}
      >
        <UploadCloud className={`h-12 w-12 ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
        <div>
          <span className="font-medium text-base">
            {uploading ? 'Parsing on the server…' : 'Drop a book here, or click to browse'}
          </span>
          <p className="text-sm text-muted-foreground mt-1.5">
            .txt and .md parse in-browser · .pdf and .epub parse on the server
          </p>
        </div>
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
        <p className={`rounded-lg p-3 text-sm ${
          msg.kind === 'error'
            ? 'bg-destructive/10 text-destructive border border-destructive/20'
            : 'bg-elevated text-foreground'
        }`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
