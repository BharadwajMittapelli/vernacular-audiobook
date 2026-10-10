import gtts from 'gtts';
import { chunkText } from './textProcessor.js';
import { stitch, getWavDuration, getMp3Duration } from './audioStitcher.js';
import { calculateAlignment } from './alignmentCalculator.js';

const GTTS_CHAR_DURATION = 0.06;

// Map locale codes to gTTS language codes
const LANG_MAPPING = {
  'hi-IN': 'hi',
  'te-IN': 'te',
  'ta-IN': 'ta',
  'kn-IN': 'kn',
  'en-IN': 'en',
};

async function synthesizeWithGtts(text, language, voice, speed = 1.0) {
  const gttsLang = LANG_MAPPING[language] || language;
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const audioBuffers = [];
  const chunkTimestamps = [];
  const chunkDurations = [];

  for (const sentence of sentences) {
    const audioBuffer = await new Promise((resolve, reject) => {
      const t = new gtts(sentence.trim(), gttsLang);
      const stream = t.stream();
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });

    // Extract actual duration from MP3 buffer
    const actualDuration = await getMp3Duration(audioBuffer);

    audioBuffers.push(audioBuffer);
    chunkTimestamps.push([{ start: 0, end: actualDuration, word: sentence.trim() }]);
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

async function synthesizeWithGnani(text, language, voice, speed = 1.0) {
  const gnaniService = await import('./gnaniService.js');
  const audioBuffers = [];
  const allTimestamps = [];
  let totalDuration = 0;
  let timeOffset = 0;

  const chunks = chunkText(text);

  for (const chunk of chunks) {
    try {
      const result = await gnaniService.synthesizeSpeech(chunk, language, voice, speed);
      audioBuffers.push(result.audioBuffer);

      // Use actual duration from Gnani response (more accurate than header parsing)
      const chunkDuration = result.duration;
      totalDuration += chunkDuration;

      const adjustedTimestamps = result.timestamps.map((ts) => ({
        ...ts,
        start: ts.start + timeOffset,
        end: ts.end + timeOffset,
      }));
      allTimestamps.push(...adjustedTimestamps);
      timeOffset += chunkDuration;
    } catch (error) {
      throw new Error(`Gnani chunk synthesis failed: ${error.message}`);
    }
  }

  // For Gnani, we already have proper timestamps, just stitch buffers
  const { mergedBuffer, cumulativeTimestamps } = stitch(
    audioBuffers,
    [allTimestamps],
    [totalDuration]
  );

  const alignment = calculateAlignment(text, cumulativeTimestamps, totalDuration);

  return {
    audioBuffer: mergedBuffer,
    totalDuration,
    alignment,
    source: 'gnani',
  };
}

export async function synthesizeText(text, language, voice, speed = 1.0) {
  const provider = process.env.TTS_PROVIDER || 'gtts';

  if (provider === 'gnani' && process.env.GNANI_API_KEY_ID) {
    return await synthesizeWithGnani(text, language, voice, speed);
  }

  return await synthesizeWithGtts(text, language, voice, speed);
}