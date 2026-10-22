import express from 'express';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { chunkText, stripMarkdown } from '../services/textProcessor.js';
import { synthesizeText } from '../services/ttsProvider.js';
import { uploadAudio, resolveAudioUrl } from '../services/storageService.js';
import { auditAudio } from '../services/audioAuditService.js';
import { supabase } from '../config/supabase.js';
import { creditGuardMiddleware } from '../middleware/creditGuard.js';
import {
  deductCredits,
  refundCredits,
  InsufficientCreditsError,
  calculateCost,
  isCreditBypassed,
} from '../services/creditService.js';
import { queue } from '../queues/synthesisQueue.js';

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
        .select('audio_url, audio_path, duration, alignment, language, chapter_id')
        .eq('chapter_id', chapterId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Chapter not found' });
    }

    const audioUrl = await resolveAudioUrl(data);
    if (!audioUrl) {
      return res.status(404).json({ success: false, error: 'Chapter not found' });
    }

    res.json({
      success: true,
      audioUrl,
      durationSeconds: data.duration,
      alignment: data.alignment || [],
    });
  } catch (error) {
    console.error('GET /:chapterId error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/audio/synthesize — spend endpoint: documented 5/min threat-model cap
const ttsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { success: false, error: 'Too many synthesis requests, max 5 per minute' },
});

router.post(
  '/synthesize',
  ttsLimiter,
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
        .select('audio_url, audio_path, duration, alignment')
        .eq('idempotency_key', idempotencyKey)
        .eq('status', 'completed')
        .limit(1)
        .single();

      if (existing) {
        const audioUrl = await resolveAudioUrl(existing);
        if (!audioUrl) {
          return res.status(404).json({ success: false, error: 'Not found' });
        }
        return res.json({
          success: true,
          audioUrl,
          durationSeconds: existing.duration,
          alignment: existing.alignment || [],
        });
      }

      const cleanText = stripMarkdown(text);
      const generationId = uuidv4();
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const creditsUsed = req.creditsUsed || 0;

      // Insert a 'processing' placeholder BEFORE synthesis so a concurrent
      // request with the same Idempotency-Key hits the unique constraint and
      // polls instead of duplicating expensive TTS work.
      const { data: inserted, error: insertError } = await supabase
        .from('audio_generations')
        .insert({
          id: generationId,
          user_id: userId,
          chapter_id: chapterId,
          language,
          idempotency_key: idempotencyKey,
          status: 'processing',
        })
        .select('id')
        .single();

      // Handle unique constraint violation (race condition)
      let claimedRow = null;

      if (insertError && insertError.code === '23505' && insertError.message.includes('idempotency_key')) {
        console.log(`[Idempotency] Race detected for key ${idempotencyKey}`);

        const { data: raced } = await supabase
          .from('audio_generations')
          .select('id, status, audio_url, audio_path, duration, alignment')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();

        if (raced?.status === 'completed') {
          const cachedUrl = await resolveAudioUrl(raced);
          if (cachedUrl) {
            return res.json({
              success: true,
              audioUrl: cachedUrl,
              durationSeconds: raced.duration,
              alignment: raced.alignment || [],
            });
          }
        }

        // Claim a previously-failed row for retry. Conditional on status='failed'
        // so concurrent claimers serialize; losers fall through to polling.
        // Deduction keeps the fresh generationId as p_ref_id: reusing the old
        // row id as ledger ref would trip refund_credits' ALREADY_REFUNDED
        // guard on a second failure and strand the user's credits.
        if (raced?.status === 'failed') {
          const { data: claimed } = await supabase
            .from('audio_generations')
            .update({ status: 'processing' })
            .eq('id', raced.id)
            .eq('status', 'failed')
            .select('id')
            .maybeSingle();
          claimedRow = claimed;
        }

        if (!claimedRow) {
          for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            await sleep(POLL_INTERVAL_MS);

            const { data: record, error: pollError } = await supabase
              .from('audio_generations')
              .select('audio_url, audio_path, duration, alignment, status')
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
              const audioUrl = await resolveAudioUrl(record);
              if (!audioUrl) {
                console.warn(`[Idempotency] Record completed but audio_url missing, continuing poll`);
                continue;
              }
              console.log(`[Idempotency] Primary request completed, returning result`);
              return res.json({
                success: true,
                audioUrl,
                durationSeconds: record.duration,
                alignment: record.alignment || [],
              });
            } else if (record.status === 'failed') {
              console.error(`[Idempotency] Primary request failed`);
              return res.status(502).json({
                success: false,
                error: 'Synthesis failed on primary request.',
              });
            }
          }

          console.error(`[Idempotency] Polling timeout after ${MAX_ATTEMPTS} attempts for key ${idempotencyKey}`);
          return res.status(504).json({
            success: false,
            error: 'Synthesis timed out waiting for concurrent request.',
          });
        }
      }

      if (insertError && !claimedRow) {
        console.error('DB insert error:', insertError);
        return res.status(500).json({ success: false, error: 'Failed to record generation' });
      }

      // Update targets the placeholder row or the reclaimed failed row.
      const targetRowId = claimedRow?.id ?? inserted.id;

      // Placeholder insert won the idempotency race. Only this winning request
      // deducts; concurrent losers polled above and paid nothing. Deduct BEFORE
      // any TTS/CPU/API burn so unpaid requests never trigger synthesis.
      try {
        const remaining = await deductCredits(userId, cleanText.length, generationId);
        req.remainingCredits = remaining;
      } catch (err) {
        await supabase
          .from('audio_generations')
          .update({ status: 'failed' })
          .eq('id', targetRowId);
        if (err instanceof InsufficientCreditsError) {
          return res.status(402).json({
            success: false,
            error: 'Insufficient credits. Please top up your wallet.',
          });
        }
        console.error('Deduction error:', err);
        return res.status(500).json({ success: false, error: 'Credit deduction failed' });
      }

      let totalDuration;
      let alignment;
      let audioUrl;
      try {
        const result = await synthesizeText(cleanText, language, voiceProfile, speed);
        totalDuration = result.totalDuration;
        alignment = result.alignment;

        // ponytail: hard-gate prevents corrupted TTS output from reaching CDN
        auditAudio(result.audioBuffer, cleanText, totalDuration);

        // Format follows the actual bytes: a runtime gnani→gtts fallback
        // returns source='gtts' (MP3) even while TTS_PROVIDER says gnani.
        const { audioPath, signedAudioUrl } = await uploadAudio(result.audioBuffer, chapterId, result.source === 'gtts' ? 'mp3' : 'wav');
        audioUrl = signedAudioUrl;

        await supabase
          .from('audio_generations')
          .update({
            audio_url: signedAudioUrl,
            audio_path: audioPath,
            duration: totalDuration,
            credits_used: creditsUsed,
            alignment,
            status: 'completed',
          })
          .eq('id', targetRowId);
      } catch (err) {
        try {
          await refundCredits(userId, cleanText.length, generationId);
        } catch (refundErr) {
          console.error('CRITICAL: refund failed, manual reconciliation needed', {
            userId,
            generationId,
            credits: req.creditsUsed,
            error: refundErr.message,
          });
        }
        await supabase
          .from('audio_generations')
          .update({ status: 'failed' })
          .eq('id', targetRowId);
        throw err;
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

// POST /api/audio/synthesize-async — bulk multi-chapter rendering
router.post('/synthesize-async', async (req, res) => {
  try {
    const { chapters, bookId: incomingBookId, webhookUrl } = req.body;
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';

    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or empty chapters array',
      });
    }

    // Validate each chapter
    for (const ch of chapters) {
      if (!ch.chapterId || !ch.text || !ch.language || !ch.voiceProfile || ch.speed === undefined || !ch.idempotencyKey) {
        return res.status(400).json({
          success: false,
          error: 'Each chapter must have: chapterId, text, language, voiceProfile, speed, idempotencyKey',
        });
      }
    }

    // Upfront credit pre-check (prevents partial-book wallet drain)
    if (!isCreditBypassed()) {
      let totalCost = 0;
      for (const ch of chapters) {
        totalCost += calculateCost(stripMarkdown(ch.text).length);
      }
      const { data: balanceData, error: balanceError } = await supabase.rpc('get_user_balance', { p_user_id: userId });
      if (balanceError) {
        console.error('Balance pre-check failed:', balanceError);
        return res.status(500).json({ success: false, error: 'Credit balance check failed' });
      }
      const availableBalance = balanceData ?? 0;
      if (availableBalance < totalCost) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient credits',
          required: totalCost,
          available: availableBalance,
        });
      }
    }

    const bookId = incomingBookId || uuidv4();

    // Insert book row
    const { error: bookError } = await supabase.from('books').insert({
      id: bookId,
      user_id: userId,
      total_chapters: chapters.length,
      completed_chapters: 0,
      webhook_url: webhookUrl || null,
      status: 'pending',
    });
    if (bookError) {
      console.error('Books insert error:', bookError);
      return res.status(500).json({ success: false, error: 'Failed to create book' });
    }

    // Insert placeholder rows and enqueue jobs
    const queuedJobs = [];
    let cachedCount = 0;
    for (const ch of chapters) {
      const generationId = uuidv4();
      const scopedKey = `${bookId}-${ch.idempotencyKey}`;

      const { data: inserted, error: insertErr } = await supabase
        .from('audio_generations')
        .insert({
          id: generationId,
          user_id: userId,
          chapter_id: ch.chapterId,
          language: ch.language,
          idempotency_key: scopedKey,
          status: 'processing',
          book_id: bookId,
        })
        .select('id')
        .single();

      if (insertErr) {
        if (insertErr.code === '23505' && insertErr.message.includes('idempotency_key')) {
          const { data: existing } = await supabase
            .from('audio_generations')
            .select('id, status')
            .eq('idempotency_key', scopedKey)
            .maybeSingle();

          if (existing?.status === 'processing') {
            queuedJobs.push({ generationId: existing.id, chapter: ch });
          } else if (existing?.status === 'failed') {
            // Conditional claim so concurrent resubmits do not both re-enqueue.
            const { data: reclaimed } = await supabase
              .from('audio_generations')
              .update({ status: 'processing', user_id: userId, book_id: bookId })
              .eq('id', existing.id)
              .eq('status', 'failed')
              .select('id')
              .maybeSingle();
            if (reclaimed) {
              // Fresh ledger ref: the old row id was already refunded once and
              // refund_credits' ALREADY_REFUNDED guard would strand a re-failure.
              queuedJobs.push({ generationId: reclaimed.id, creditsRefId: uuidv4(), chapter: ch });
            }
          } else if (existing?.status === 'completed') {
            cachedCount++; // already billed + synthesized; skip enqueue
          }
        } else {
          console.error(`[Async] Failed to insert placeholder for ${ch.chapterId}:`, insertErr.message);
        }
        continue;
      }

      queuedJobs.push({ generationId: inserted.id, chapter: ch });
    }

    // Enqueue all valid jobs
    for (const { generationId, chapter, creditsRefId } of queuedJobs) {
      await queue.add({
        generationId,
        creditsRefId,
        chapterId: chapter.chapterId,
        text: chapter.text,
        language: chapter.language,
        voiceProfile: chapter.voiceProfile,
        speed: chapter.speed,
        userId,
        creditsUsed: calculateCost(stripMarkdown(chapter.text).length),
        bookId,
      });
    }

    res.status(202).json({
      success: true,
      bookId,
      totalChapters: chapters.length,
      queued: queuedJobs.length,
      cached: cachedCount,
      status: 'queued',
    });
  } catch (error) {
    console.error('POST /synthesize-async error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/audio/credits — fetch authenticated user's current credit balance
router.get('/credits', async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('credits')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, balance: user.credits });
  } catch (error) {
    console.error('GET /api/audio/credits error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;