import express from 'express';
import multer from 'multer';
import { supabase, AUDIO_BUCKET } from '../config/supabase.js';
import { resolveAudioUrl, getSignedImageUrl } from '../services/storageService.js';

const router = express.Router();

// Multer config for artwork uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg'];
    const allowedExtensions = ['.jpg', '.jpeg'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (!allowedMimeTypes.includes(file.mimetype) || !allowedExtensions.includes(ext)) {
      return cb(new Error('Only JPEG images are allowed'));
    }
    cb(null, true);
  },
});

router.get('/all-audio', async (req, res) => {
  try {
    const userId = req.user.id;

    // Query 1: books with last_opened_at
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, cover_url, last_opened_at, total_chapters')
      .eq('user_id', userId);

    if (booksError) throw booksError;
    const booksMap = new Map((books || []).map((b) => [b.id, b]));

    // Query 2: latest audio generations per chapter
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

    // Query 3: chapter metadata for the generation rows (no status filter — generations are the source of truth)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const chapterIds = [...latestGenMap.keys()].filter((id) => id && isUuid.test(id));
    const { data: chapters, error: chaptersError } = chapterIds.length > 0
      ? await supabase
          .from('chapters')
          .select('id, book_id, sequence_number, title, language, created_at')
          .in('id', chapterIds)
          .eq('user_id', userId)
      : { data: [], error: null };

    if (chaptersError) throw chaptersError;

    // Flatten
    const items = [];
    for (const ch of chapters || []) {
      const gen = latestGenMap.get(ch.id);
      if (!gen) continue;

      const book = booksMap.get(ch.book_id);
      if (!book) continue;

      const audioUrl = await resolveAudioUrl(gen);
      if (!audioUrl) continue;

      // Generate signed URL for cover image if artwork exists
      let coverUrl = book.cover_url;
      if (coverUrl) {
        try {
          coverUrl = await getSignedImageUrl(coverUrl, 3600);
        } catch (imgError) {
          console.warn(`[Library] Failed to generate signed URL for artwork ${coverUrl}:`, imgError.message);
          coverUrl = null;
        }
      }

      items.push({
        chapterId: ch.id,
        chapterTitle: ch.title,
        sequenceNumber: ch.sequence_number,
        bookId: ch.book_id,
        bookTitle: book.title,
        coverUrl,
        language: gen.language || ch.language,
        durationSeconds: gen.duration,
        audioUrl,
        createdAt: ch.created_at,
        bookLastOpenedAt: book.last_opened_at,
        totalChapters: book.total_chapters ?? null,
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
  if (exportType !== undefined && !validExportTypes.includes(exportType)) {
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
        exported_at: new Date().toISOString(),
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

// POST /playback/log — Record successful playback start (idempotent upsert)
router.post('/playback/log', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  const { bookId, chapterId } = req.body;
  if (!bookId || !chapterId) {
    return res.status(400).json({ success: false, error: 'Missing bookId or chapterId' });
  }

  try {
    // Verify ownership: chapter belongs to user's book
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('id, book_id')
      .eq('id', chapterId)
      .eq('user_id', userId)
      .single();

    if (chapterError || !chapter) {
      return res.status(404).json({ success: false, error: 'Chapter not found or access denied' });
    }
    if (chapter.book_id !== bookId) {
      return res.status(400).json({ success: false, error: 'Chapter does not belong to specified book' });
    }

    // Verify audio generation exists and is completed (actual audio_generations schema)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chapterId);

    let audioQuery = supabase
      .from('audio_generations')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .limit(1);

    if (isUuid) {
      audioQuery = audioQuery.or(`chapter_uuid.eq.${chapterId},chapter_id.eq.${chapterId}`);
    } else {
      audioQuery = audioQuery.eq('chapter_id', chapterId);
    }

    const { data: audioGen, error: audioError } = await audioQuery.single();

    if (audioError || !audioGen) {
      return res.status(400).json({ success: false, error: 'Chapter has no generated audio' });
    }

    // Upsert: insert new or update last_played_at (preserves first_played_at)
    const { data, error } = await supabase
      .from('playback_history')
      .upsert({
        user_id: userId,
        book_id: bookId,
        chapter_id: chapterId,
        last_played_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,chapter_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, history: data });
  } catch (err) {
    console.error('POST /api/library/playback/log error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /playback/history — User's playback history (most recent first)
router.get('/playback/history', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const { data, error } = await supabase
      .from('playback_history')
      .select(`
        id,
        book_id,
        chapter_id,
        first_played_at,
        last_played_at,
        books!inner (id, title, cover_url),
        chapters!inner (id, title, sequence_number, language, estimated_duration_seconds, audio_generations!left (duration, language, status, created_at))
      `)
      .eq('user_id', userId)
      .order('last_played_at', { ascending: false });

    if (error) throw error;

    const history = (data || []).map((h) => {
      const chapter = h.chapters;
      const audioGens = chapter?.audio_generations || [];
      const latestAudio = audioGens
        .filter((g) => g.status === 'completed')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      const durationSeconds = latestAudio?.duration ?? chapter?.estimated_duration_seconds ?? 0;
      const language = latestAudio?.language ?? chapter?.language ?? 'en-IN';
      return {
        id: h.id,
        bookId: h.book_id,
        chapterId: h.chapter_id,
        firstPlayedAt: h.first_played_at,
        lastPlayedAt: h.last_played_at,
        bookTitle: h.books?.title,
        bookCoverUrl: h.books?.cover_url,
        chapterTitle: chapter?.title,
        sequenceNumber: chapter?.sequence_number,
        language,
        durationSeconds,
      };
    });

    res.json({ success: true, history });
  } catch (err) {
    console.error('GET /api/library/playback/history error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /by-book — Books with chapters that have completed audio generations, grouped by book
router.get('/by-book', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    // Query 1: all books for the user (need total_chapters)
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, cover_url, total_chapters')
      .eq('user_id', userId);

    if (booksError) throw booksError;
    const booksMap = new Map((books || []).map((b) => [b.id, b]));

    // Query 2: completed audio generations (source of truth for "has audio")
    const { data: generations, error: genError } = await supabase
      .from('audio_generations')
      .select('chapter_uuid, chapter_id, duration, language, created_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (genError) throw genError;

    // Keep latest generation per chapter (key = chapter_uuid, fallback chapter_id)
    const latestGenMap = new Map();
    for (const gen of generations || []) {
      const key = gen.chapter_uuid || gen.chapter_id;
      if (!key) continue;
      if (!latestGenMap.has(key)) {
        latestGenMap.set(key, gen);
      }
    }

    // Query 3: playback history for played-chapter counts per book
    const { data: history, error: historyError } = await supabase
      .from('playback_history')
      .select('book_id, chapter_id')
      .eq('user_id', userId);

    if (historyError) throw historyError;

    // Count played chapters per book
    const playedCountByBook = new Map();
    for (const h of history || []) {
      const count = playedCountByBook.get(h.book_id) ?? 0;
      playedCountByBook.set(h.book_id, count + 1);
    }

    // Query 4: chapter metadata for the generation rows
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const chapterIds = [...latestGenMap.keys()].filter((id) => id && isUuid.test(id));
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, book_id, sequence_number, title, language, estimated_duration_seconds, created_at')
      .in('id', chapterIds)
      .order('created_at', { ascending: false });

    if (chaptersError) throw chaptersError;

    // Group by book
    const bookMap = new Map();
    for (const ch of chapters || []) {
      const bookId = ch.book_id;
      const book = booksMap.get(bookId);
      if (!book) continue;

      if (!bookMap.has(bookId)) {
        bookMap.set(bookId, {
          bookId: book.id,
          bookTitle: book.title,
          coverUrl: book.cover_url,
          lastPlayedAt: ch.created_at,
          playedChaptersCount: playedCountByBook.get(bookId) ?? 0,
          totalChapters: book.total_chapters,
          chapters: [],
        });
      }

      const bookEntry = bookMap.get(bookId);
      const gen = latestGenMap.get(ch.id);

      bookEntry.chapters.push({
        chapterId: ch.id,
        chapterTitle: ch.title,
        sequenceNumber: ch.sequence_number,
        lastPlayedAt: gen?.created_at || ch.created_at,
        durationSeconds: gen?.duration ?? ch.estimated_duration_seconds,
        language: gen?.language || ch.language,
      });
    }

    const booksResult = Array.from(bookMap.values())
      .sort((a, b) => new Date(b.lastPlayedAt) - new Date(a.lastPlayedAt))
      .map((book) => ({
        ...book,
        chapters: book.chapters.sort((a, b) => a.sequenceNumber - b.sequenceNumber),
      }));

    res.json({ success: true, books: booksResult });
  } catch (err) {
    console.error('GET /api/library/by-book error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /favorites — List current user's favorites
router.get('/favorites', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        chapter_id,
        book_id,
        created_at,
        chapters!inner (id, title, sequence_number, language, estimated_duration_seconds),
        books!inner (id, title, cover_url)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const favorites = (data || []).map((f) => ({
      chapterId: f.chapters?.id,
      bookId: f.books?.id,
      bookTitle: f.books?.title,
      chapterTitle: f.chapters?.title,
      sequenceNumber: f.chapters?.sequence_number,
      coverUrl: f.books?.cover_url,
      language: f.chapters?.language,
      durationSeconds: f.chapters?.estimated_duration_seconds,
      createdAt: f.created_at,
    }));

    res.json({ success: true, favorites });
  } catch (err) {
    console.error('GET /api/library/favorites error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /favorites — Add a chapter to favorites
router.post('/favorites', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { bookId, chapterId } = req.body;
  if (!bookId || !chapterId) {
    return res.status(400).json({ success: false, error: 'Missing bookId or chapterId' });
  }

  try {
    // Verify ownership: chapter belongs to user's book
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('id, book_id')
      .eq('id', chapterId)
      .eq('user_id', userId)
      .single();

    if (chapterError || !chapter) {
      return res.status(404).json({ success: false, error: 'Chapter not found or access denied' });
    }
    if (chapter.book_id !== bookId) {
      return res.status(400).json({ success: false, error: 'Chapter does not belong to specified book' });
    }

    // Verify audio generation exists and is completed
    const { data: audioGen, error: audioError } = await supabase
      .from('audio_generations')
      .select('id')
      .eq('chapter_uuid', chapterId)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .limit(1)
      .single();

    if (audioError || !audioGen) {
      return res.status(400).json({ success: false, error: 'Chapter has no generated audio' });
    }

    // Insert favorite (unique constraint on user_id + chapter_id handles duplicates)
    const { data, error } = await supabase
      .from('favorites')
      .insert([{
        user_id: userId,
        book_id: bookId,
        chapter_id: chapterId,
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'Already in favorites' });
      }
      throw error;
    }

    res.json({ success: true, favorite: data });
  } catch (err) {
    console.error('POST /api/library/favorites error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /favorites/:chapterId — Remove a chapter from favorites
router.delete('/favorites/:chapterId', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { chapterId } = req.params;
  if (!chapterId) {
    return res.status(400).json({ success: false, error: 'Missing chapterId' });
  }

  try {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('chapter_id', chapterId);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/library/favorites/:chapterId error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /artwork/:bookId — Upload custom artwork for a book
router.post('/artwork/:bookId', upload.single('artwork'), async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { bookId } = req.params;
  if (!bookId) {
    return res.status(400).json({ success: false, error: 'Missing bookId' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No artwork file provided' });
  }

  try {
    // Verify user owns the book
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id')
      .eq('id', bookId)
      .eq('user_id', userId)
      .single();

    if (bookError || !book) {
      return res.status(404).json({ success: false, error: 'Book not found or access denied' });
    }

    // Upload artwork to storage with stable path
    const filePath = `artwork/${bookId}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(filePath, req.file.buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('[Artwork] Upload failed:', uploadError.message);
      return res.status(500).json({ success: false, error: 'Failed to upload artwork' });
    }

    // Update book's cover_url with stable path
    const { error: updateError } = await supabase
      .from('books')
      .update({ cover_url: filePath })
      .eq('id', bookId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('[Artwork] DB update failed:', updateError.message);
      return res.status(500).json({ success: false, error: 'Failed to update book artwork' });
    }

    // Generate signed URL for immediate display
    let signedUrl = null;
    try {
      signedUrl = await getSignedImageUrl(filePath, 3600);
    } catch (imgError) {
      console.warn('[Artwork] Signed URL generation failed:', imgError.message);
    }

    res.json({ success: true, coverUrl: signedUrl || filePath });
  } catch (error) {
    console.error('POST /api/library/artwork/:bookId error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /chapters/:chapterId/rename — Rename a chapter title
router.put('/chapters/:chapterId/rename', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { chapterId } = req.params;
  const { title } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ success: false, error: 'Title is required' });
  }

  const trimmedTitle = title.trim();

  try {
    // Verify ownership: chapters has direct user_id column
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('id, book_id, sequence_number, title, status')
      .eq('id', chapterId)
      .eq('user_id', userId)
      .single();

    if (chapterError || !chapter) {
      return res.status(404).json({ success: false, error: 'Chapter not found or access denied' });
    }

    // Update title
    const { data: updated, error: updateError } = await supabase
      .from('chapters')
      .update({ title: trimmedTitle })
      .eq('id', chapterId)
      .eq('user_id', userId)
      .select('id, book_id, sequence_number, title, status')
      .single();

    if (updateError) throw updateError;

    res.json({ success: true, chapter: updated });
  } catch (error) {
    console.error('PUT /api/library/chapters/:chapterId/rename error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
