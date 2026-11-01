import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = process.env.GROQ_DIRECTOR_MODEL || 'qwen/qwen3.8-27b';

const SSML_ALLOWED_TAGS = /(?:<\/?(?:speak|break|prosody|emphasis)(?:\s[^>]*)?\/?>)/gi;
const SSML_STRIP_REGEX = /<[^>]*>/g;

export async function generateSpatialScript(chapterText, audioProfile = 'General Narrative') {
  if (!chapterText || typeof chapterText !== 'string' || !chapterText.trim()) {
    throw new Error('chapterText must be a non-empty string');
  }

  const prompt = `
You are an AI Audio Director for an immersive 3D spatial audiobook studio.
The overarching book genre/vibe is: "${audioProfile}".

Analyze the following text and break it down into a 3-track spatial audio script that heavily reflects this atmospheric profile.

Output ONLY valid JSON. No markdown, no explanation.

Return strict JSON with this exact structure:
{
  "main": {
    "text": "Core narrative SSML with <speak>, <break time='Xms'>, <prosody rate='...' pitch='...'>, <emphasis level='...'> tags for natural pacing and emotion",
    "voice": "Pranav",
    "language": "en-IN"
  },
  "sidekick": {
    "text": "2-3 word whispered reaction SSML, genre-appropriate, or '' if none fits. Wrap in <speak>. Use <emphasis> for urgency based on genre.",
    "voice": "Kaveri",
    "language": "en-IN"
  },
  "ambient": {
    "text": "Phonetic sound string wrapped in <speak> (e.g., <speak>shhhhh click click whoosh</speak>), or '' if none fits.",
    "voice": "Deepak",
    "language": "hi-IN"
  }
}

Rules:
- main.text: Wrap the cleaned chapter text in <speak>. Insert <break time='Xms'> for natural breaths (300-500ms between sentences, 800-1000ms between paragraphs). Use <prosody pitch='...' rate='...'> for emotional shifts. NEVER escape SSML.
- sidekick.text: 2-3 words max. Wrap in <speak>. Add <emphasis level='strong'> for urgency. Empty string '' if no natural reaction.
- ambient.text: Phonetic rumble/ambient sounds wrapped in <speak> (shhhhh, click, whoosh, etc.). Empty string '' if none.
- voice and language fields MUST match exactly: Pranav/en-IN, Kaveri/en-IN, Deepak/hi-IN.
- Return ONLY valid JSON, no markdown, no explanation.

Text to analyze:
${chapterText}
`.trim();

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 16000,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (err) {
    console.error('[llmDirector] Groq API failed:', err.message);
    return {
      main: {
        text: `<speak>${chapterText}</speak>`,
        voice: 'Pranav',
        language: 'en-IN',
      },
    };
  }
}
