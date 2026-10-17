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
