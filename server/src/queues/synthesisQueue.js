import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase.js';
import { stripMarkdown } from '../services/textProcessor.js';
import { synthesizeText } from '../services/ttsProvider.js';
import { uploadAudio, resolveAudioUrl } from '../services/storageService.js';
import { auditAudio } from '../services/audioAuditService.js';
import {
  deductCredits,
  refundCredits,
} from '../services/creditService.js';

// Conditional BullMQ import with in-memory fallback
let Queue = null;
try {
  const m = await import('bullmq');
  Queue = m.Queue;
} catch {
  // bullmq not installed; will use in-memory fallback
}

const redisUrl = process.env.REDIS_URL;

// ponytail: single-worker in-memory queue for MVP; parallel workers need Redis
class InMemoryQueue {
  constructor() {
    this.jobs = new Map();
    this.running = false;
    this.pollInterval = null;
  }

  async add(jobData) {
    const jobId = uuidv4();
    this.jobs.set(jobId, { ...jobData, jobId, state: 'waiting' });
    return { jobId };
  }

  start(workerFn) {
    if (this.pollInterval) return;
    this.running = true;
    this.pollInterval = setInterval(async () => {
      if (!this.running) return;
      for (const [jobId, job] of this.jobs) {
        if (job.state === 'waiting') {
          job.state = 'processing';
          try {
            await workerFn(job);
            job.state = 'completed';
          } catch (err) {
            console.error(`[InMemoryQueue] Job ${jobId} failed:`, err.message);
            job.state = 'failed';
          }
          this.jobs.delete(jobId);
        }
      }
    }, 500);
  }

  async close() {
    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

let queue;
if (Queue && redisUrl) {
  const { RedisConnection } = await import('bullmq');
  queue = new Queue('synthesis', { connection: { url: redisUrl } });
  console.log('[SynthesisQueue] Connected to Redis:', redisUrl);
} else {
  queue = new InMemoryQueue();
  console.log('[SynthesisQueue] Using in-memory fallback (no REDIS_URL)');
}

async function synthesizeChapterWorker(jobData) {
  const {
    generationId,
    creditsRefId,
    chapterId,
    text,
    language,
    voiceProfile,
    speed,
    userId,
    creditsUsed,
    bookId,
  } = jobData;

  // Verify placeholder row still exists and is processing (idempotency guard)
  const { data: row, error: fetchError } = await supabase
    .from('audio_generations')
    .select('id, status')
    .eq('id', generationId)
    .single();

  if (fetchError || !row || row.status !== 'processing') {
    console.warn(`[Worker] Job ${generationId} already claimed or missing, skipping`);
    return;
  }

  const cleanText = stripMarkdown(text);
  // Reclaimed failed rows arrive with a fresh creditsRefId; originals derive
  // their ledger ref from generationId. Deduct and refund must use the same ref.
  const refId = creditsRefId || generationId;

  // Atomic credit deduction (same rule as sync route)
  let remaining;
  try {
    remaining = await deductCredits(userId, cleanText.length, refId);
  } catch (err) {
    if (err.name === 'InsufficientCreditsError') {
      await supabase
        .from('audio_generations')
        .update({ status: 'failed' })
        .eq('id', generationId);
      if (bookId) {
        await supabase.rpc('mark_book_failed', { p_book_id: bookId });
      }
    }
    throw err;
  }

  let totalDuration;
  let alignment;

  try {
    const result = await synthesizeText(cleanText, language, voiceProfile, speed);
    totalDuration = result.totalDuration;
    alignment = result.alignment;

    // ponytail: hard-gate prevents corrupted TTS output from reaching CDN
    auditAudio(result.audioBuffer, cleanText, totalDuration);

    // Format follows the actual bytes: a runtime gnani→gtts fallback
    // returns source='gtts' (MP3) even while TTS_PROVIDER says gnani.
    const { audioPath, signedAudioUrl } = await uploadAudio(
      result.audioBuffer,
      chapterId,
      result.source === 'gtts' ? 'mp3' : 'wav'
    );

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
      .eq('id', generationId);

    // Atomic completion increment (race-safe)
    if (bookId) {
      try {
        const { data: completionResult } = await supabase.rpc('increment_book_completion', {
          p_book_id: bookId,
        });
        if (completionResult && completionResult.completed === completionResult.total) {
          await onJobComplete(bookId);
        }
      } catch (rpcErr) {
        console.error('[Worker] increment_book_completion failed:', rpcErr.message);
      }
    }
  } catch (err) {
    try {
      await refundCredits(userId, cleanText.length, refId);
    } catch (refundErr) {
      console.error('CRITICAL: async refund failed, manual reconciliation needed', {
        userId,
        generationId,
        credits: creditsUsed,
        error: refundErr.message,
      });
    }
    await supabase
      .from('audio_generations')
      .update({ status: 'failed' })
      .eq('id', generationId);
    if (bookId) {
      await supabase.rpc('mark_book_failed', { p_book_id: bookId });
    }
    throw err;
  }
}

async function onJobComplete(bookId) {
  const { data: book } = await supabase
    .from('books')
    .select('webhook_url')
    .eq('id', bookId)
    .single();

  if (!book?.webhook_url) {
    console.log(`[Book] ${bookId} completed — no webhook URL, skipping notification`);
    return;
  }

  try {
    const chapters = await supabase
      .from('audio_generations')
      .select('id, chapter_id, audio_url, duration')
      .eq('book_id', bookId)
      .eq('status', 'completed');

    await fetch(book.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookId,
        completedAt: new Date().toISOString(),
        chapters: chapters.data,
      }),
    });
    console.log(`[Book] ${bookId} notification sent`);
  } catch (err) {
    console.warn(`[Book] Webhook failed for ${bookId}:`, err.message);
  }
}

queue.start(synthesizeChapterWorker);

export { queue, synthesizeChapterWorker };
