import React, { useEffect, useState } from 'react';
import { BookOpen, UploadCloud, Globe, FolderOpen, FileText } from 'lucide-react';
import { splitChapters } from '../../services/chapterSplitter.js';
import { uploadDocument, getVoices } from '../../services/api.js';

const MAX_MB = 20;

const LANGUAGE_LABELS = {
  'en-IN': 'English',
  'hi-IN': 'Hindi',
  'ta-IN': 'Tamil',
  'te-IN': 'Telugu',
  'kn-IN': 'Kannada',
  'ml-IN': 'Malayalam',
  'bn-IN': 'Bengali',
  'gu-IN': 'Gujarati',
  'mr-IN': 'Marathi',
  'pa-IN': 'Punjabi',
};

const FORMAT_ICONS = [
  { ext: 'PDF', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  { ext: 'EPUB', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  { ext: 'DOCX', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  { ext: 'TXT', color: 'text-stone-600', bg: 'bg-stone-50 border-stone-200' },
  { ext: 'MD', color: 'text-stone-600', bg: 'bg-stone-50 border-stone-200' },
];

export function BookUploader({ onDocumentLoaded }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [language, setLanguage] = useState('en-IN');
  const [languages, setLanguages] = useState(Object.keys(LANGUAGE_LABELS));
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    getVoices()
      .then((vs) => {
        const codes = [...new Set(vs.map((v) => v.languageCode))];
        if (codes.length) setLanguages(codes);
      })
      .catch(() => {});
  }, []);

  const handleFile = (file) => {
    if (!file || uploading) return;
    setMsg(null);
    if (file.size > MAX_MB * 1024 * 1024) {
      return setMsg({ kind: 'error', text: `File exceeds the ${MAX_MB} MB limit` });
    }
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf' || ext === 'epub') {
      setUploading(true);
      return uploadDocument(file, language)
        .then((res) => {
          if (!res || typeof res.title !== 'string' || !Array.isArray(res.chapters)) {
            throw new Error('Invalid server response: expected { title, chapters }');
          }
          onDocumentLoaded({ ...res, language: res.language || language });
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
      onDocumentLoaded({ title: file.name.replace(/\.[^.]+$/, ''), chapters, language });
    };
    reader.onerror = () => setMsg({ kind: 'error', text: 'Failed to read file' });
    reader.readAsText(file);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-terracotta/10 flex items-center justify-center mx-auto mb-3">
          <BookOpen className="h-6 w-6 text-terracotta" />
        </div>
        <h2 className="text-xl font-semibold text-foreground font-serif">
          Create a New <span className="text-terracotta">Audio Book</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a book to begin generating audiobooks
        </p>
      </div>

      {/* Language Selection */}
      <div>
        <label htmlFor="upload-language" className="block text-sm font-medium text-foreground mb-1.5">
          Language
        </label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <select
            id="upload-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-9 pr-8 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta appearance-none"
          >
            {languages.map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_LABELS[code] ?? code}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          Used when .pdf, .epub and .docx files are parsed on the server
        </p>
      </div>

      {/* Upload Dropzone */}
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
          rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-150
          ${dragOver
            ? 'border-terracotta bg-terracotta/5'
            : 'border-terracotta/30 hover:border-terracotta/60 hover:bg-terracotta/5'
          }
          ${uploading ? 'pointer-events-none opacity-70' : ''}
        `}
      >
        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${dragOver ? 'bg-terracotta/20' : 'bg-terracotta/10'}`}>
          <UploadCloud className={`h-7 w-7 ${dragOver ? 'text-terracotta' : 'text-terracotta'}`} />
        </div>
        <div>
          <span className="font-medium text-base text-foreground">
            {uploading ? 'Parsing on the server…' : 'Drop a book here, or '}
            <span className="text-terracotta font-medium">
              {uploading ? '' : 'click to browse'}
            </span>
          </span>
          <p className="text-sm text-muted-foreground mt-1.5">
            .txt and .md parse in-browser · .pdf and .epub parse on the server
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta text-terracotta-foreground rounded-lg text-sm font-medium hover:bg-terracotta/90 transition-colors disabled:opacity-50"
        >
          <FolderOpen className="h-4 w-4" />
          Choose a File
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.pdf,.epub"
          className="sr-only"
          onChange={(e) => {
            handleFile(e.target.files[0]);
            e.target.value = '';
          }}
        />
      </label>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Supported Formats */}
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {FORMAT_ICONS.map(({ ext, color, bg }) => (
            <div
              key={ext}
              className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg border ${bg}`}
            >
              <FileText className={`h-5 w-5 ${color}`} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{ext}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Supported formats: PDF, EPUB, DOCX, TXT, MD
        </p>
      </div>

      {/* Error/Message */}
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
