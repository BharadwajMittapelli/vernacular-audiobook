\# 2\. Technical Document

\*\*Architecture Pattern:\*\* Decoupled Client-Server Monorepo.

\*\*Infrastructure (Zero-Cost Hackathon Stack):\*\*  
\* \*\*Client:\*\* React 18, Vite, deployed on Vercel Edge.  
\* \*\*Server:\*\* Node.js 18+, Express.js, deployed on Render (Web Service).  
\* \*\*Database & Storage:\*\* Supabase Free Tier (PostgreSQL \+ S3-compatible Blob Storage).  
\* \*\*AI Engine:\*\* Gnani.ai REST/WebSocket API.

\*\*System Boundaries:\*\*  
\* \`/client\` handles state, UI rendering, Web Audio API playback, and sync calculation logic.  
\* \`/server\` handles secret management, rate limiting, Supabase I/O, and Gnani network requests.  
\* \*Strict Rule:\* The frontend never calls Gnani or Supabase directly. All operations route through the \`/server\` API.

\*\*Data Flow:\*\*  
Text Input \-\> Express API \-\> Text Sanitization & Chunking \-\> Gnani.ai API \-\> Audio Buffer \-\> Supabase Storage \-\> Express returns Public URL & Timestamps \-\> React Player.  
