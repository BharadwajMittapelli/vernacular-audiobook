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

// Static preview dictionary. No live TTS call — prevents burning credits on UI clicks.
// ponytail: upgrade to real short previews once a lightweight streaming endpoint exists.
const VOICE_PREVIEW_URLS = {
  'ar-IN-female-1': '',
  'bn-IN-female-1': '',
  'en-AU-female-1': '',
  'en-GB-female-1': '',
  'en-GB-male-1': '',
  'en-IN-female-1': '',
  'en-IN-male-1': '',
  'en-US-female-1': '',
  'en-US-male-1': '',
  'es-ES-female-1': '',
  'es-MX-female-1': '',
  'fr-FR-female-1': '',
  'de-DE-female-1': '',
  'hi-IN-female-1': '',
  'it-IT-female-1': '',
  'ja-JP-female-1': '',
  'kn-IN-female-1': '',
  'ko-KR-female-1': '',
  'ml-IN-female-1': '',
  'mr-IN-female-1': '',
  'nl-NL-female-1': '',
  'pl-PL-female-1': '',
  'pt-BR-female-1': '',
  'ru-RU-female-1': '',
  'ta-IN-female-1': '',
  'te-IN-female-1': '',
  'tr-TR-female-1': '',
  'zh-CN-female-1': '',
};

// GET /:voiceId/preview — public, rate-limited at 60 req/min by voiceLimiter.
router.get('/:voiceId/preview', voiceLimiter, (req, res) => {
  try {
    const { voiceId } = req.params;
    const audioUrl = VOICE_PREVIEW_URLS[voiceId] ?? '';
    res.json({ success: true, voiceId, audioUrl });
  } catch (error) {
    console.error('GET /:voiceId/preview error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
