const CHUNK_MAX_CHARS = 400;

const INDIC_LANG_CODES = ['hi', 'te', 'ta', 'kn', 'ml', 'mr', 'pa', 'bn', 'gu'];

const GNANI_LOCALE_TO_ISO = {
  'hi-IN': 'hi',
  'te-IN': 'te',
  'ta-IN': 'ta',
  'kn-IN': 'kn',
  'ml-IN': 'ml',
  'mr-IN': 'mr',
  'bn-IN': 'bn',
  'gu-IN': 'gu',
  'pa-IN': 'pa',
};

const GOOGLE_MAX_CHARS = 1500;
const MYMEMORY_MAX_CHARS = 480;
const SENTENCE_SPLITTER = /(?<=[.!?।])\s*/;

export function stripMarkdown(text) {
  return text.replace(/[#*`_\[\]]/g, '');
}

export async function translateToIndic(text, targetLangCode) {
  if (!targetLangCode || targetLangCode === 'en-IN') return text;

  const isoCode = GNANI_LOCALE_TO_ISO[targetLangCode];
  if (!isoCode || !INDIC_LANG_CODES.includes(isoCode)) return text;

  if (!text || text.trim().length === 0) return text;

  // Translate paragraph-by-paragraph and rejoin with '\n\n'. Translators
  // collapse whitespace between chunks, so without this the paragraph
  // structure feeding architectural spacing downstream would be destroyed.
  const paragraphs = text.split(/[\r\n]{2,}/).filter((p) => p.trim());
  const translated = [];
  for (const paragraph of paragraphs) {
    translated.push(await convertParagraph(paragraph, isoCode));
  }
  return translated.join('\n\n');
}

async function convertParagraph(text, isoCode) {
  // Short-circuit: if text already contains Indic script, skip translation.
  if (/[\u0900-\u0D7F]/.test(text)) return text;

  const translateWithGoogle = async (chunk) => {
    const mod = await import('@vitalets/google-translate-api');
    const translate = mod.translate;
    const res = await translate(chunk, { from: 'en', to: isoCode });
    return res.text;
  };

  const translateWithMyMemory = async (chunk) => {
    const enc = encodeURIComponent(chunk);
    const url = `https://api.mymemory.translated.net/get?q=${enc}&langpair=en|${isoCode}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
    const json = await res.json();
    if (!json.responseStatus || json.responseStatus !== 200) {
      throw new Error(`MyMemory error: ${json.responseDetails || json.responseStatus}`);
    }
    return json.responseData?.translatedText || chunk;
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Split input at sentence boundaries for manageable request chunks.
  const rawChunks = text.split(SENTENCE_SPLITTER).filter(Boolean);

  // Flatten into size-bounded pieces for Google Translate.
  const googleChunks = [];
  for (const chunk of rawChunks) {
    let remaining = chunk;
    while (remaining.length > GOOGLE_MAX_CHARS) {
      googleChunks.push(remaining.slice(0, GOOGLE_MAX_CHARS));
      remaining = remaining.slice(GOOGLE_MAX_CHARS);
    }
    if (remaining) googleChunks.push(remaining);
  }

  // Flatten into size-bounded pieces for MyMemory.
  const mmChunks = [];
  for (const chunk of rawChunks) {
    let remaining = chunk;
    while (remaining.length > MYMEMORY_MAX_CHARS) {
      mmChunks.push(remaining.slice(0, MYMEMORY_MAX_CHARS));
      remaining = remaining.slice(MYMEMORY_MAX_CHARS);
    }
    if (remaining) mmChunks.push(remaining);
  }

  const retryGoogle = async () => {
    const results = [];
    for (let i = 0; i < googleChunks.length; i++) {
      let lastErr;
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const t = await translateWithGoogle(googleChunks[i]);
          results.push(t);
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < 2) await sleep(1000 * 2 ** attempt);
        }
      }
      if (results.length <= i) {
        throw lastErr;
      }
    }
    return results.join(' ');
  };

  const fallbackMyMemory = async () => {
    const results = [];
    for (let i = 0; i < mmChunks.length; i++) {
      try {
        const t = await translateWithMyMemory(mmChunks[i]);
        results.push(t);
      } catch (err) {
        console.warn(`[translateToIndic] MyMemory chunk ${i} failed, keeping original`, err.message);
        results.push(mmChunks[i]);
      }
    }
    return results.join(' ');
  };

  try {
    return await retryGoogle();
  } catch (err) {
    console.warn('[translateToIndic] Google failed, falling back to MyMemory:', err.message);
    return await fallbackMyMemory();
  }
}

export function chunkText(text) {
  const cleanText = stripMarkdown(text);
  const chunks = [];
  let currentChunk = '';

  const sentences = cleanText.split(SENTENCE_SPLITTER);

  for (const sentence of sentences) {
    if (!sentence.trim()) continue;
    if (currentChunk.length + sentence.length + 1 <= CHUNK_MAX_CHARS) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      if (sentence.length > CHUNK_MAX_CHARS) {
        const words = sentence.split(' ');
        let wordChunk = '';
        for (const word of words) {
          if (wordChunk.length + word.length + 1 <= CHUNK_MAX_CHARS) {
            wordChunk += (wordChunk ? ' ' : '') + word;
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = word;
          }
        }
        if (wordChunk) currentChunk = wordChunk;
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export function calculateCredits(text) {
  const cleanText = stripMarkdown(text);
  return Math.ceil(cleanText.length / 100);
}
