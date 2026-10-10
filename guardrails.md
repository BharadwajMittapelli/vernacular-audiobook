# 8. AI Guardrails & Rule File

**Text Processing Strict Directives:**  
1. **Chunking Hard Limit:** Gnani fails on massive payloads. The backend MUST split text at punctuation marks into chunks strictly < 400 characters.  
2. **Markdown Stripping:** The processor must run a regex strip (`text.replace(/[#*`_\[\]]/g, '')`) before transmission to prevent the AI from reading literal asterisks or code formatting.  
3. **Code-Switching Context:** For `en-IN` (Hinglish), the text parser should rely on the Gnani Timbre model's inherent phonetic processing. Do not inject SSML phonemes manually unless testing proves a consistent failure.  
4. **Alignment Drift Mitigation:** If Gnani returns audio shorter than calculated by the heuristics, the backend must normalize the `endTime` of the final sentence to match the true buffer duration so the UI doesn't lock up.  
5. **Terminal Seek Behavior:** If `currentTime > lastSentence.endTime`, clamp to `lastSentence.endTime` and pause.

**Precedence Rules (when docs conflict):**  
* `security.md` > `README.md`  
* `api.md` > `TechnicalDocument.md`  
* `guardrails.md` > all implementation docs