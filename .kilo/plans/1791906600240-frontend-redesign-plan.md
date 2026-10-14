# Ekithab AI: Frontend UI/UX Redesign — Implementation Plan

## Phase 1: Design System Foundation

### 1.1 Color Tokens — `client/src/index.css`
Replace the current `:root` variables with a refined palette:

| Token | Current | New |
|---|---|---|
| `--background` | `40 20% 97%` (#FAF9F6) | `36 25% 98%` (#FDFCF9) warmer ivory |
| `--foreground` | `236 24% 16%` (#252438) | `240 10% 12%` (#1A1A2E) softer charcoal |
| `--card` | `0 0% 100%` (#FFFFFF) | `36 25% 99%` (#FEFDFB) warm white |
| `--primary` | `250 76% 69%` (#7563E8) | `258 60% 60%` (#8B7CF0) deeper lavender |
| `--primary-hover` | `251 69% 61%` (#6552D5) | `258 60% 52%` (#7363DB) |
| `--sidebar` | `38 18% 94%` (#F3F1EC) | `36 20% 96%` (#F8F7F4) lighter warm |
| `--muted` | `40 15% 93%` (#F7F6F2) | `36 18% 95%` (#F9F8F6) |
| `--muted-foreground` | `240 7% 43%` (#777586) | `240 6% 48%` (#888894) |
| `--accent` | `250 76% 92%` (#EAE5FF) | `258 60% 90%` (#EDE9FB) lavender tint |
| `--active-bg` | `250 76% 92%` (#EAE5FF) | `258 60% 91%` (#EFECEF) |
| `--border` | `38 15% 89%` (#E5E1DA) | `36 12% 88%` (#EAE7E0) |
| `--elevated` | `0 0% 100%` (#FFFFFF) | `36 25% 99%` (#FEFDFB) |
| `--success` | `159 66% 39%` (#269B65) | `156 60% 35%` (#24896E) |
| `--warning` | `33 67% 41%` (#B7791F) | `30 65% 38%` (#AA6B1A) |
| `--destructive` | `353 70% 54%` (#D6455D) | `350 65% 50%` (#C94157) |
| `--radius` | `0.625rem` | `0.75rem` (12px) |

### 1.2 Shadows — `client/src/index.css`
Add a `@layer utilities` block:

```css
@layer utilities {
  .shadow-card { box-shadow: 0 1px 3px hsl(var(--muted) / 0.6), 0 4px 16px hsl(var(--muted) / 0.3); }
  .shadow-elevated { box-shadow: 0 4px 6px hsl(var(--muted) / 0.5), 0 12px 32px hsl(var(--muted) / 0.25); }
  .shadow-modal { box-shadow: 0 8px 32px hsl(240 10% 10% / 0.2), 0 2px 8px hsl(240 10% 10% / 0.1); }
}
```

### 1.3 Typography Updates — `client/src/index.css`
Keep `Inter`. Add a `font-sans` style rule with `font-feature-settings` already present. No new fonts.

### 1.4 Animation Utilities — `client/src/index.css`
Current animations (`accordion-down`, `slide-in-right`, `fade-in`) are sufficient. Add one new utility:

```css
@layer utilities {
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-up { animation: fade-up 0.3s ease-out; }
}
```

### 1.5 Button Style Refinement — `client/src/components/ui/button.jsx`
Update `buttonVariants` with larger default radius (`rounded-lg` instead of `rounded-md`), softer shadow on default variant, and a new `primary-glow` variant for hero CTAs (used later on the auth pages):

```js
primary: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm shadow-primary/20',
```

### 1.6 Input Style — inline in Login/Register (will add `rounded-lg border border-border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1` to all `<input>` elements).

### Files changed in Phase A:
- `client/src/index.css`
- `client/src/components/ui/button.jsx`

---

## Phase 2: Landing & Authentication Pages

### 2.1 Login Page — `client/src/pages/Login.jsx`
**Current:** Basic centered form, minimal branding.
**Redesign:**
- Full-height page with a soft gradient background (`bg-gradient-to-br from-background via-accent/20 to-background`)
- Logo + tagline at top-left ("Ekithab AI · Audiobook")
- Card container with `shadow-card rounded-2xl bg-card p-8 w-full max-w-sm`
- Heading: "Welcome back" (text-xl font-semibold)
- Subtext: "Log in to access your bookstore." (text-sm text-muted-foreground)
- Inputs: full-width with the refined input style above
- Primary button: "Log In" (full-width, primary variant)
- Google button: "Continue with Google" (outline variant, with Google icon from lucide-react if available, else just text)
- "Create an account" link at bottom
- Error messages preserved exactly as-is

### 2.2 Registration Page — `client/src/pages/Register.jsx`
**Current:** Same minimal pattern as Login.
**Redesign:** Mirror Login layout exactly, with:
- Heading: "Create your account"
- Subtext: "Register to start building your audiobooks."
- Three inputs: Email, Password, Confirm Password
- Primary button: "Register"
- "Already have an account? Log in" link

### 2.3 Loading State — `client/src/App.jsx`
Replace the simple spinner with a more polished centered state:

```jsx
<div className="min-h-screen bg-background flex items-center justify-center">
  <div className="flex flex-col items-center gap-3">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    <span className="text-sm text-muted-foreground">Loading…</span>
  </div>
</div>
```
(No visual change needed here — already adequate.)

### Files changed in Phase B:
- `client/src/pages/Login.jsx`
- `client/src/pages/Register.jsx`
- `client/src/App.jsx` (loading state only, cosmetic)

---

## Phase 3: Audiobook Workspace

### 3.1 Sidebar — `client/src/components/layout/Sidebar.jsx`
**Changes:**
- Add a subtle gradient to the sidebar background: `bg-gradient-to-b from-sidebar to-muted/30`
- Logo area: keep as-is, add a small divider below
- Nav items: increase padding to `py-2.5`, add `transition-all duration-150`, active state uses `bg-active` with subtle left border accent (`border-l-2 border-primary`) instead of full background fill for a more refined look
- Chapter list: improve typography, increase line-height, keep as-is
- Footer: keep "Studio Online" indicator but use a softer dot color

**Preserve:** All props, `NAV_ITEMS`, chapter list rendering, mobile overlay behavior.

### 3.2 TopBar — `client/src/components/layout/TopBar.jsx`
**Changes:**
- Replace `bg-sidebar/50` with `bg-card/80 backdrop-blur-md border-b border-border`
- Book title + chapter info: keep structure, increase font size slightly (`text-sm font-medium`)
- "New" button: add an icon (Upload from lucide-react), outline variant
- "Configure" button: keep as-is
- Logout button: keep as-is

**Preserve:** All props, mobile hamburger menu, sign-out behavior.

### 3.3 BookUploader — `client/src/components/studio/BookUploader.jsx`
**Changes:**
- Wrap in a card: `max-w-xl mx-auto space-y-6`
- Header icon: increase to `h-14 w-14`, add a soft circular background (`bg-accent/30 rounded-full p-3 inline-flex mb-4`)
- Heading: `text-2xl font-semibold`
- Subtext: `text-sm text-muted-foreground mt-1`
- Drop zone: increase padding, add `rounded-2xl`, keep drag-over and uploading states
- Accept text: `text-xs text-muted-foreground mt-2`
- Error message: keep as-is, wrap in card-style container

**Preserve:** All props, file handling logic, upload flow.

### 3.4 Dashboard — `client/src/pages/Dashboard.jsx`
**Changes:**
- When no book loaded: wrap `BookUploader` in a centered card container with generous padding
- When book loaded:
  - Top panel: add a subtle top border (`border-b border-border`)
  - Right sidebar (voice/speed controls): change `bg-sidebar` to `bg-card border-l border-border`, add `px-4` padding
  - Keep all prop passing identical
- Error banner: refine with `rounded-lg` and softer background (`bg-destructive/5`)

**Preserve:** All state, callbacks, `handleGenerate`, `generateAll`, `selectChapter`, `loadChapterAudio`, `resetBook`.

### 3.5 VoiceSelector — `client/src/components/studio/VoiceSelector.jsx`
**Changes:**
- Language pills: keep current structure, increase padding (`px-3.5 py-1.5`), add `transition-all duration-150`
- Voice cards: increase padding to `p-3.5`, add `rounded-xl`, keep selection border logic
- Grid: keep `grid-cols-2 gap-2`

**Preserve:** All props (`language`, `selectedVoice`, `onSelect`, `onLanguageChange`), `getVoices` call, filter logic, render structure.

### 3.6 AudioConfigModal — `client/src/components/studio/AudioConfigModal.jsx`
**Changes:**
- Modal overlay: keep `bg-black/70 backdrop-blur-sm`
- Modal card: increase max-width to `max-w-sm`, add `rounded-2xl shadow-modal`, increase padding to `p-6`
- Section dividers: keep as-is
- Credit estimate row: refine with `bg-muted rounded-lg`
- Generate button: increase to `h-11`, add `font-medium`, keep loading spinner

**Preserve:** All props (`isOpen`, `onClose`, `onGenerate`, `selectedLanguage`, `selectedVoice`, `speed`, `estimatedCredits`, `isGenerating`).

### 3.7 BottomPlayer — `client/src/components/layout/BottomPlayer.jsx`
**Changes:**
- Background: `bg-card border-t border-border`
- Progress bar: increase height to `h-1.5`, make thumb interactive (already partially there)
- Controls: increase icon button size to `h-9 w-9`, add hover states
- Time display: keep as-is
- Speed selector: keep as-is, add `rounded-lg`
- Add volume control using a small slider (optional enhancement, only if no existing volume state exists — currently none, so skip)

**Preserve:** All props and callbacks.

### 3.8 ReadAlongPlayer — `client/src/components/player/ReadAlongPlayer.jsx`
**Changes:** No structural changes. Pass through props unchanged.

### 3.9 TranscriptHighlighter — `client/src/components/player/TranscriptHighlighter.jsx`
**Changes:**
- Active sentence: keep current highlight, add `rounded-lg` instead of `rounded-md`, `py-2` instead of `py-1.5`
- Inactive sentences: increase padding slightly for readability
- Click handler: keep as-is

**Preserve:** All props (`alignment`, `currentTime`, `currentSentenceIndex`, `onSeek`).

### 3.10 CreditEstimateBadge — `client/src/components/studio/CreditEstimateBadge.jsx`
**Changes:** Keep as-is (already clean).

### Files changed in Phase C:
- `client/src/components/layout/Sidebar.jsx`
- `client/src/components/layout/TopBar.jsx`
- `client/src/components/studio/BookUploader.jsx`
- `client/src/pages/Dashboard.jsx`
- `client/src/components/studio/VoiceSelector.jsx`
- `client/src/components/studio/AudioConfigModal.jsx`
- `client/src/components/layout/BottomPlayer.jsx`
- `client/src/components/player/TranscriptHighlighter.jsx`

---

## Phase 4: Interaction & Responsive Behavior

### 4.1 Focus States
Ensure all interactive elements have visible `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`. Add to:
- Sidebar nav items
- Voice cards
- Chapter list items
- Button elements (already covered by shadcn defaults)
- Inputs (already in Login/Register)

### 4.2 Hover States
- Sidebar nav items: `hover:bg-muted/50`
- Voice cards: `hover:border-primary/40 hover:bg-muted/50`
- Bottom player buttons: `hover:bg-accent hover:text-accent-foreground`
- Chapter items: `hover:bg-muted`

### 4.3 Disabled States
All existing disabled states are preserved. Verify:
- VoiceSelector loading state
- BookUploader uploading state
- Bottom player when no audio
- AudioConfigModal generate button when generating

### 4.4 Mobile Responsiveness
- Sidebar: already has mobile overlay (`lg:hidden`, `fixed inset-0 z-50`) — verify hamburger menu works
- TopBar: already has hamburger for mobile — verify
- VoiceSelector grid: `grid-cols-2` is fine on mobile, may need `grid-cols-1` on very small screens — add `sm:grid-cols-2` if needed
- Bottom player: verify it collapses gracefully on small viewports
- Auth pages: already `max-w-md` with `p-4` — fine on mobile

### Files changed in Phase D:
- Same files as Phase C (hover/focus state additions in JSX className strings)
- Potentially `client/src/components/ui/button.jsx` if adding missing focus-visible styles

---

## Phase 5: Validation

### 5.1 Build & Typecheck
After each phase, run from `client/`:
```
npm run build
npm run typecheck
```

### 5.2 Functional Verification
- [ ] Login with email/password works
- [ ] Login with Google works
- [ ] Registration works
- [ ] Session restoration on reload works
- [ ] Upload .txt file → chapters parsed correctly
- [ ] Upload .md file → chapters parsed correctly
- [ ] Upload .pdf/.epub → server-side parsing works
- [ ] Chapter selection updates active chapter
- [ ] Language filter shows/hides voices correctly
- [ ] Voice selection updates selected voice without triggering generation
- [ ] Language pill click updates language without triggering generation
- [ ] "All" pill shows all voices
- [ ] Speed slider updates speed value
- [ ] Configure → Generate Audio triggers synthesis
- [ ] Credits estimated correctly
- [ ] Audio plays, pauses, seeks correctly
- [ ] Sentence highlighting syncs with playback
- [ ] Rewind/forward jumps work
- [ ] Playback speed changes work
- [ ] Reset book works
- [ ] Loading/error states display correctly
- [ ] Error boundary catches and displays errors

### 5.3 Visual Verification
- [ ] Color palette matches design spec
- [ ] Borders are thin and consistent
- [ ] Spacing is generous and consistent
- [ ] Typography hierarchy is clear
- [ ] No visual regressions from previous commits

---

## Component Interface Inventory (Safety Reference)

| Component | Props | Used By | Risk |
|---|---|---|---|
| `MainLayout` | `book, activeChapterIdx, chapter, onChapterSelect, onNavClick, onLoadNewBook, onOpenConfig, children` | `Dashboard.jsx` | Low — additive changes only |
| `Sidebar` | `book, activeChapterIdx, onChapterSelect, onNavClick, isMobileOpen, onCloseMobile` | `MainLayout.jsx` | Low — visual only |
| `TopBar` | `book, chapter, activeIdx, onMenuClick, onLoadNewBook, onOpenConfig` | `MainLayout.jsx` | Low — visual only |
| `BottomPlayer` | `audioUrl, isPlaying, currentTime, duration, playbackRate, currentChapterTitle, onPlay, onPause, onSeek, onRewind, onForward, onRateChange` | `Dashboard.jsx` | Low — visual only |
| `VoiceSelector` | `language, selectedVoice, onSelect, onLanguageChange` | `Dashboard.jsx`, `AudioConfigModal.jsx` | **Medium** — `onSelect` callback signature must match `{ voiceProfile, languageCode }` |
| `AudioConfigModal` | `isOpen, onClose, onGenerate, selectedLanguage, selectedVoice, speed, estimatedCredits, isGenerating` | `Dashboard.jsx` | Medium — `onGenerate` must accept `{ submit?, voiceProfile?, language?, speed? }` |
| `BookUploader` | `onDocumentLoaded` | `Dashboard.jsx` (when no book), `App.jsx` (none) | Low — callback receives `{ title, chapters }` |
| `ReadAlongPlayer` | `audioUrl, alignment, chapterText, currentTime, currentSentenceIndex, onSeek` | `Dashboard.jsx` | Low — pass-through |
| `TranscriptHighlighter` | `alignment, currentTime, currentSentenceIndex, onSeek` | `ReadAlongPlayer.jsx` | Low — internal |
| `CreditEstimateBadge` | `text` | `Dashboard.jsx` | Low |
| `Slider` | `min, max, step, value, onValueChange, disabled` | `Dashboard.jsx`, `AudioConfigModal.jsx` | Low — Radix primitive wrapper |
| `Button` | `variant, size, className, disabled, onClick, ...` | Everywhere | Low — CVA-based, additive classes safe |

---

## Risks

1. **VoiceSelector `onSelect` callback**: Must continue returning `{ voiceProfile, languageCode }`. Both `Dashboard.jsx` and `AudioConfigModal.jsx` consume this shape.
2. **AudioConfigModal `onGenerate` callback**: Must continue to distinguish `{ submit: true }` (trigger synthesis) from partial config updates (state-only).
3. **BottomPlayer progress bar click handler**: Uses `e.currentTarget.getBoundingClientRect()` — must not change the DOM structure of the progress track element.
4. **useAudioPlayer hook**: Returns `{ currentTime, duration, isPlaying, playbackRate, currentSentenceIndex, play, pause, seek, setPlaybackRate, seekToSentence }`. Dashboard destructures all of these; do not rename or remove any.
5. **MainLayout children**: Dashboard passes a `<div className="h-full flex flex-col overflow-hidden">` as children. The layout must continue to render `{children}` inside `<main>`.

---

## Out of Scope (Explicitly Excluded)

- Server-side changes
- New npm dependencies
- Git operations
- Database schema changes
- Backend API contract changes
- New routes or pages beyond what is listed
- Dark mode (out of scope for this phase)
- Performance optimization beyond visual refinements

---

## File Change Summary by Phase

| Phase | Files |
|---|---|
| A — Design System | `client/src/index.css`, `client/src/components/ui/button.jsx` |
| B — Auth Pages | `client/src/pages/Login.jsx`, `client/src/pages/Register.jsx`, `client/src/App.jsx` |
| C — Workspace | `client/src/components/layout/Sidebar.jsx`, `client/src/components/layout/TopBar.jsx`, `client/src/components/studio/BookUploader.jsx`, `client/src/pages/Dashboard.jsx`, `client/src/components/studio/VoiceSelector.jsx`, `client/src/components/studio/AudioConfigModal.jsx`, `client/src/components/layout/BottomPlayer.jsx`, `client/src/components/player/TranscriptHighlighter.jsx` |
| D — Interactions | Same files as Phase C (focus/hover state additions) |
| E — Validation | No files changed (verification only) |
