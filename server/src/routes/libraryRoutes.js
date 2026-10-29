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

// GET /downloads — List current user's downloads with book details
router.get('/downloads', async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('downloads')
      .select(`
        id, user_id, book_id, book_chapter_id, book_title, book_cover_url,
        file_name, file_format, file_size_bytes, exported_at, export_type,
        books!inner (total_chapters)
      `)
      .eq('user_id', userId)
      .order('exported_at', { ascending: false });
    if (error) throw error;
    const downloads = (data || []).map((d) => ({
      id: d.id,
      bookId: d.book_id,
      bookChapterId: d.book_chapter_id,
      bookTitle: d.book_title,
      bookCoverUrl: d.book_cover_url,
      fileName: d.file_name,
      fileFormat: d.file_format,
      fileSize: d.file_size_bytes,
      exportedAt: d.exported_at,
      exportType: d.export_type,
      totalChapters: d.books?.total_chapters ?? null,
    }));
    res.json({ success: true, downloads });
  } catch (err) {
    console.error('GET /api/library/downloads error:', err);
    res.status(500).json({ success: false, error: 'Failed to load downloads' });
  }
});

// POST /downloads/log — Record a successful book export
router.post('/downloads/log', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  const { bookId, bookTitle, bookCoverUrl, fileName, fileFormat, fileSize, exportType, bookChapterId } = req.body;
  if (!bookId || !bookTitle || !fileName) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }
  const validExportTypes = ['full_book', 'chapter'];
  if (!validExportTypes.includes(exportType)) {
    return res.status(400).json({ success: false, error: 'Invalid exportType' });
  }
  if (exportType === 'chapter' && !bookChapterId) {
    return res.status(400).json({ success: false, error: 'bookChapterId required for chapter exports' });
  }
  try {
    const { data, error } = await supabase
      .from('downloads')
      .insert([{
        user_id: userId,
        book_id: bookId,
        book_title: bookTitle,
        book_cover_url: bookCoverUrl || null,
        file_name: fileName,
        file_format: fileFormat || 'mp3',
        file_size_bytes: fileSize || null,
        export_type: exportType || 'full_book',
        book_chapter_id: bookChapterId || null,
      }])
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, download: data });
  } catch (err) {
    console.error('POST /api/library/downloads/log error:', err);
    res.status(500).json({ success: false, error: 'Failed to log download' });
  }
});

// DELETE /downloads/:id — Remove a download record
router.delete('/downloads/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('downloads')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/library/downloads/:id error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete download record' });
  }
});

export default router;
