\# 6\. API Integrations & Specifications

\*\*External Integration: Gnani.ai Timbre v2.5\*\*  
\* \*\*Endpoint:\*\* \`POST https\://api.vachana.ai/api/v1/tts/inference\`  
\* \*\*Headers:\*\* \`X-API-Key-ID: \<GNANI\_KEY\>\`, \`Content-Type: application/json\`  
\* \*\*Payload Constraints:\*\* Maximum 500 characters per request. (Express must chunk longer texts).

\*\*Internal API: /api/audio/synthesize\*\*  
\* \*\*Method:\*\* \`POST\`  
\* \*\*Request Payload:\*\*   
  \`{ chapterId, text, language, voiceProfile, speed }\`  
\* \*\*Response Payload:\*\*   
  \`{ success, audioUrl, durationSeconds, alignment: \[{ sentenceIndex, text, startTime, endTime }\] }\`

\* \*\*Strict Rule:\*\* This schema is immutable. The frontend must rely entirely on the \`alignment\` array to render UI highlights. Do not calculate UI timestamps on the client.  
