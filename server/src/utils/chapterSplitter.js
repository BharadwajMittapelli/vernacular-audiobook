const MAX_CHUNK = 5000;
const HEADER = /^(#{1,6}\s|chapter\s+\d+)/i;

function chunkFallback(text) {
  const out = [];
  let rest = text;
  let n = 1;
  while (rest.length > MAX_CHUNK) {
    const cut = rest.lastIndexOf('\n\n', MAX_CHUNK);
    const end = cut > MAX_CHUNK / 2 ? cut : MAX_CHUNK;
    out.push({ chapterId: crypto.randomUUID(), title: `Chapter ${n++}`, text: rest.slice(0, end) });
    rest = rest.slice(end).replace(/^\n+/, '');
  }
  if (rest.trim()) out.push({ chapterId: crypto.randomUUID(), title: `Chapter ${n++}`, text: rest });
  return out;
}

export function splitTextIntoChapters(text) {
  const clean = (text || '').replace(/\r\n/g, '\n').replace(/^\uFEFF/, '').trim();
  if (!clean) return [];
  if (!/(^|\n)(#{1,6}\s|chapter\s+\d+)/i.test(clean)) return chunkFallback(clean);

  return clean
    .split(/\n(?=#{1,6}\s|chapter\s+\d+)/i)
    .map((p) => p.trim())
    // header sections always kept; leading front matter only if it carries real text
    .filter((p) => HEADER.test(p) || p.length > 100)
    .map((p, i) => ({
      chapterId: crypto.randomUUID(),
      title: HEADER.test(p)
        ? p.split('\n', 1)[0].replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '').trim() || `Chapter ${i + 1}`
        : 'Front Matter',
      text: p,
    }));
}
