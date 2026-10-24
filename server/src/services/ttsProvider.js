import axios from 'axios';
// gtts's own whitelist (hi/ta/en only of our langs) throws 'Language not
// supported: te|ml|kn|mr|bn|gu|pa'. Reuse its token fn and call translate_tts
// directly — Google itself accepts all our language codes.
import gttsToken from 'gtts/lib/gToken.js';
import { chunkText, translateToIndic } from './textProcessor.js';
import { stitch, getWavDuration, getMp3Duration, DEFAULT_PARAGRAPH_SILENCE_MS } from './audioStitcher.js';
import { calculateAlignment } from './alignmentCalculator.js';

const GTTS_CHAR_DURATION = 0.06;

// Map locale codes to gTTS language codes (must cover every languageCode in
// GNANI_VOICES, else the gTTS fallback receives an invalid code).
const LANG_MAPPING = {
  'hi-IN': 'hi',
  'te-IN': 'te',
  'ta-IN': 'ta',
  'kn-IN': 'kn',
  'en-IN': 'en',
  'hi-en': 'en',
  'ml-IN': 'ml',
  'mr-IN': 'mr',
  'bn-IN': 'bn',
  'gu-IN': 'gu',
  'pa-IN': 'pa',
};

const GTTS_MAX_CHARS = 100;

// translate_tts rejects >100 chars per request; split sentences, then hard-split long ones.
function chunkForGtts(text) {
  const parts = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    let rest = sentence.trim();
    while (rest.length > GTTS_MAX_CHARS) {
      const cut = rest.lastIndexOf(' ', GTTS_MAX_CHARS);
      const idx = cut > 0 ? cut : GTTS_MAX_CHARS;
      parts.push(rest.slice(0, idx));
      rest = rest.slice(idx).trim();
    }
    if (rest) parts.push(rest);
  }
  return parts;
}

async function fetchGttsAudio(part, gttsLang) {
  const params = new URLSearchParams({
    ie: 'UTF-8',
    q: part,
    tl: gttsLang,
    total: '1',
    idx: '0',
    client: 'tw-ob',
    textlen: String(part.length),
    tk: gttsToken(part),
  });
  try {
    const res = await axios.get(`https://translate.google.com/translate_tts?${params}`, {
      responseType: 'arraybuffer',
      headers: {
        Referer: 'http://translate.google.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 15000,
    });
    return Buffer.from(res.data);
  } catch (error) {
    // Classify like the Gnani path so refund logic sees a real error shape.
    if (error.response) {
      const err = new Error(`gTTS request failed with status ${error.response.status}`);
      err.httpStatus = error.response.status;
      throw err;
    }
    const err = new Error(`gTTS request failed: ${error.message}`);
    err.retryableCode = error.code;
    throw err;
  }
}

async function synthesizeWithGtts(text, language, voice, speed = 1.0) {
  const gttsLang = LANG_MAPPING[language] || language;
  const parts = chunkForGtts(text);
  const audioBuffers = [];
  const chunkTimestamps = [];
  const chunkDurations = [];

  for (const part of parts) {
    const audioBuffer = await fetchGttsAudio(part, gttsLang);
    const actualDuration = await getMp3Duration(audioBuffer);
    if (audioBuffer.length === 0 || !actualDuration) {
      throw new Error('gTTS returned empty or unreadable audio');
    }

    audioBuffers.push(audioBuffer);
    chunkTimestamps.push([{ start: 0, end: actualDuration, word: part }]);
    chunkDurations.push(actualDuration);
  }

  const { mergedBuffer, cumulativeTimestamps, totalDuration } = stitch(
    audioBuffers,
    chunkTimestamps,
    chunkDurations
  );

  const alignment = calculateAlignment(text, cumulativeTimestamps, totalDuration);

  return {
    audioBuffer: mergedBuffer,
    totalDuration,
    alignment,
    source: 'gtts',
  };
}

// ponytail: env resolved per call so a missing key can't crash module load
function gnaniConfig() {
  const apiKey = process.env.GNANI_API_KEY || process.env.GNANI_API_KEY_ID;
  const headers = { 'X-API-Key-ID': apiKey, 'Content-Type': 'application/json' };
  if (process.env.GNANI_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GNANI_ACCESS_TOKEN}`;
  }
  return {
    endpoint: process.env.GNANI_TTS_ENDPOINT || 'https://api.vachana.ai/api/v1/tts/inference',
    headers,
  };
}

// Gnani REST TTS returns raw binary WAV (no timestamps — confirmed against
// docs.gnani.ai 2026-10). Sentence alignment is estimated per chunk, same as the gTTS path.
//
// Architectural paragraph spacing: chapters are split on blank lines and each
// paragraph synthesized separately, then stitched with a 600 ms silent PCM gap
// between paragraphs (never between sentence-splits of one paragraph), so
// Read-Along prosody matches the page structure instead of Gnani's flat
// period-length micro-pause for "\n\n".
async function callGnaniApi({ endpoint, headers }, text, language, voice, speed) {
  console.log(`[Gnani] POST ${endpoint}`, { textPreview: text.slice(0, 80), voice, model: 'timbre-v2.5', language, speed });
  try {
    const res = await axios.post(
      endpoint,
      {
        text,
        voice,
        model: 'timbre-v2.5',
        language,
        speed,
        audio_config: { container: 'wav', sample_rate: 48000, num_channels: 1, sample_width: 2 },
      },
      { headers, responseType: 'arraybuffer', timeout: 30000 }
    );
    console.log(`[Gnani] Response: status=${res.status} size=${res.data.length}B`);
    return Buffer.from(res.data);
  } catch (error) {
    // Classify errors so the gTTS fallback and refund gates still work.
    if (error.response) {
      console.log(`[Gnani] Error: status=${error.response.status} body=${error.response.data?.toString?.()?.slice(0, 300) ?? 'no body'}`);
      const err = new Error(`Gnani API error ${error.response.status}: ${error.response.data?.toString?.() ?? ''}`);
      err.httpStatus = error.response.status;
      throw err;
    }
    const err = new Error(`Gnani API request failed: ${error.message}`);
    err.retryableCode = error.code;
    throw err;
  }
}

async function synthesizeWithGnani(text, language, voice, speed = 1.0) {
  const { endpoint, headers } = gnaniConfig();

  const paragraphs = text.split(/[\r\n]{2,}/).filter((p) => p.trim());

  // 400-char API cap stays enforced: long paragraphs still split at sentence
  // boundaries, but silence is only injected at paragraph boundaries.
  const pieces = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    for (const piece of chunkText(paragraph)) {
      pieces.push({ piece, paragraphIndex });
    }
  });

  const audioBuffers = [];
  const chunkTimestamps = [];
  const chunkDurations = [];
  const pieceParagraphIndexes = [];

  for (const { piece, paragraphIndex } of pieces) {
    const audioBuffer = await callGnaniApi({ endpoint, headers }, piece, language, voice, speed);

    const chunkDuration = getWavDuration(audioBuffer);
    if (audioBuffer.length === 0 || !chunkDuration) {
      throw new Error('Gnani returned empty or non-WAV audio');
    }

    audioBuffers.push(audioBuffer);
    chunkTimestamps.push([{ start: 0, end: chunkDuration, word: piece.trim() }]);
    chunkDurations.push(chunkDuration);
    pieceParagraphIndexes.push(paragraphIndex);
  }

  // gapIndices[i] = true → chunk i and i+1 belong to different paragraphs.
  const gapIndices = audioBuffers.slice(1).map((_, i) => pieceParagraphIndexes[i] !== pieceParagraphIndexes[i + 1]);

  const { mergedBuffer, cumulativeTimestamps, totalDuration } = stitch(
    audioBuffers,
    chunkTimestamps,
    chunkDurations,
    DEFAULT_PARAGRAPH_SILENCE_MS,
    gapIndices
  );

  const alignment = calculateAlignment(text, cumulativeTimestamps, totalDuration);

  return {
    audioBuffer: mergedBuffer,
    totalDuration,
    alignment,
    source: 'gnani',
  };
}

// Only transient failure classes fall back: network errors and 5xx. 4xx is a
// config/payload bug (bad key, malformed text) and must fail hard.
const RETRYABLE_CODES = new Set(['ECONNABORTED', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);

function isRetryableTtsFailure(err) {
  return RETRYABLE_CODES.has(err.retryableCode) || (typeof err.httpStatus === 'number' && err.httpStatus >= 500);
}

export { isRetryableTtsFailure };

export async function synthesizeText(text, language, voice, speed = 1.0) {
  // ★ NEW: translate to native Indic script BEFORE any provider logic.
  const translatedText = await translateToIndic(text, language);

  const provider = process.env.TTS_PROVIDER || 'gtts';

  if (provider === 'gnani' && (process.env.GNANI_API_KEY || process.env.GNANI_API_KEY_ID)) {
    try {
      return await synthesizeWithGnani(translatedText, language, voice, speed);
    } catch (err) {
      if (process.env.TTS_FALLBACK_ENABLED === 'false' || !isRetryableTtsFailure(err)) throw err;
      console.warn(`[TTS] Primary provider failed, falling back to gTTS: ${err.message}`);
      return await synthesizeWithGtts(translatedText, language, voice, speed);
    }
  }

  return await synthesizeWithGtts(translatedText, language, voice, speed);
}