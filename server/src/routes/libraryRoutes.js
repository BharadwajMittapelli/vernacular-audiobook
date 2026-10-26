import express from 'express';
import { supabase } from '../config/supabase.js';
import { resolveAudioUrl } from '../services/storageService.js';

const router = express.Router();

router.get('/all-audio', async (req, res) => {
  try {
    const userId = req.user.id;

    // Query 1: books with last_opened_at
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, cover_url, last_opened_at')
      .eq('user_id', userId);

    if (booksError) throw booksError;
    const booksMap = new Map((books || []).map((b) => [b.id, b]));

    // Query 2: completed chapters
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, book_id, sequence_number, title, language, created_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (chaptersError) throw chaptersError;

    // Query 3: latest audio generations per chapter
    const { data: generations, error: genError } = await supabase
      .from('audio_generations')
      .select('chapter_uuid, chapter_id, audio_path, audio_url, duration, language, created_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (genError) throw genError;

    // Keep latest per chapter (key by chapter_uuid, fallback chapter_id)
    const latestGenMap = new Map();
    for (const gen of generations || []) {
      const key = gen.chapter_uuid || gen.chapter_id;
      if (!key) continue;
      if (!latestGenMap.has(key)) {
        latestGenMap.set(key, gen);
      }
    }

    // Flatten
    const items = [];
    for (const ch of chapters || []) {
      const gen = latestGenMap.get(ch.id);
      if (!gen) continue;

      const book = booksMap.get(ch.book_id);
      if (!book) continue;

      const audioUrl = await resolveAudioUrl(gen);
      if (!audioUrl) continue;

      items.push({
        chapterId: ch.id,
        chapterTitle: ch.title,
        sequenceNumber: ch.sequence_number,
        bookId: ch.book_id,
        bookTitle: book.title,
        coverUrl: book.cover_url,
        language: gen.language || ch.language,
        durationSeconds: gen.duration,
        audioUrl,
        createdAt: ch.created_at,
        bookLastOpenedAt: book.last_opened_at,
      });
    }

    res.json({ success: true, items });
  } catch (error) {
    console.error('GET /api/library/all-audio error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
