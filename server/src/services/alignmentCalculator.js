const RESYNC_WINDOW = 40;

const TOKEN_PATTERN = /[\p{L}\p{N}']+/gu;

/**
 * Build a chronological token timeline from per-chunk pseudo-timestamps.
 * Each timestamp entry is a synthesis chunk: {start, end, word: <full chunk text>}.
 * Token times are linearly interpolated within the chunk span by character
 * offset, giving sentence-level granularity from chunk-level timestamps.
 * (Gnani's REST TTS returns no real word timestamps — confirmed 2026-10.)
 */
function buildTokenTimeline(timestamps) {
  const timeline = [];
  for (const chunk of timestamps) {
    const text = chunk.word || '';
    const start = chunk.start ?? 0;
    const span = Math.max((chunk.end ?? 0) - start, 0);
    const denom = Math.max(text.length, 1);
    for (const m of text.matchAll(TOKEN_PATTERN)) {
      timeline.push({ token: m[0].toLowerCase(), time: start + (m.index / denom) * span });
    }
  }
  return timeline;
}

function normalizeTokens(str) {
  return Array.from(str.toLowerCase().matchAll(TOKEN_PATTERN), (m) => m[0]);
}

/**
 * Map every sentence of originalText to {startTime, endTime} by walking a
 * token timeline in order. Sentences anchor on their first token and end on
 * their last; unmatched sentences fall back to a proportional-by-character
 * estimate. Times are strictly non-decreasing and clamped to [0, totalDuration].
 *
 * Output shape (DB JSONB + ReadAlongPlayer contract, immutable):
 *   [{ sentenceIndex, text, startTime, endTime }]
 */
export function calculateAlignment(originalText, timestamps, totalDuration) {
  const sentences = splitIntoSentences(originalText);
  if (sentences.length === 0) return [];

  const timeline = buildTokenTimeline(timestamps || []);
  const totalChars = Math.max((originalText || '').length, 1);
  const clamp = (t) => Math.min(Math.max(t, 0), totalDuration);

  const startTimes = new Array(sentences.length);
  const endTimes = new Array(sentences.length);
  let cursor = 0;
  let prevEnd = 0;
  let charsBefore = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const tokens = normalizeTokens(sentence);

    let matchAt = -1;
    if (tokens.length > 0) {
      const searchEnd = Math.min(timeline.length, cursor + RESYNC_WINDOW);
      for (let j = cursor; j < searchEnd; j++) {
        if (timeline[j].token === tokens[0]) {
          matchAt = j;
          break;
        }
      }
    }

    if (matchAt !== -1) {
      const last = Math.min(matchAt + tokens.length - 1, timeline.length - 1);
      startTimes[i] = clamp(Math.max(timeline[matchAt].time, prevEnd));
      endTimes[i] = clamp(Math.max(timeline[last].time, startTimes[i]));
      cursor = last + 1;
    } else {
      // Proportional-by-characters fallback; never regresses, never overshoots.
      const estStart = (charsBefore / totalChars) * totalDuration;
      const estEnd = ((charsBefore + sentence.length) / totalChars) * totalDuration;
      startTimes[i] = clamp(Math.max(estStart, prevEnd));
      endTimes[i] = clamp(Math.max(estEnd, startTimes[i]));
    }

    prevEnd = endTimes[i];
    charsBefore += sentence.length;
  }

  if (endTimes.length > 0) {
    endTimes[endTimes.length - 1] = totalDuration;
  }

  return sentences.map((sentence, i) => ({
    sentenceIndex: i,
    text: sentence.trim(),
    startTime: startTimes[i],
    endTime: endTimes[i],
  }));
}

function splitIntoSentences(text) {
  return text
    .replace(/[#*`_\[\]]/g, '')
    .split(/(?<=[.!?।])\s+/)
    .filter((s) => s.trim().length > 0);
}
