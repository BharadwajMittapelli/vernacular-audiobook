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

export default router;
