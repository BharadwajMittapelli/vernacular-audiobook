\# 3\. App/Website Flow Document

\*\*Flow 1: Creator Studio (Generation)\*\*  
1\. User opens "Audio Generator" tab on a chapter.  
2\. Selects Language and Voice Persona.  
3\. UI calculates estimated credit cost (1 credit \= 100 characters).  
4\. User clicks "Generate".  
5\. UI displays shimmer loading state.  
6\. Upon success, audio preview renders with a "Publish to Storefront" button.

\*\*Flow 2: Consumer Storefront (Playback)\*\*  
1\. User opens the public eBook page.  
2\. Clicks "Play Audiobook".  
3\. Web Audio API loads the Supabase CDN URL.  
4\. As audio plays, \`currentTime\` triggers state updates.  
5\. Text viewer auto-scrolls and highlights the exact sentence currently being spoken.  
6\. User clicks a paragraph; audio seeks to that exact timestamp.  
