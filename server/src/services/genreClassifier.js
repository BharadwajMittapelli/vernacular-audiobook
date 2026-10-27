import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
);

const MODEL = 'gemini-1.5-flash';

export async function classifyBookGenre(sampleText) {
  if (!sampleText || typeof sampleText !== 'string' || !sampleText.trim()) {
    return 'General Narrative';
  }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `
      Analyze this opening text of a book and classify its atmospheric genre into ONE short, punchy category (e.g., "Noir Thriller", "Indian Folklore", "Sci-Fi Cyberpunk", "Historical Drama", "Cozy Mystery").
      Return a strict JSON object: { "genre": "..." }

      Text sample:
      "${sampleText.slice(0, 1000)}"
    `.trim();

    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());
    return data.genre || 'General Narrative';
  } catch (err) {
    console.warn('[Genre Classifier] Failed, defaulting:', err.message);
    return 'General Narrative';
  }
}
