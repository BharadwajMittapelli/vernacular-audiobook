import crypto from 'node:crypto';

const MAX_CHUNK = 5000;
const HEADER = /^(#{1,6}\s|chapter\s+\d+)/i;

// Fallback for crypto.randomUUID (available globally in Node 16.7+, but not in all environments)
const randomUUID = crypto.randomUUID ?? (() => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = (Math.random() * 16) | 0;
  return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
}));

function chunkFallback(text) {
  const out = [];
  let rest = text;
  let n = 1;
  while (rest.length > MAX_CHUNK) {
    const cut = rest.lastIndexOf('\n\n', MAX_CHUNK);
    const end = cut > MAX_CHUNK / 2 ? cut : MAX_CHUNK;
    out.push({ chapterId: randomUUID(), title: `Chapter ${n++}`, text: rest.slice(0, end) });
    rest = rest.slice(end).replace(/^\n+/, '');
  }
  if (rest.trim()) out.push({ chapterId: randomUUID(), title: `Chapter ${n++}`, text: rest });
  return out;
}

export function splitTextIntoChapters(text) {
  try {
    const clean = (text || '').replace(/\r\n/g, '\n').replace(/^\uFEFF/, '').trim();
    if (!clean) return [];
    if (!/(^|\n)(#{1,6}\s|chapter\s+\d+)/i.test(clean)) return chunkFallback(clean);

    return clean
      .split(/\n(?=#{1,6}\s|chapter\s+\d+)/i)
      .map((p) => p.trim())
      // header sections always kept; leading front matter only if it carries real text
      .filter((p) => HEADER.test(p) || p.length > 100)
      .map((p, i) => ({
        chapterId: randomUUID(),
        title: HEADER.test(p)
          ? p.split('\n', 1)[0].replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '').trim() || `Chapter ${i + 1}`
          : 'Front Matter',
        text: p,
      }));
  } catch (e) {
    console.error('[chapterSplitter] failed:', e.stack || e);
    throw new Error(`Chapter split failed: ${e.message}`);
  }
}