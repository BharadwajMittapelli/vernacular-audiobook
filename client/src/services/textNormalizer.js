/**
 * Strip OCR artifacts from uploaded book text while strictly preserving
 * paragraph breaks (\n\n). The backend's paragraph-spacing architecture
 * (audioStitcher.js silence injection) depends on \n\n surviving intact —
 * never collapse two consecutive newlines into a space.
 *
 * Order is load-bearing: de-hyphenation must run BEFORE newline collapsing,
 * otherwise "com-\nputer" would become "com- puter" instead of "computer".
 *
 * De-hyphenation is [A-Za-z]-only by design (OCR line-break hyphenation is a
 * Latin-typesetting artifact); Indic scripts do not hyphenate across lines.
 *
 * @param {string} text
 * @returns {string} idempotent cleaned text (safe to apply repeatedly)
 */
export function cleanOcrText(text) {
  if (!text) return '';
  let out = text.replace(/\r\n/g, '\n');
  out = out.replace(/([A-Za-z]+)-\n(?=[A-Za-z])/g, '$1');
  out = out.replace(/(?<!\n)\n(?!\n)/g, ' ');
  out = out.replace(/[ \t]{2,}/g, ' ');
  out = out.replace(/[ \t]+\n/g, '\n');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}
