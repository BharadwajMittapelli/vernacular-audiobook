# Ekithab AI Landing Page — ElevenLabs Reference-Match (Rev 2)

**Branch:** `master`
**Scope:** New file `client/src/pages/LandingPage.jsx`; modify `client/src/App.jsx` only.
**Status note:** The Rev 1 plan was never implemented — `LandingPage.jsx` does not exist and `App.jsx` is unmodified. This is the single authoritative plan; the Rev 2 section structure **replaces** the old 3-card bento grid entirely.

## Goal
Public, scrollable landing page at `/` strictly matching `Gemini_Generated_Image_om4iqeom4iqeom4i.png`: cream background, serif (Lora) headings, terracotta accents, dark UI mockups, 8-section layout. Static UI only — no data fetching, no forms, no new dependencies.

## Existing tokens (reuse, do not redefine)
- `bg-background` (#FAF9F6), `text-foreground` (#252438), `text-muted-foreground`, `border-border`, `bg-muted` — `client/src/index.css`.
- `bg-terracotta` / `text-terracotta` / `text-terracotta-foreground` (`--terracotta: 19 40% 52%`).
- `.font-serif` → Lora (Google Fonts already imported). Tailwind v4 via `@config "../tailwind.config.js"`.
- `lucide-react` ^0.294 available. Custom routing via `useNavigate()` from `client/src/context/NavigateContext.jsx` (pushState, no router lib).

## Confirmed decisions
- `/` always renders the landing page (logged-in and logged-out). Auth-guard redirects in `App.jsx` exempt `/`.
- CTAs ("Start Creating Free", "Upload a Book", "Upload Your Document") → `navigate('/my-books')`; the existing guard sends logged-out users onward to `/login`.
- Nav "Voice Library" smooth-scrolls to `#voices`; "Browse Voice Library" link → `navigate('/audio-library')` (auth-protected route).
- "Features" → `#production`, "Publisher Program" → `#publishing`, "Pricing" → visual stub (no section, no navigation).
- Nav right side: **only** "Start Creating Free" (per new reference; "Sign In" ghost button dropped).
- Hero player voice tag: **"Kaveri - Warm, Storyteller (Hindi)"** (replaces Rev 1's "George").
- "Watch Demo" = visual stub (outline button with `Play` icon, no-op).
- Dark band color: use theme `bg-foreground` (#252438 navy) with cream text (`text-background`); no new CSS variables.
- Social icons: lucide has no X/Facebook/YouTube brand set in 0.294 — use `Twitter` (aria-label "X"), `Facebook`, `Youtube`.

## Task 1 — `client/src/App.jsx`
1. `import LandingPage from './pages/LandingPage.jsx';`
2. Auth-guard `useEffect` (lines 32–43):
   - Authenticated branch: `if (session && !hasBookId && (path === '/login' || path === '/register')) navigate('/my-books');` (drop `path === '/'`).
   - Login-wall branch: `else if (!session && path !== '/login' && path !== '/register' && path !== '/') navigate('/login');`
   - Update the comment block above it accordingly.
3. `switch (path)`: add `case '/':` → `<NavigateContext.Provider value={navigate}><LandingPage /></NavigateContext.Provider>`; `default:` stays Dashboard.
4. Leave `/listen/*`, loading spinner, other cases untouched.

## Task 2 — `client/src/pages/LandingPage.jsx` (new file, default export)
Root: `<div className="min-h-screen bg-background font-sans text-foreground">`. `const navigate = useNavigate();`. Small helper `scrollToId(id)` using `document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })`; every anchor target gets `scroll-mt-24` (sticky nav offset). Section rhythm: `py-20 md:py-24`, content wrappers `max-w-6xl mx-auto px-6`. All mockup cards: `rounded-2xl border border-border bg-muted/30 shadow-sm`.

### 2.1 Sticky nav
`sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border`, `max-w-6xl mx-auto px-6 h-16 flex items-center justify-between`.
- Left: `BookOpen` (`text-terracotta`) + "Ekithab AI" `font-serif text-lg`.
- Center (`hidden md:flex gap-8 text-sm`): Features, Voice Library, Publisher Program (scroll helpers), Pricing (stub `<a>` no-op).
- Right: "Start Creating Free" — `bg-terracotta text-terracotta-foreground rounded-full px-4 py-2 text-sm` → `/my-books`.

### 2.2 Hero (centered)
- `h1` `font-serif tracking-tight text-5xl md:text-6xl max-w-3xl mx-auto`: "Create studio-quality audiobooks in days, not months."
- Subtitle `text-muted-foreground text-lg max-w-2xl mx-auto`: "Transform your manuscripts into immersive audio experiences with lifelike Indic and global AI voices, synchronized text-to-speech, and global distribution."
- Button row: "Upload a Book" (solid terracotta → `/my-books`) + "Watch Demo" (outline `border-border bg-background` + `Play` icon).
- Caption `text-xs text-muted-foreground`: "Supported formats: PDF, EPUB, DOCX, TXT, MD".

### 2.3 Hero UI mockup
`max-w-5xl mx-auto rounded-3xl border border-border shadow-sm bg-muted/30 overflow-hidden grid md:grid-cols-[320px_1fr]`:
- **Left (dark stage):** `bg-gradient-to-br from-[#16213e] via-[#1a1a2e] to-[#0f3460]` panel; inner book-cover card (`rounded-xl border border-white/10 bg-white/5 backdrop-blur p-6`): "The Adventures of Sherlock Holmes" (serif, white), faux subtitle lines (`h-1 bg-white/20 rounded`), "Arthur Conan Doyle" bottom-right; two circular prev/next buttons below (`ChevronLeft`/`ChevronRight`, `bg-white/10 text-white`).
- **Right (cream reading pane):** `p-8 bg-[#F5EFE6]`; two short faux paragraphs (`text-sm text-foreground/70`, 3–4 lines each, real Sherlock-style filler), then one sentence in `font-semibold bg-terracotta/15 rounded px-1` (read-along highlight). Bottom player row: circular `bg-terracotta text-terracotta-foreground` `Play` button + pill `flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2`: orange dot (`w-2 h-2 rounded-full bg-orange-400`), "Kaveri - Warm, Storyteller (Hindi)", `ChevronDown`.

### 2.4 Social proof
`text-xs uppercase tracking-widest text-muted-foreground text-center`: "Trusted by leading publishers, authors, & indie creators". Flex row (`flex-wrap justify-center gap-8`), items `flex items-center gap-2 opacity-40 grayscale`: `Building2` "AudioBiz", `Landmark` "Literary Co", `Feather` "LITERARY", `BookMarked` "Bonsai Agencies", `Headphones` "Spotify".

### 2.5 Section: Frictionless AI Audiobook Production (`id="production"`)
Serif centered title + sub "The complete toolkit for authors, publishers, and platforms."
`grid md:grid-cols-2 gap-10 items-center`:
- **Left:** dark dashboard mock — `rounded-2xl bg-[#16213e] text-white/80 p-4 shadow-lg` with faux top bar, thin sidebar column (4 small line items), and a chapter list: rows "Chapter 1 – 4" each `flex justify-between` with a status chip (`bg-terracotta/80 text-xs rounded-full px-2`), one row highlighted `bg-white/10`.
- **Right:** vertical list of 3 features, each `flex gap-4`: terracotta-tinted icon square (`bg-terracotta/10 text-terracotta rounded-xl p-2`):
  1. `FileText` **Smart Manuscript Parsing** — "Auto-detects chapters, characters, and dialogues, inferring age/gender from their text."
  2. `Users` **Multi-Voice Dialogue Generation** — "Assigns distinctive, context-aware Indic and global voices to different characters in a single file."
  3. `AudioLines` **Sovereign Indic Language Voice Engine** — "Immersive, emotionally rich, natural-sounding multi-dialect narration for Hindi, Telugu, Tamil, Kannada, and English (en-IN)." (icon fallback: `Waves` if `AudioLines` absent in 0.294 — verify import.)

### 2.6 Section: Voice cards (`id="voices"`)
Serif centered title: "Natural-Sounding Voices that Perform, Not Just Read" + sub "Choose from 10,000+ voices or clone a distinct style in seconds. Adjust pace, tone, and accent."
`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`: Kaveri (Natural · Hindi — highlighted variant `bg-terracotta/10 border-terracotta/30`), Deepak (Conversational · Telugu), Nalini (Warm · Tamil), Ananya (Warm · Tamil). Each card: `User` avatar circle, name (`font-medium`), language (`text-xs text-muted-foreground`), faux waveform = ~14 `<span className="w-1 rounded-full bg-terracotta/50">` bars with varied inline heights, circular `Play` button below.
Below grid, centered: `text-terracotta font-medium` button-styled link "Browse Voice Library" → `navigate('/audio-library')`.

### 2.7 Section: Bento sub-grid (3 cards, same wrapper as 2.6 or directly below)
`grid md:grid-cols-3 gap-6`:
1. **Multi-character dialog** — `Users` icon chip + two overlapping speaker-track pills ("Narrator", "Character A"); text: title + "Highlighting distinct overlapping speaker tracks."
2. **Synchronized reading** — `FileText` icon chip + mini transcript mock (3 gray lines, one `bg-terracotta/15` highlighted); title + "Visual highlighting of matching text transcripts as the audio plays."
3. **Granular Speed & Control** — faux slider track (`h-1 bg-border rounded-full` with terracotta thumb at 1.0x) and labels 0.5x / 1.0x / 1.5x / 2.0x (1.0x `text-terracotta font-semibold`); below: "Credit estimator" row with badge `text-xs text-terracotta border border-terracotta/30 rounded-full px-2 py-0.5` "120 credits" and hint "Based on 10 min of audio".

### 2.8 Section: Publishing (`id="publishing"`)
`grid md:grid-cols-2 gap-10 items-center`:
- Left: serif title "Publish directly to the Ekithab Reader App" + short editorial copy (max 3 lines): "Launch globally instantly. Earn industry-leading royalties while maintaining 100% intellectual property. Analyze listener insights on a unified publisher dashboard."
- Right: dual phone mockups — two `rounded-[2rem] border-4 border-foreground bg-[#16213e] p-3 w-40 h-72` frames, slightly rotated/offset (`rotate-[-6deg]`, `rotate-[4deg] translate-y-4`), each containing a mini cover block, progress line, and play dot; overlapping terracotta badge pill "Published on Spotify & Ekithab Reader".

### 2.9 Section: Step-by-Step Workflow
Serif centered title "Step-by-Step Workflow". `flex flex-col md:flex-row gap-10 md:gap-6 max-w-5xl mx-auto`, connectors between steps on md+ (`hidden md:block h-px w-8 bg-border self-center` or border between). Each step `flex-1`: terracotta number circle (`w-9 h-9 rounded-full bg-terracotta text-terracotta-foreground flex items-center justify-center font-serif`), then bold title + one-line description:
1. Upload Your Book — "Drag and drop PDF/EPUB"
2. Confirm Cast & Settings — "Specify narration and character voices."
3. Preview, Edit & Review — "Dynamic edits and visual validation."
4. Generate & Publish — "Instantly export MP3 or publish to digital reader storefronts."

### 2.10 Dark final CTA + footer
`bg-foreground text-background rounded-none py-20`:
- Centered serif headline (2 lines): "Great stories deserve to be heard." / "Bring your book to life now."
- CTA "Upload Your Document" — `bg-terracotta text-terracotta-foreground rounded-full px-6 py-3` → `/my-books`.
- Divider `border-white/10`, then footer row `max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between text-sm text-background/60`: left links "Site", "Site", "Copyrights" (stubs); right social icons `Twitter` (aria-label "X"), `Facebook`, `Youtube`; bottom line "© 2026 Ekithab AI" (no invented contact email).

### Style rules
- No paragraph longer than 3 lines anywhere; mockups carry the message.
- Responsive: nav links hidden < `md`; hero grid, production grid, publishing grid, bento, and workflow all stack `flex-col`/`grid-cols-1` on mobile.
- Do NOT touch `index.css` or `tailwind.config.js`.

## Task 3 — Validation (in `client/`)
1. `npm run typecheck` — must exit 0 (note: tsconfig lacks `allowJs`, so `.jsx` isn't type-checked; still required by directive).
2. `npm run build` — must succeed (catches bad lucide imports like `AudioLines`/`Twitter` and JSX syntax errors).
3. `npm run dev` manual checks:
   - `/` renders landing for logged-out users (no redirect to `/login`); logged-in users also stay on landing.
   - All three CTAs → `/my-books` (or `/login` when signed out); "Browse Voice Library" → `/audio-library`.
   - Nav anchors smooth-scroll with sticky-nav offset; "Pricing" is inert.
   - `/listen/:id`, `/login`, `/register`, `/my-books`, `/settings`, `/audio-library` behavior unchanged.
   - Responsive at ~375px and desktop.

## Risks
- lucide-react 0.294 icon availability: `AudioLines` may not exist (added later); fallback `Waves` or `Activity`. `Twitter`/`Facebook`/`Youtube` exist in 0.294. Build step will catch any bad import.
- Removing the `/` redirect for authenticated users changes existing entry behavior (explicitly approved).
- One large single-file component (~500–600 lines) is acceptable per scope; if it grows, extract local sub-components within the same file (no extra files).
