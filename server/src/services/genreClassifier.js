import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = process.env.GROQ_CLASSIFIER_MODEL || 'qwen/qwen3.8-27b';

export async function classifyBookGenre(sampleText) {
  if (!sampleText || typeof sampleText !== 'string' || !sampleText.trim()) {
    return 'General Narrative';
  }

  try {
    const prompt = `
      Analyze this opening text of a book and classify its atmospheric genre into ONE short, punchy category (e.g., "Noir Thriller", "Indian Folklore", "Sci-Fi Cyberpunk", "Historical Drama", "Cozy Mystery").
      Return a strict JSON object with a single key "genre": {"genre": "..."}

      Text sample:
      "${sampleText.slice(0, 1000)}"
    `.trim();

    const completion = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 64,
      messages: [{ role: 'user', content: prompt }],
    });

    const data = JSON.parse(completion.choices[0].message.content);
    return data.genre || 'General Narrative';
  } catch (err) {
    console.warn('[Genre Classifier] Failed, defaulting:', err.message);
    return 'General Narrative';
  }
}
