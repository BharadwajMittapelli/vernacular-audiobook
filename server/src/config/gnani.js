import axios from 'axios';

const GNANI_API_URL = 'https://api.vachana.ai/api/v1/tts/inference';
const GNANI_API_KEY = process.env.GNANI_API_KEY_ID;

if (!GNANI_API_KEY) {
  throw new Error('Missing GNANI_API_KEY_ID environment variable');
}

export async function synthesizeSpeech(request) {
  try {
    const response = await axios.post(GNANI_API_URL, request, {
      headers: {
        'X-API-Key-ID': GNANI_API_KEY,
        'Content-Type': 'application/json',
      },
      responseType: 'json',
      timeout: 30000,
    });
    
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`Gnani API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Gnani API request failed: ${error.message}`);
  }
}

export async function synthesizeSpeechChunks(chunks, language, voice, speed) {
  const audioBuffers = [];
  const allTimestamps = [];
  let totalDuration = 0;
  let timeOffset = 0;

  for (const chunk of chunks) {
    const result = await synthesizeSpeech({
      text: chunk,
      language,
      voice,
      speed,
    });

    const audioBuffer = Buffer.from(result.audio_base64, 'base64');
    audioBuffers.push(audioBuffer);
    totalDuration += result.duration;

    const adjustedTimestamps = result.timestamps.map(ts => ({
      ...ts,
      start: ts.start + timeOffset,
      end: ts.end + timeOffset,
    }));
    allTimestamps.push(...adjustedTimestamps);
    timeOffset += result.duration;
  }

  return { audioBuffers, allTimestamps, totalDuration };
}