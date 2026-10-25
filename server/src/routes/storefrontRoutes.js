import express from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../config/supabase.js';
import { resolveAudioUrl } from '../services/storageService.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const embedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after a minute',
  },
});

const router = express.Router();

// Wildcard CORS for /api/storefront is applied by the app-level delegate in
// index.js; no per-router cors() here (duplicate ACAO headers otherwise).

// GET /api/storefront/embed/:generationId — public read-only playback metadata
// for a specific completed generation. Keyed by the audio_generations primary
// key (a chapter may have multiple generations per language/voice/rerun).
router.get('/embed/:generationId', embedLimiter, async (req, res) => {
  try {
    const { generationId } = req.params;

    if (!UUID_RE.test(generationId)) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const { data, error } = await supabase
      .from('audio_generations')
      .select('id, chapter_id, audio_url, audio_path, duration, alignment')
      .eq('id', generationId)
      .eq('status', 'completed')
      .maybeSingle();

    if (error) {
      console.error('Storefront embed DB error:', error);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }

    if (!data) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const audioUrl = await resolveAudioUrl(data);
    if (!audioUrl) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    res.json({
      success: true,
      generationId: data.id,
      chapterId: data.chapter_id,
      audioUrl,
      durationSeconds: data.duration,
      alignment: data.alignment || [],
    });
  } catch (error) {
    console.error('GET /embed/:generationId error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/storefront/book/:bookId — public read-only book + chapters + audio.
// No auth by design (share links). Service-role key bypasses RLS.
router.get('/book/:bookId', embedLimiter, async (req, res) => {
  try {
    const { bookId } = req.params;

    if (!UUID_RE.test(bookId)) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, title, cover_url, total_chapters, completed_chapters, status, language')
      .eq('id', bookId)
      .maybeSingle();

    if (bookError) throw bookError;
    // Only completed books are shareable; 404 hides existence of the rest
    if (!book || book.status !== 'completed') {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, sequence_number, title, text_content, char_count, estimated_duration_seconds, status')
      .eq('book_id', bookId)
      .eq('status', 'completed')
      .order('sequence_number', { ascending: true });

    if (chaptersError) throw chaptersError;

    // Latest completed generation per chapter (reruns create extra rows).
    // Guard: PostgREST rejects an empty .in() array.
    let generations = [];
    if (chapters && chapters.length > 0) {
      const { data: genData, error: genError } = await supabase
        .from('audio_generations')
        .select('chapter_uuid, audio_url, audio_path, duration, alignment, created_at')
        .in('chapter_uuid', chapters.map((c) => c.id))
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (genError) throw genError;
      generations = genData || [];
    }

    const latestByChapter = new Map();
    for (const gen of generations) {
      if (gen.chapter_uuid && !latestByChapter.has(gen.chapter_uuid)) {
        latestByChapter.set(gen.chapter_uuid, gen);
      }
    }

    const chaptersWithAudio = await Promise.all(
      (chapters || []).map(async (ch) => {
        const gen = latestByChapter.get(ch.id);
        const audioUrl = gen ? await resolveAudioUrl(gen) : null;
        return {
          id: ch.id,
          sequenceNumber: ch.sequence_number,
          title: ch.title,
          text: ch.text_content,
          durationSeconds: gen?.duration ?? null,
          alignment: gen?.alignment ?? [],
          audioUrl,
        };
      })
    );

    res.json({
      success: true,
      book: {
        id: book.id,
        title: book.title,
        coverUrl: book.cover_url,
        language: book.language,
        totalChapters: book.total_chapters,
      },
      chapters: chaptersWithAudio,
    });
  } catch (error) {
    console.error('GET /storefront/book/:bookId error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
