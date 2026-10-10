# 10. Deployment & Testing Documents

**Deployment Architecture:**  
* **Backend (Render):** Connect GitHub repo -> Select `/server` -> Build command: `npm run build` -> Start command: `node dist/index.js`. Add ENV variables to Render dashboard.  
* **Frontend (Vercel):** Connect GitHub repo -> Select `/client` -> Preset: Vite. Add `VITE_API_URL` pointing to Render endpoint.

**Testing Protocol (Validation Gates — must pass before merge):**  

| Gate | Command / Check | Pass Criteria |
|------|-----------------|---------------|
| **4.1 Lint & Typecheck** | `npm run lint && npm run typecheck` (both workspaces) | Zero errors |
| **4.2 Unit Test: textProcessor** | `npm test -- textProcessor` | Strips markdown; all chunks < 400 chars |
| **4.3 Integration Test: synthesize** | `POST /api/audio/synthesize` with 500-word payload | HTTP 200; valid Supabase URL; `alignment.length === sentenceCount`; `alignment[last].endTime === durationSeconds ± 0.1s` |
| **4.4 UI Test: highlight sync** | Playwright: click sentence N -> `audio.currentTime` within ±100ms of `alignment[N].startTime` | All 10 random sentences pass |
| **4.5 Idempotency Test** | Same `Idempotency-Key` POST twice to `/api/audio/synthesize` | Second response = first response (no double charge, no double audio) |
| **4.6 Credit Atomicity Test** | Concurrent 5 requests from same user with 4 credits | Exactly 4 succeed, 1 returns 402; final balance = 0 |

**Legacy Quick Checks (for local dev):**  
1. **Unit Test (Backend):** Pass markdown with bold tags to `textProcessor.ts`. Assert output is clean and length < 400 chars.  
2. **Integration Test (API):** POST a 500-word payload to `/api/audio/synthesize`. Assert HTTP 200 and valid URL.  
3. **UI/UX Test (Frontend):**   
   * Verify clicking a sentence updates `audio.currentTime`.  
   * Verify pausing audio halts the text highlighter immediately.