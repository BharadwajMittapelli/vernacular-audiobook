import express from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../config/supabase.js';
import { stripMarkdown } from '../services/textProcessor.js';
import { normalizeTranscript, needsNormalization } from '../services/transcriptNormalizer.js';

const router = express.Router();

// Groq-spending endpoint; user-paced JIT calls get a modest per-IP bucket.
const normalizeLimiter = rateLimit({
   windowMs: 60 * 1000,
   max: 10,
   standardHeaders: 'draft-6',
   legacyHeaders: false,
   keyGenerator: (req) => req.ip,
   message: { success: false, error: 'Too many optimization requests, max 10 per minute' },
   handler: (req, res, _next, options) => {
     const retryAfter = Math.ceil((options.windowMs - (Date.now() % options.windowMs)) / 1000);
     res.status(429).json({
       success: false,
       error: options.message.error,
       retryAfter,
       retryAfterMs: retryAfter * 1000,
     });
   },
 });

// POST /:chapterId/normalize — JIT Groq normalization of one chapter (raw_text -> text_content)
router.post('/:chapterId/normalize', normalizeLimiter, async (req, res) => {
  try {
    const { chapterId } = req.params;

    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('id, language, text_content, raw_text, normalized, status')
      .eq('id', chapterId)
      .eq('user_id', req.user.id)
      .single();

    if (chapterError || !chapter) {
      return res.status(404).json({ success: false, error: 'Chapter not found' });
    }

    if (chapter.status === 'processing') {
      return res.status(409).json({ success: false, error: 'Cannot optimize chapter while synthesizing' });
    }

    if (chapter.normalized === true) {
      return res.status(409).json({ success: false, error: 'Chapter is already optimized' });
    }

    // Always normalize the untouched extraction so retries can never
    // double-translate an already-translated text_content.
    const source = chapter.raw_text ?? chapter.text_content;

    if (!needsNormalization(chapter.language, source)) {
      const { error: updateError } = await supabase
        .from('chapters')
        .update({ normalized: true })
        .eq('id', chapterId)
        .eq('user_id', req.user.id);
      if (updateError) throw updateError;
      return res.json({ success: true, normalized: true, skipped: true, reason: 'Text does not require TTS script optimization' });
    }

    let result;
    try {
      result = await normalizeTranscript(source, chapter.language);
    } catch (err) {
      console.error(`[TranscriptNormalizer] chapter ${chapterId} failed:`, err.message);
      return res.status(502).json({ success: false, error: 'Script optimization failed. Please retry.' });
    }

    const normalizedText = stripMarkdown(result.normalized_text);
    if (!normalizedText) {
      console.error(`[TranscriptNormalizer] chapter ${chapterId} produced empty text`);
      return res.status(502).json({ success: false, error: 'Script optimization failed. Please retry.' });
    }

    const { data: updated, error: updateError } = await supabase
      .from('chapters')
      .update({
        text_content: normalizedText,
        normalized_words: result.preserved_words,
        normalized: true,
        char_count: normalizedText.length,
        estimated_duration_seconds: Math.ceil(normalizedText.length / 15),
      })
      .eq('id', chapterId)
      .eq('user_id', req.user.id)
      .select('id, sequence_number, title, text_content, char_count, estimated_duration_seconds, normalized')
      .single();

    if (updateError) throw updateError;

    res.json({ success: true, normalized: true, chapter: updated, preserved_words: result.preserved_words });
  } catch (error) {
    console.error('POST /chapters/:chapterId/normalize error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
