\# 7\. Security & Access Document

\*\*Threat Models & Mitigations:\*\*  
1\. \*\*API Key Leakage:\*\* Gnani.ai and Supabase Service Role keys MUST remain in \`/server/.env\`. The Vite frontend is prohibited from holding these keys.  
2\. \*\*Wallet Draining (DDoS):\*\* Prevent malicious users from spamming the TTS endpoint.   
   \* \*Implementation:\* Apply \`express-rate-limit\` (Max 5 requests/min per IP).  
3\. \*\*Credit Bypassing:\*\* The credit deduction logic must be atomic: Calculate chars \-\> check balance \-\> deduct balance \-\> call Gnani.  
4\. \*\*CORS:\*\* Express server must restrict \`Access-Control-Allow-Origin\` strictly to the deployed Vercel frontend URL.

\*\*Error Boundaries:\*\*  
\* Gnani 5xx errors must return HTTP 502 (Bad Gateway) to the client. Do not crash the Node process.  
\* Frontend must wrap \`ReadAlongPlayer\` in a React Error Boundary to prevent white-screens if timestamp parsing fails.  
