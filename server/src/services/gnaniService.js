import axios from 'axios';

const GNANI_API_URL = 'https://api.vachana.ai/api/v1/tts/inference';
const GNANI_API_KEY = process.env.GNANI_API_KEY_ID;

if (!GNANI_API_KEY) {
  throw new Error('Missing GNANI_API_KEY_ID environment variable');
}

export async function synthesizeSpeech(text, language, voice, speed = 1.0) {
  try {
    const response = await axios.post(
      GNANI_API_URL,
      { text, language, voice, speed },
      {
        headers: {
          'X-API-Key-ID': GNANI_API_KEY,
          'Content-Type': 'application/json',
        },
        responseType: 'json',
        timeout: 30000,
      }
    );

    const data = response.data;
    const audioBuffer = Buffer.from(data.audio_base64, 'base64');

    return {
      audioBuffer,
      duration: data.duration,
      timestamps: data.timestamps || [],
    };
  } catch (error) {
    if (error.response) {
      throw new Error(
        `Gnani API error ${error.response.status}: ${JSON.stringify(error.response.data)}`
      );
    }
    throw new Error(`Gnani API request failed: ${error.message}`);
  }
}

export async function synthesizeChunks(chunks, language, voice, speed = 1.0) {
  const audioBuffers = [];
  const allTimestamps = [];
  let totalDuration = 0;
  let timeOffset = 0;

  for (const chunk of chunks) {
    const result = await synthesizeSpeech(chunk, language, voice, speed);

    audioBuffers.push(result.audioBuffer);
    totalDuration += result.duration;

    const adjustedTimestamps = result.timestamps.map((ts) => ({
      ...ts,
      start: ts.start + timeOffset,
      end: ts.end + timeOffset,
    }));
    allTimestamps.push(...adjustedTimestamps);
    timeOffset += result.duration;
  }

  return { audioBuffers, allTimestamps, totalDuration };
}
