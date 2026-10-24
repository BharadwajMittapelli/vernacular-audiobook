# DEV A — Read-Along Highlighter & Auto-Scroll (reality-corrected)

**Branch:** `master` · **Scope:** `client/src/components/player/TranscriptHighlighter.jsx`, `server/src/services/alignmentCalculator.js`

## Context — the brief's premise is wrong, the real bug is worse
Verified in code:
- `timeupdate` IS hooked (`useAudioPlayer.jsx:28-38`); `currentSentenceIndex` IS derived from `alignment` (`:37`); `TranscriptHighlighter` already highlights the active entry (`:20-47`). Deliverables 1-2 exist.
- Genuinely missing: **auto-scroll** and a **bounded scroll container** for the highlighter.
- **The actual "static text" bug** (both Gnani and gTTS paths): since per-chunk pseudo-timestamps shipped (one `{start,end,word:<entire chunk text>}` per chunk), `calculateAlignment`'s greedy matcher consumes timestamps[0] for sentence 1, runs `timestampIndex` to exhaustion (normalized whole-chunk token never equals a single word), and every later sentence hits the `wordCount===0` fallback pinned to `timestamps[0]`. Result: all entries after sentence 1 share paragraph-1's span → `findIndex(t < endTime)` returns `-1` mid-chapter → highlight freezes, then vanishes.

## User-confirmed decision
Fix **auto-scroll + timestamp interpolation** (server-side interpolation in `alignmentCalculator.js`; schema immutable, stored rows self-heal on re-synthesis).

## Task 1 — Rewrite alignment building: `server/src/services/alignmentCalculator.js`
Replace greedy per-timestamp consumption with **token-stream linear interpolation**. Public signature and output shape `[{sentenceIndex, text, startTime, endTime}]` unchanged.

Algorithm (input: `originalText`, `timestamps` = per-chunk `{start, end, word: chunkText}`, `totalDuration`):
1. Build a token timeline: for each chunk span `[s,e]` with text `W`, tokenize `normalize(W)` into whitespace-separated words; assign token at character offset `c` (into `W`) time `s + (c / max(W.length,1)) * (e - s)`. Keep a flat ordered array `timeline = [{token, time}]` plus running chunk char lengths.
2. `normalize(str) = str.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ' ').split(/\s+/).filter(Boolean)` — Unicode-aware (Indic letters survive; danda/。/punctuation act as separators). Apply identically on both sides.
3. Sentences from existing `splitIntoSentences(originalText)` (already strips `#*_\[]` markdown, splits on `.!?।`).
4. Walk sentences in order with a cursor into `timeline`. For sentence S: tokenize; try to align S's token sequence at the cursor (tolerate up to full resync: search forward ≤ 40 tokens for the first-token match; if found at cursor+j with j>0, skip the j tokens — absorbs drift). `startTime` = time of first matched token, `endTime` = time of last matched token; advance cursor.
5. **Fallback when no match found**: proportional by cumulative character position — `start = prevEnd (or this sentence's estimated start)`, `end = start + (S.length / totalTextLength) * totalDuration` clamped to `totalDuration`. Never regress: enforce `startTime >= previous endTime`.
6. Keep convention: final entry's `endTime = totalDuration`.
7. Edge cases: `timestamps` empty → today's sentence-0 fallback behavior; single-sentence text; chunks whose text duplicates due to markdown-strip divergence are handled by the drift resync in (4).

Rationale vs. naive per-sentence split of a chunk span: token-level linear interpolation is strictly better (handles partial chunks, paragraph-boundary silences land between chunks automatically since gap time isn't inside any span).

## Task 2 — Auto-scroll + bounded container: `client/src/components/player/TranscriptHighlighter.jsx`
1. Wrapper div gains `ref={containerRef}` + `max-h-[60vh] overflow-y-auto scrollbar-thin pr-2` (own scrollport; currently rides the tab workspace scroller). Keep `role="log"`.
2. Track active node: `const activeRef = useRef(null)`; in the map, `ref={(el) => { if (index === currentSentenceIndex) activeRef.current = el }}`.
3. `useEffect(() => { activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [currentSentenceIndex])` — depends on INDEX only (constraint 2: no scroll churn per `timeupdate` ~4×/s).
4. Manual-scroll override: `autoFollow` state (default true). Container `onWheel`/`onTouchStart` → `setAutoFollow(false)`; gate the scroll effect on it; sentence click (`onSeek`) → `setAutoFollow(true)`. When off, render a small sticky "Jump to current" button above the container that re-enables and scrolls.
5. Failsafe (constraint 1) already satisfied: null/empty alignment → "No transcript" branch; `ReadAlongPlayer` priority-3 raw-text fallback untouched. Verify `currentSentenceIndex = -1` (before first token / after end) simply highlights nothing — no crash.

## Task 3 — No-change confirmations (do not edit)
- `useAudioPlayer.jsx` — `findIndex((a) => t < a.endTime)` works once Task 1 produces monotonic, span-covering times. Its end-clamp (`:32-35`) uses last `endTime` = `totalDuration` — fine.
- `ReadAlongPlayer.jsx`, `Dashboard.jsx` wiring — props already flow (`chapter.alignment` → `TranscriptHighlighter`).
- `TranscriptHighlighter` keeps per-sentence `<p>` block lines (Audible-style). Brief's `<span>` + join-spaces is already solved by block layout; do not churn to spans.

## Out of scope / notes
- `AudioStorefrontWidget.jsx` is dead code (never rendered, no `<audio>` element, `getEmbedData` unused) — its fake "Read-Along Enabled" play button is a separate ticket.
- Existing DB generations keep collapsed alignment until re-synthesized; auto-scroll benefit applies immediately.
- Real word timestamps would need a forced-alignment engine — not in scope.

## Validation
1. `node --check server/src/services/alignmentCalculator.js`; scratch node harness (delete after):
   - **Reproduction case**: 2-paragraph text, timestamps = 2 chunk spans → every sentence gets distinct, strictly monotonic times; all within `[0, totalDuration]`; sentence in paragraph 2 starts after its chunk start; no `-1`-producing duplicates (assert `findIndex(t<endTime)` advances for t sampled every 0.25 s across `totalDuration`).
   - Drift case: chunk text with markdown stripped vs original text containing `**bold**` — resync keeps times monotonic.
   - gTTS shape: many small spans, one sentence per chunk — output ≈ today's (regression check).
   - `timestamps=[]` → fallback path doesn't throw.
2. `npm run typecheck` + `npm run build` in `/client`.
3. Manual: generate audio for a multi-paragraph Indic chapter → Read Along tab: highlight advances sentence-by-sentence, container auto-scrolls smoothly, wheel-scroll suspends follow, "Jump to current" resumes, click-to-seek still works.

## Files changed
- `server/src/services/alignmentCalculator.js` (rewrite internals, same exports/signature)
- `client/src/components/player/TranscriptHighlighter.jsx` (container, refs, scroll effect, autoFollow)
