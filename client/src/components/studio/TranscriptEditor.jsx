import React from 'react';
import { Wand2 } from 'lucide-react';
import { updateChapter } from '../../services/api.js';
import { cleanOcrText } from '../../services/textNormalizer.js';

export function TranscriptEditor({ chapter, onSaved, onError }) {
  const chapterId = chapter?.chapterId ?? chapter?.id;
  const [draft, setDraft] = React.useState(chapter?.text || '');
  const [saving, setSaving] = React.useState(false);

  // Reset only when switching chapters; a same-chapter text refresh (e.g. after
  // save) must not clobber an in-progress draft.
  const lastChapterId = React.useRef(chapterId);
  React.useEffect(() => {
    if (lastChapterId.current !== chapterId) {
      lastChapterId.current = chapterId;
      setDraft(chapter?.text || '');
    }
  }, [chapterId, chapter?.text]);

  const dirty = draft !== (chapter?.text || '');
  const canSave = dirty && draft.trim().length > 0 && !saving;

  const handleClean = () => {
    setDraft((d) => cleanOcrText(d));
  };

  const handleSave = async () => {
    setSaving(true);
    onError(null);
    try {
      // Persist the cleaned text so DB char_count matches what synthesis sees.
      const res = await updateChapter(chapterId, { text_content: cleanOcrText(draft) });
      setDraft(res.chapter.text_content);
      onSaved(res.chapter);
    } catch (err) {
      onError(err.response?.data?.error || err.message || 'Failed to save chapter');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{draft.trim().length.toLocaleString()} chars</span>
          {dirty && (
            <span className="flex items-center gap-1.5 text-terracotta font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-terracotta" />
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClean}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Clean Text
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {saving && (
              <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            )}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        aria-label="Chapter transcript"
        className="w-full min-h-[60vh] resize-y rounded-lg border border-border bg-card px-4 py-3 font-serif text-sm leading-relaxed text-foreground whitespace-pre-wrap focus:outline-none focus:ring-2 focus:ring-terracotta/40 scrollbar-thin"
      />
    </div>
  );
}
