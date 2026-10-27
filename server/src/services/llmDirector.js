import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
);

const MODEL = 'gemini-1.5-flash';

export async function generateSpatialScript(chapterText, audioProfile = 'General Narrative') {
  if (!chapterText || typeof chapterText !== 'string' || !chapterText.trim()) {
    throw new Error('chapterText must be a non-empty string');
  }

  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: 'application/json' },
  });

  const prompt = `
You are an AI Audio Director for an immersive 3D audiobook studio.
The overarching book genre/vibe is: "${audioProfile}".

Analyze the following text and break it down into a 3-track spatial audio script that heavily reflects this atmospheric profile.

Return a strict JSON object with this exact structure:
{
  "main": {
    "text": "The core narrator text, cleaned up for smooth narration.",
    "voice": "Pranav",
    "language": "en-IN"
  },
  "sidekick": {
    "text": "A short 2-3 word whispered inner thought or character reaction fitting the genre, or empty string if none fits.",
    "voice": "Kaveri",
    "language": "en-IN"
  },
  "ambient": {
    "text": "A short phonetic string representing background noise matching the genre (e.g. 'shhhhh click click whoosh'), or empty string if none fits.",
    "voice": "Deepak",
    "language": "hi-IN"
  }
}

Rules:
- main.text should be the full chapter text cleaned of markdown but otherwise intact
- sidekick.text should be a short reaction (2-3 words max) or "" if nothing fits naturally
- ambient.text should be phonetic background sounds matching the genre or "" if none fit
- Return ONLY valid JSON, no markdown, no explanation

Text to analyze:
${chapterText}
`.trim();

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  return JSON.parse(responseText);
}
