\# 10\. Deployment & Testing Documents

\*\*Deployment Architecture:\*\*  
\* \*\*Backend (Render):\*\* Connect GitHub repo \-\> Select \`/server\` \-\> Build command: \`npm install\` \-\> Start command: \`node src/index.js\`. Add ENV variables to Render dashboard.  
\* \*\*Frontend (Vercel):\*\* Connect GitHub repo \-\> Select \`/client\` \-\> Preset: Vite. Add \`VITE\_API\_URL\` pointing to Render endpoint.

\*\*Testing Protocol:\*\*  
1\. \*\*Unit Test (Backend):\*\* Pass markdown with bold tags to \`textProcessor.js\`. Assert output is clean and length \< 400 chars.  
2\. \*\*Integration Test (API):\*\* POST a 500-word payload to \`/api/audio/synthesize\`. Assert HTTP 200 and valid URL.  
3\. \*\*UI/UX Test (Frontend):\*\*   
   \* Verify clicking a sentence updates \`audio.currentTime\`.  
   \* Verify pausing audio halts the text highlighter immediately.  
