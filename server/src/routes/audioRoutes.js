import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { chunkText, stripMarkdown } from '../services/textProcessor.js';
import { synthesizeText } from '../services/ttsProvider.js';
import { uploadAudio } from '../services/storageService.js';
import { supabase } from '../config/supabase.js';
import { creditGuardMiddleware } from '../middleware/creditGuard.js';

const router = express.Router();

// Polling configuration for idempotency race condition
const MAX_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// GET /api/audio/:chapterId — fetch existing generation
router.get('/:chapterId', async (req, res) => {
  try {
    const { chapterId } = req.params;

    const { data, error } = await supabase
      .from('audio_generations')
      .select('audio_url, duration, alignment, language, chapter_id')
      .eq('chapter_id', chapterId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Chapter not found' });
    }

    res.json({
      success: true,
      audioUrl: data.audio_url,
      durationSeconds: data.duration,
      alignment: data.alignment || [],
    });
  } catch (error) {
    console.error('GET /:chapterId error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/audio/synthesize
router.post(
  '/synthesize',
  creditGuardMiddleware,
  async (req, res) => {
    try {
      const { chapterId, text, language, voiceProfile, speed } = req.body;
      const idempotencyKey = req.headers['idempotency-key'];

      if (!chapterId || !text || !language || !voiceProfile || speed === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: chapterId, text, language, voiceProfile, speed',
        });
      }

      if (!idempotencyKey) {
        return res.status(400).json({
          success: false,
          error: 'Missing required header: Idempotency-Key',
        });
      }

      // First, try to find existing completed generation (fast path)
      const { data: existing } = await supabase
        .from('audio_generations')
        .select('audio_url, duration, alignment')
        .eq('idempotency_key', idempotencyKey)
        .eq('status', 'completed')
        .limit(1)
        .single();

      if (existing) {
        return res.json({
          success: true,
          audioUrl: existing.audio_url,
          durationSeconds: existing.duration,
          alignment: existing.alignment || [],
        });
      }

      const cleanText = stripMarkdown(text);
      const generationId = uuidv4();
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const creditsUsed = req.creditsUsed || 0;

      const { audioBuffer, totalDuration, alignment } = await synthesizeText(
        cleanText,
        language,
        voiceProfile,
        speed
      );

      const isGtts = process.env.TTS_PROVIDER === 'gtts';
      const audioUrl = await uploadAudio(audioBuffer, chapterId, isGtts ? 'mp3' : 'wav');

      // Insert with idempotency_key — relies on UNIQUE constraint for race safety
      // Use 'processing' status initially so concurrent requests can detect in-progress work
      const { data: inserted, error: insertError } = await supabase
        .from('audio_generations')
        .insert({
          id: generationId,
          user_id: userId,
          chapter_id: chapterId,
          language,
          audio_url: audioUrl,
          duration: totalDuration,
          credits_used: creditsUsed,
          alignment,
          idempotency_key: idempotencyKey,
          status: 'processing',
        })
        .select('id')
        .single();

      // Handle unique constraint violation (race condition)
      if (insertError && insertError.code === '23505' && insertError.message.includes('idempotency_key')) {
        // Another request is processing — poll until completion or failure
        console.log(`[Idempotency] Race detected for key ${idempotencyKey}, polling...`);

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          await sleep(POLL_INTERVAL_MS);

          const { data: record, error: pollError } = await supabase
            .from('audio_generations')
            .select('audio_url, duration, alignment, status')
            .eq('idempotency_key', idempotencyKey)
            .limit(1)
            .single();

          if (pollError) {
            console.warn(`[Idempotency] Poll attempt ${attempt}/${MAX_ATTEMPTS} failed:`, pollError.message);
            continue;
          }

          if (!record) {
            console.warn(`[Idempotency] Poll attempt ${attempt}/${MAX_ATTEMPTS}: record not found yet`);
            continue;
          }

          console.log(`[Idempotency] Poll attempt ${attempt}/${MAX_ATTEMPTS}: status=${record.status}`);

          if (record.status === 'completed') {
            if (record.audio_url) {
              console.log(`[Idempotency] Primary request completed, returning result`);
              return res.json({
                success: true,
                audioUrl: record.audio_url,
                durationSeconds: record.duration,
                alignment: record.alignment || [],
              });
            }
            // Record marked completed but no URL yet — keep polling
            console.warn(`[Idempotency] Record completed but audio_url missing, continuing poll`);
          } else if (record.status === 'failed') {
            console.error(`[Idempotency] Primary request failed`);
            return res.status(502).json({
              success: false,
              error: 'Synthesis failed on primary request.',
            });
          }
          // status === 'processing' or 'pending' — continue polling
        }

        // Max attempts reached without completion
        console.error(`[Idempotency] Polling timeout after ${MAX_ATTEMPTS} attempts for key ${idempotencyKey}`);
        return res.status(504).json({
          success: false,
          error: 'Synthesis timed out waiting for concurrent request.',
        });
      }

      if (insertError) {
        console.error('DB insert error:', insertError);
        return res.status(500).json({ success: false, error: 'Failed to record generation' });
      }

      // Update status to completed (success path — we won the race)
      try {
        await supabase
          .from('audio_generations')
          .update({ status: 'completed' })
          .eq('id', inserted.id);
      } catch (updateError) {
        // Non-fatal: record exists with audio_url, status will be 'processing' but data is complete
        console.warn('Failed to update status to completed:', updateError.message);
      }

      res.json({
        success: true,
        audioUrl,
        durationSeconds: totalDuration,
        alignment,
      });
    } catch (error) {
      console.error('Synthesis error:', error);
      res.status(502).json({
        success: false,
        error: error.message || 'Audio synthesis failed',
      });
    }
  }
);

export default router;