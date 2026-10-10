# 7. Security & Access Document

**Threat Models & Mitigations:**  
1. **API Key Leakage:** Gnani.ai and Supabase Service Role keys MUST remain in `/server/.env`. The Vite frontend is prohibited from holding these keys.  
2. **Wallet Draining (DDoS):** Prevent malicious users from spamming the TTS endpoint.   
   * *Implementation:* Apply `express-rate-limit` (Max 5 requests/min per IP).  
3. **Credit Bypassing:** The credit deduction must be atomic in a single SQL statement:  
   ```sql
   UPDATE users 
   SET credits = credits - $cost 
   WHERE id = $uid AND credits >= $cost 
   RETURNING credits;
   ```
   If row count = 0, reject with HTTP 402. No separate check-then-deduct.  
4. **CORS:** Express server must restrict `Access-Control-Allow-Origin` strictly to the deployed Vercel frontend URL.  
5. **Auth:** Every `/api/audio/*` request requires `Authorization: Bearer <eKithab-JWT>`. Middleware verifies signature and attaches `req.user.id`.  
6. **Idempotency:** `POST /api/audio/synthesize` requires `Idempotency-Key` header. Duplicate keys return existing `audio_generations` row (status check) without re-processing.

**Error Boundaries:**  
* Gnani 5xx errors must return HTTP 502 (Bad Gateway) to the client. Do not crash the Node process.  
* Frontend must wrap `ReadAlongPlayer` in a React Error Boundary to prevent white-screens if timestamp parsing fails.