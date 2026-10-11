import express from 'express';
import rateLimit from 'express-rate-limit';
import { GNANI_VOICES } from '../config/gnaniVoices.js';

const router = express.Router();

const voiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { success: false, error: 'Too many requests from this IP, please try again after a minute' },
});

// GET /api/voices — public catalog of Gnani prebuilt voices.
// Optional ?language=<langCode> filter, e.g. ?language=hi-IN.
router.get('/', voiceLimiter, (req, res) => {
  try {
    const { language } = req.query;
    const voices = language
      ? GNANI_VOICES.filter((v) => v.languageCode === language)
      : GNANI_VOICES;
    return res.json({ success: true, voices });
  } catch (error) {
    console.error('GET / error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
