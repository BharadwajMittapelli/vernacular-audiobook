#. SYSTEM ARCHITECTURE & FILE TREE

```text  
ekithab-audio-pipeline/  
├── .kilo/  
│   └── rules                     # Master rule file  
├── client/                        # DEV A SCOPE  
│   ├── src/  
│   │   ├── components/  
│   │   │   ├── studio/  
│   │   │   │   ├── AudioConfigModal.tsx       # Voice/Language controls  
│   │   │   │   └── CreditEstimateBadge.tsx    # Real-time credit counter  
│   │   │   ├── player/  
│   │   │   │   ├── ReadAlongPlayer.tsx           # Main synced player (consumes server alignment[])  
│   │   │   │   ├── TranscriptHighlighter.tsx     # Sentence sync renderer  
│   │   │   │   ├── PlaybackControls.tsx          # Play/Pause/Speed (playbackRate) toggles  
│   │   │   │   └── ReadAlongPlayerErrorBoundary.tsx # Catches timestamp parse errors  
│   │   │   └── storefront/  
│   │   │       └── AudioStorefrontWidget.tsx  # Embedded storefront widget  
│   │   ├── hooks/  
│   │   │   └── useAudioPlayer.ts              # HTMLAudioElement state hook + server alignment sync  
│   │   ├── services/  
│   │   │   └── api.ts                         # Axios/Fetch client (synthesize, fetchAudio, fetchCredits)  
│   │   ├── App.tsx  
│   │   └── main.tsx  
│   └── package.json  
└── server/                        # DEV B SCOPE  
    ├── src/  
    │   ├── config/  
    │   │   ├── gnani.ts          # Gnani API credentials & endpoints  
    │   │   └── supabase.ts       # Supabase client setup  
    │   ├── services/  
    │   │   ├── gnaniService.ts   # Timbre v2.5 wrapper  
    │   │   ├── textProcessor.ts  # Markdown cleaner & sentence splitter  
    │   │   ├── storageService.ts # Supabase bucket upload handler  
    │   │   ├── audioStitcher.ts  # Concatenate chunk buffers + cumulative timestamps  
    │   │   └── alignmentCalculator.ts # Build immutable alignment[] from chunks  
    │   ├── middleware/  
    │   │   ├── auth.ts           # Verify eKithab JWT  
    │   │   └── creditGuard.ts    # Atomic credit deduction  
    │   ├── routes/  
    │   │   └── audioRoutes.ts    # Express route handlers  
    │   └── index.ts  
    └── package.json  
```