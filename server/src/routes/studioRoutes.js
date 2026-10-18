import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { stripMarkdown } from '../services/textProcessor.js';
import { synthesizeText } from '../services/ttsProvider.js';
import { uploadAudio, resolveAudioUrl } from '../services/storageService.js';
import { auditAudio } from '../services/audioAuditService.js';
import { supabase } from '../config/supabase.js';
import { deductCredits, InsufficientCreditsError, calculateCost, refundCredits } from '../services/creditService.js';

const router = express.Router();

// GET / — list books for the authenticated user
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, cover_url, total_chapters, completed_chapters, status, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, books: data || [] });
  } catch (error) {
    console.error('GET /studio error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST / — ingest a parsed document (title + chapters[]) into books + chapters tables
router.post('/', async (req, res) => {
  try {
    const { title, chapters } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Missing or empty title' });
    }
    if (!Array.isArray(chapters) || chapters.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing or empty chapters array' });
    }

    for (const ch of chapters) {
      if (!ch.title || typeof ch.title !== 'string' || !ch.title.trim()) {
        return res.status(400).json({ success: false, error: 'Each chapter must have a non-empty title' });
      }
      if (!ch.text || typeof ch.text !== 'string' || !ch.text.trim()) {
        return res.status(400).json({ success: false, error: 'Each chapter must have non-empty text' });
      }
    }

    // Insert the book row and capture its id for chapter FK
    const { data: book, error: bookError } = await supabase
      .from('books')
      .insert({
        user_id: req.user.id,
        title: title.trim(),
        total_chapters: chapters.length,
        completed_chapters: 0,
        status: 'pending',
      })
      .select('*')
      .single();

    if (bookError || !book) throw bookError;

    // Build chapter rows with DRY text processing
    const chaptersData = chapters.map((ch, i) => {
      const cleanText = stripMarkdown(ch.text.trim());
      if (!cleanText) return null;
      return {
        book_id: book.id,
        user_id: req.user.id,
        sequence_number: i + 1,
        title: ch.title.trim(),
        text_content: cleanText,
        char_count: cleanText.length,
        estimated_duration_seconds: Math.ceil(cleanText.length / 15),
        status: 'pending',
      };
    }).filter(Boolean);

    if (chaptersData.length === 0) {
      await supabase.from('books').delete().eq('id', book.id).eq('user_id', req.user.id);
      return res.status(400).json({ success: false, error: 'No valid chapters after text processing' });
    }

    const { error: chaptersError } = await supabase.from('chapters').insert(chaptersData);
    if (chaptersError) {
      // ponytail: rollback orphaned book on partial failure; no DB transaction RPC exists
      await supabase.from('books').delete().eq('id', book.id).eq('user_id', req.user.id);
      throw chaptersError;
    }

    const { data: insertedChapters } = await supabase
      .from('chapters')
      .select('id, sequence_number, title, char_count, estimated_duration_seconds, status')
      .eq('book_id', book.id)
      .order('sequence_number', { ascending: true });

    res.json({
      success: true,
      book: { id: book.id, title: book.title, total_chapters: book.total_chapters, completed_chapters: book.completed_chapters, status: book.status, created_at: book.created_at },
      chapters: insertedChapters || [],
    });
  } catch (error) {
    console.error('POST /studio error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /:bookId/synthesize-all — bulk chapter synthesis (detached in-memory worker)
router.post('/:bookId/synthesize-all', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { language, voiceProfile, speed } = req.body;

    if (!language || !voiceProfile) {
      return res.status(400).json({ success: false, error: 'Missing required fields: language, voiceProfile' });
    }

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, status')
      .eq('id', bookId)
      .eq('user_id', req.user.id)
      .single();

    if (bookError || !book) {
      return res.status(404).json({ success: false, error: 'Book not found' });
    }

    if (book.status === 'processing') {
      return res.status(409).json({ success: false, error: 'Synthesis already in progress' });
    }

    const { data: pendingChapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, char_count, text_content')
      .eq('book_id', bookId)
      .in('status', ['pending', 'failed'])
      .order('sequence_number');

    if (chaptersError) throw chaptersError;
    if (!pendingChapters.length) {
      return res.status(400).json({ success: false, error: 'No chapters need processing' });
    }

    const totalCost = pendingChapters.reduce((sum, ch) => sum + calculateCost(ch.char_count), 0);
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('id', req.user.id)
      .single();

    if (userError || !userData) throw userError;
    if (userData.credits < totalCost) {
      return res.status(402).json({ success: false, error: 'Insufficient credits. Please top up your wallet.' });
    }

    await supabase
      .from('books')
      .update({ status: 'processing' })
      .eq('id', bookId)
      .eq('user_id', req.user.id);

    res.status(202).json({ success: true, message: 'Bulk synthesis started', totalChapters: pendingChapters.length });

    // ponytail: detached in-memory worker; durability deferred per project decision
    const userId = req.user.id;
    Promise.resolve().then(async () => {
      for (const chapter of pendingChapters) {
        await supabase
          .from('chapters')
          .update({ status: 'processing' })
          .eq('id', chapter.id)
          .eq('book_id', bookId);

        const generationId = uuidv4();
        try {
          await deductCredits(userId, chapter.char_count, generationId);
        } catch (deductErr) {
          if (deductErr instanceof InsufficientCreditsError) {
            // Revert stranded 'processing' chapter so retry picks it up
            await supabase
              .from('chapters')
              .update({ status: 'pending' })
              .eq('id', chapter.id)
              .eq('book_id', bookId);
            break;
          }
          throw deductErr;
        }

        try {
          const cleanText = stripMarkdown(chapter.text_content);
          const result = await synthesizeText(cleanText, language, voiceProfile, speed);
          auditAudio(result.audioBuffer, cleanText, result.totalDuration);
          const { audioPath, signedAudioUrl } = await uploadAudio(
            result.audioBuffer,
            chapter.id,
            result.source === 'gtts' ? 'mp3' : 'wav'
          );

          await supabase.from('audio_generations').insert({
            id: generationId,
            user_id: userId,
            chapter_id: chapter.id,
            chapter_uuid: chapter.id,
            book_id: bookId,
            language,
            audio_url: signedAudioUrl,
            audio_path: audioPath,
            duration: result.totalDuration,
            alignment: result.alignment,
            credits_used: calculateCost(chapter.char_count),
            status: 'completed',
          });

          await supabase
            .from('chapters')
            .update({ status: 'completed' })
            .eq('id', chapter.id)
            .eq('book_id', bookId);
        } catch (err) {
          try {
            await refundCredits(userId, chapter.char_count, generationId);
          } catch (refundErr) {
            console.error('CRITICAL: refund failed during bulk synthesis', { userId, generationId, error: refundErr.message });
          }
          await supabase
            .from('chapters')
            .update({ status: 'failed' })
            .eq('id', chapter.id)
            .eq('book_id', bookId);
        }
      }

      try {
        const { count: remaining } = await supabase
          .from('chapters')
          .select('id', { count: 'exact', head: true })
          .eq('book_id', bookId)
          .in('status', ['pending', 'failed']);
        await supabase
          .from('books')
          .update({ status: (remaining ?? 0) === 0 ? 'completed' : 'failed' })
          .eq('id', bookId)
          .eq('user_id', userId);
      } catch (e) {
        console.error('Aggregate status update failed:', e);
      }
    }).catch((e) => {
      console.error('Bulk synthesis worker crashed:', e);
    });
  } catch (error) {
    console.error('POST /studio/:bookId/synthesize-all error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /:bookId — book details + ordered chapters
router.get('/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, title, cover_url, total_chapters, completed_chapters, status, created_at')
      .eq('id', bookId)
      .eq('user_id', req.user.id)
      .single();

    if (bookError || !book) {
      return res.status(404).json({ success: false, error: 'Book not found' });
    }

    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, sequence_number, title, char_count, estimated_duration_seconds, status')
      .eq('book_id', bookId)
      .order('sequence_number', { ascending: true });

    if (chaptersError) throw chaptersError;

    res.json({ success: true, book, chapters: chapters || [] });
  } catch (error) {
    console.error('GET /studio/:bookId error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /:bookId — permanently delete a book and cascade
router.delete('/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('status')
      .eq('id', bookId)
      .eq('user_id', req.user.id)
      .single();

    if (bookError || !book) {
      return res.status(404).json({ success: false, error: 'Book not found' });
    }

    if (book.status === 'processing') {
      return res.status(409).json({ success: false, error: 'Cannot delete a book while it is being synthesized' });
    }

    const { error: deleteError } = await supabase
      .from('books')
      .delete()
      .eq('id', bookId)
      .eq('user_id', req.user.id);

    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Book deleted successfully' });
  } catch (error) {
    console.error('DELETE /studio/:bookId error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /chapters/:chapterId — chapter content + latest audio generation
router.get('/chapters/:chapterId', async (req, res) => {
  try {
    const { chapterId } = req.params;

    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('id, book_id, sequence_number, title, text_content, char_count, estimated_duration_seconds, status, created_at')
      .eq('id', chapterId)
      .eq('user_id', req.user.id)
      .single();

    if (chapterError || !chapter) {
      return res.status(404).json({ success: false, error: 'Chapter not found' });
    }

    const { data: audioGen, error: audioError } = await supabase
      .from('audio_generations')
      .select('audio_url, audio_path, duration, alignment')
      .eq('chapter_uuid', chapterId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (audioError && audioError.code !== 'PGRST116') {
      console.error('audio_generations query error:', audioError);
    }

    let audioUrl = null;
    if (audioGen) {
      audioUrl = await resolveAudioUrl(audioGen);
    }

    res.json({
      success: true,
      chapter,
      audio: audioUrl ? { audioUrl, durationSeconds: audioGen.duration, alignment: audioGen.alignment } : null,
    });
  } catch (error) {
    console.error('GET /studio/chapters/:chapterId error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /chapters/:chapterId — edit chapter title and text
router.put('/chapters/:chapterId', async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { title, text_content } = req.body;

    if (title === undefined && text_content === undefined) {
      return res.status(400).json({ success: false, error: 'At least one of title or text_content must be provided' });
    }

    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('id, status')
      .eq('id', chapterId)
      .eq('user_id', req.user.id)
      .single();

    if (chapterError || !chapter) {
      return res.status(404).json({ success: false, error: 'Chapter not found' });
    }

    if (chapter.status === 'processing') {
      return res.status(409).json({ success: false, error: 'Cannot edit chapter while synthesizing' });
    }

    const updates = {};
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ success: false, error: 'title must be a non-empty string' });
      }
      updates.title = title.trim();
    }

    if (text_content !== undefined) {
      if (typeof text_content !== 'string' || !text_content.trim()) {
        return res.status(400).json({ success: false, error: 'text_content must be a non-empty string' });
      }
      const cleanText = stripMarkdown(text_content.trim());
      updates.text_content = cleanText;
      updates.char_count = cleanText.length;
      updates.estimated_duration_seconds = Math.ceil(cleanText.length / 15);
      updates.status = 'pending';
    }

    const { data: updated, error: updateError } = await supabase
      .from('chapters')
      .update(updates)
      .eq('id', chapterId)
      .eq('user_id', req.user.id)
      .select('id, sequence_number, title, char_count, estimated_duration_seconds, status')
      .single();

    if (updateError) throw updateError;

    res.json({ success: true, chapter: updated });
  } catch (error) {
    console.error('PUT /studio/chapters/:chapterId error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /chapters/:chapterId/synthesize — generate audio for a single chapter
router.post('/chapters/:chapterId/synthesize', async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { language, voiceProfile, speed } = req.body;

    // Fetch and validate the chapter
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('id, text_content, char_count, status')
      .eq('id', chapterId)
      .eq('user_id', req.user.id)
      .single();

    if (chapterError || !chapter) {
      return res.status(404).json({ success: false, error: 'Chapter not found' });
    }

    if (chapter.status === 'completed') {
      // Already synthesized — return existing audio from audio_generations
      const { data: audioGen } = await supabase
        .from('audio_generations')
        .select('audio_url, audio_path, duration, alignment')
        .eq('chapter_uuid', chapterId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (audioGen) {
        const audioUrl = await resolveAudioUrl(audioGen);
        return res.json({
          success: true,
          audioUrl,
          durationSeconds: audioGen.duration,
          alignment: audioGen.alignment,
        });
      }
    }

    if (!language || !voiceProfile) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: language, voiceProfile',
      });
    }

    const generationId = uuidv4();
    const cleanText = stripMarkdown(chapter.text_content);
    const creditsUsed = calculateCost(cleanText.length);

    // Deduct credits BEFORE synthesis
    try {
      await deductCredits(req.user.id, cleanText.length, generationId);
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient credits. Please top up your wallet.',
        });
      }
      throw err;
    }

    // Synthesize
    let totalDuration, alignment;
    let audioUrl;
    try {
      const result = await synthesizeText(cleanText, language, voiceProfile, speed);
      totalDuration = result.totalDuration;
      alignment = result.alignment;

      auditAudio(result.audioBuffer, cleanText, totalDuration);

      const { audioPath, signedAudioUrl } = await uploadAudio(
        result.audioBuffer,
        chapterId,
        result.source === 'gtts' ? 'mp3' : 'wav'
      );
      audioUrl = signedAudioUrl;

      // Insert audio_generations row linked to chapter_uuid
      await supabase.from('audio_generations').insert({
        id: generationId,
        user_id: req.user.id,
        chapter_id: chapterId,
        chapter_uuid: chapterId,
        language,
        audio_url: signedAudioUrl,
        audio_path: audioPath,
        duration: totalDuration,
        alignment,
        credits_used: creditsUsed,
        status: 'completed',
      });

      // Update chapter status to completed
      await supabase
        .from('chapters')
        .update({ status: 'completed' })
        .eq('id', chapterId);

    } catch (err) {
      // Refund credits on synthesis failure
      try {
        await refundCredits(req.user.id, cleanText.length, generationId);
      } catch (refundErr) {
        console.error('CRITICAL: refund failed during studio synthesis', { userId: req.user.id, generationId, error: refundErr.message });
      }
      throw err;
    }

    res.json({
      success: true,
      audioUrl,
      durationSeconds: totalDuration,
      alignment,
    });
  } catch (error) {
    console.error('POST /studio/chapters/:chapterId/synthesize error:', error);
    res.status(502).json({
      success: false,
      error: error.message || 'Audio synthesis failed',
    });
  }
});

export default router;
