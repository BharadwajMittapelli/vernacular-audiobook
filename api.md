# 6. API Integrations & Specifications

**External Integration: Gnani.ai Timbre v2.5**  
* **Endpoint:** `POST https://api.vachana.ai/api/v1/tts/inference`  
* **Headers:** `X-API-Key-ID: <GNANI_KEY>`, `Content-Type: application/json`  
* **Payload Constraints:** Maximum 500 characters per request. (Express must chunk longer texts).

**Internal API: /api/audio/synthesize**  
* **Method:** `POST`  
* **Request Payload:**   
  `{ chapterId, text, language, voiceProfile }`  
* **Response Payload:**   
  `{ success, audioUrl, durationSeconds, alignment: [{ sentenceIndex, text, startTime, endTime }] }`

* **Strict Rule:** This schema is immutable. The frontend must rely entirely on the `alignment` array to render UI highlights. Do not calculate UI timestamps on the client.  
* **Speed:** Synthesis always runs at 1.0x. Playback speed is controlled client-side via `HTMLAudioElement.playbackRate`.
* **Idempotency:** Require `Idempotency-Key` header (client-generated UUID v4). Duplicate key returns existing record without re-processing.

**Internal API: /api/audio/:chapterId**  
* **Method:** `GET`  
* **Response Payload:**  
  `{ success, audioUrl, durationSeconds, alignment: [{ sentenceIndex, text, startTime, endTime }] }`  
* **Errors:** 404 if chapter not found.

**Internal API: /api/credits**  
* **Method:** `GET`  
* **Headers:** `Authorization: Bearer <eKithab-JWT>`  
* **Response Payload:**  
  `{ balance: number }`