import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = process.env.GROQ_NORMALIZER_MODEL || 'qwen/qwen3.8-27b';

const CHUNK_SOFT_LIMIT = 3500;
const CHUNK_MAX = 4000;

const INDIC_CODES = ['hi-IN', 'te-IN', 'ta-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'bn-IN', 'gu-IN', 'pa-IN'];
const INDIC_RE = /[\u0900-\u0D7F]/;
const PARAGRAPH_SPLIT = /\n{2,}/;
const SENTENCE_SPLIT = /(?<=[.!?।])\s+/g;

export function needsNormalization(language, text) {
  if (!INDIC_CODES.includes(language)) return false;
  if (!text || INDIC_RE.test(text)) return false;
  return true;
}

export function buildChunks(text, softLimit = CHUNK_SOFT_LIMIT, maxLimit = CHUNK_MAX) {
  const units = [];
  const paragraphs = text.split(PARAGRAPH_SPLIT).filter((p) => p.trim());
  for (const paragraph of paragraphs) {
    if (paragraph.length <= softLimit) {
      units.push(paragraph);
      continue;
    }
    let sentenceStart = 0;
    for (const match of paragraph.matchAll(SENTENCE_SPLIT)) {
      const piece = paragraph.slice(sentenceStart, match.index).trim();
      if (piece) units.push(piece);
      sentenceStart = match.index + match[0].length;
    }
    const tail = paragraph.slice(sentenceStart).trim();
    if (tail) units.push(tail);
  }

  const chunks = [];
  let current = '';
  for (const unit of units) {
    const joined = current ? `${current}\n\n${unit}` : unit;
    if (joined.length > maxLimit && current) {
      chunks.push(current);
      current = unit;
    } else {
      current = joined;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function extractJson(content) {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Groq returned an empty completion');
  }
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Groq normalizer returned invalid JSON');
  }
}

export async function normalizeTranscript(rawText, targetVoiceLanguage = 'en-IN') {
  const source = (rawText || '').replace(/\uFEFF/g, '').trim();
  if (!source) throw new Error('rawText must be a non-empty string');

  const systemInstruction = `
    You are a linguistic expert preparing a script for a TTS voice actor.
    The target TTS language code is: ${targetVoiceLanguage}.

    YOUR RULES:
    1. CLEAN: Remove all PDF artifacts, page numbers, and formatting errors.
    2. TRANSLATE THE NARRATIVE: Translate the core sentence structure, verbs, and adjectives into the target language so it flows profoundly and naturally.
    3. PRESERVE LOANWORDS (TRANSLITERATION): Do NOT translate modern English loanwords (e.g., "hospital", "phone", "train", "school", "bank"). You must preserve them as English words, BUT you must write them in the target language's native script. 
       - Example (Hindi hi-IN target): "He went to the hospital" -> "वह हॉसपिटल गयाने."
       - Example (Telugu te-IN target): "He went to the hospital" -> "అతను హాస్పిటల్ కి వెళ్ళాడు."
    
    You must return a strict JSON object with two keys:
    1. "normalized_text": The final translated script with preserved, transliterated loanwords.
    2. "preserved_words": A key-value dictionary mapping the English loanwords you preserved to their native script equivalents (e.g., {"hospital": "హాస్పిటల్", "phone": "ఫోన్"}). If none, return {}.

    Do not include markdown formatting outside the JSON object.
  `;

  let completeText = '';
  const preservedWords = {};

  for (const chunk of buildChunks(source)) {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: chunk },
      ],
      model: MODEL,
      temperature: 0.2,
      max_tokens: 16000,
      response_format: { type: 'json_object' },
    });

    const parsed = extractJson(completion.choices[0]?.message?.content);
    if (typeof parsed.normalized_text !== 'string' || !parsed.normalized_text.trim()) {
      throw new Error('Groq normalizer response missing normalized_text');
    }
    completeText = completeText ? `${completeText}\n\n${parsed.normalized_text.trim()}` : parsed.normalized_text.trim();
    Object.assign(preservedWords, parsed.preserved_words && typeof parsed.preserved_words === 'object' ? parsed.preserved_words : {});
  }

  return { normalized_text: completeText, preserved_words: preservedWords };
}
