  
\#. SYSTEM ARCHITECTURE & FILE TREE

\`\`\`text  
vernacular-audiobook/  
├── .kilocode/  
│   └── rules                     \# This master rule file  
├── client/                        \# DEV A SCOPE  
│   ├── src/  
│   │   ├── components/  
│   │   │   ├── studio/  
│   │   │   │   ├── AudioConfigModal.jsx       \# Voice/Language controls  
│   │   │   │   └── CreditEstimateBadge.jsx    \# Real-time credit counter  
│   │   │   ├── player/  
│   │   │   │   ├── ReadAlongPlayer.jsx        \# Main synced player  
│   │   │   │   ├── TranscriptHighlighter.jsx  \# Sentence sync renderer  
│   │   │   │   └── PlaybackControls.jsx       \# Play/Pause/Speed toggles  
│   │   │   └── storefront/  
│   │   │       └── AudioStorefrontWidget.jsx  \# Embedded storefront widget  
│   │   ├── hooks/  
│   │   │   └── useAudioPlayer.js              \# Web Audio API state hook  
│   │   ├── services/  
│   │   │   └── api.js                         \# Axios/Fetch client  
│   │   ├── App.jsx  
│   │   └── main.jsx  
│   └── package.json  
└── server/                        \# DEV B SCOPE  
    ├── src/  
    │   ├── config/  
    │   │   ├── gnani.js          \# Gnani API credentials & endpoints  
    │   │   └── supabase.js       \# Supabase client setup  
    │   ├── services/  
    │   │   ├── gnaniService.js   \# Timbre v2.5 wrapper  
    │   │   ├── textProcessor.js  \# Markdown cleaner & sentence splitter  
    │   │   └── storageService.js \# Supabase bucket upload handler  
    │   ├── routes/  
    │   │   └── audioRoutes.js    \# Express route handlers  
    │   └── index.js  
    └── package.json  
