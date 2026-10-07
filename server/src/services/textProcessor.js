const CHUNK_MAX_CHARS = 400;

export function stripMarkdown(text) {
  return text.replace(/[#*`_\[\]]/g, '');
}

export function chunkText(text) {
  const cleanText = stripMarkdown(text);
  const chunks = [];
  let currentChunk = '';
  
  const sentences = cleanText.split(/(?<=[.!?])\s+/);
  
  for (const sentence of sentences) {
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