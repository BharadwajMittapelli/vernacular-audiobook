# Ekithab AI Studio Page Redesign — Revised Implementation Plan

## Goal
Redesign the Studio page to match the reference screenshot while preserving all existing functionality, state ownership, and component contracts.

---

## Exact Files to Modify

| # | File | Action |
|---|------|--------|
| 1 | `client/tailwind.config.js` | Add `terracotta` color tokens |
| 2 | `client/src/index.css` | Add terracotta CSS vars + Lora serif font import |
| 3 | `client/src/components/layout/MainLayout.jsx` | Add optional `playerHeight` prop to reserve bottom space |
| 4 | `client/src/components/layout/Sidebar.jsx` | Add user profile footer; update nav labels; show chapter durations |
| 5 | `client/src/components/layout/TopBar.jsx` | Add "Back to My Books", notification bell, user avatar |
| 6 | `client/src/components/layout/BottomPlayer.jsx` | Add book cover thumbnail, terracotta progress, book title label |
| 7 | `client/src/pages/Dashboard.jsx` | Full rewrite: tabs, right audio settings panel, three-column layout |

## Existing Components Reused (No Modifications)
- `VoiceSelector` — props contract unchanged
- `TranscriptHighlighter` — props contract unchanged
- `ReadAlongPlayer` — props contract unchanged
- `CreditEstimateBadge` — props contract unchanged
- `AudioConfigModal` — kept as-is for backwards compatibility
- `BookUploader` — no changes
- `useAudioPlayer` — no changes
- `api.js` — no changes
- `AuthContext` — no changes

---

## ACTUAL COMPONENT CONTRACTS (Verified from Source)

### Dashboard (source of truth for all state)
```js
State: book, activeIdx, isConfigOpen, selectedLanguage ('hi-IN'),
       selectedVoice, speed (1), isGenerating, isBulk, bulkStatus,
       audioResult, error

Computed: chapter = book.chapters[activeIdx]
          alignment = audioResult?.alignment || []
          audioUrl = audioResult?.audioUrl || null
          estimatedCredits = Math.ceil(cleanText(chapter.text).length / 100)

Hooks: useAudioPlayer(audioUrl, alignment)
       → { currentTime, duration, isPlaying, playbackRate, currentSentenceIndex,
           play, pause, seek(n), setPlaybackRate(n), seekToSentence(i) }

Callbacks: loadChapterAudio(ch), handleDocumentLoaded({title,chapters}),
           selectChapter(idx), resetBook(),
           handleGenerate(config), generateAll()

Audio generation payload (from handleGenerate):
  synthesizeAudio({ chapterId, text, language, voiceProfile, speed })
```

### VoiceSelector
```js
Props: language (string, e.g. 'hi-IN'), selectedVoice (string|null),
       onSelect ({ voiceProfile, languageCode }), onLanguageChange (language string)
Internal state: voices (fetched), filterLang ('all'), error
Fetches voices from GET /api/voices?language= when `language` prop changes
```

### ReadAlongPlayer
```js
Props: audioUrl, alignment, chapterText,
       currentTime (default 0), currentSentenceIndex (default -1),
       onSeek (optional)
→ Delegates to TranscriptHighlighter when audioUrl exists
→ Shows "No audio generated yet" when !audioUrl
```

### TranscriptHighlighter
```js
Props: alignment, currentTime, currentSentenceIndex, onSeek (optional)
→ Renders array of <p> elements from alignment[].text
→ Active entry: bg-active text-primary border-l-2 border-primary pl-3
```

### BottomPlayer
```js
Props: audioUrl, isPlaying, currentTime, duration, playbackRate,
       currentChapterTitle, onPlay, onPause, onSeek(n), onRewind, onForward, onRateChange(n)
→ h-20 (80px), shrink-0, border-t, bg-card
```

### MainLayout
```js
Props: book, activeChapterIdx, chapter, onChapterSelect, onNavClick,
       onLoadNewBook, onOpenConfig, children
→ Outer: flex h-screen overflow-hidden bg-background
→ Left: Sidebar
→ Right: flex flex-1 flex-col min-w-0 overflow-hidden
  → TopBar (shrink-0, h-14)
  → main (flex-1 overflow-hidden) {children}
```

---

## Step-by-Step Changes

### Step 1 — Tailwind Config (`client/tailwind.config.js`)

Add terracotta to the existing `colors.extend` block:
```js
terracotta: {
  DEFAULT: 'hsl(var(--terracotta))',
  foreground: 'hsl(var(--terracotta-foreground))',
},
```

### Step 2 — CSS (`client/src/index.css`)

Add after `--warning` line in `:root`:
```css
--terracotta: 19 40% 52%;
--terracotta-foreground: 0 0% 100%;
```

Add Google Fonts import after `@import "tailwindcss"`:
```css
@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
```

No change to body font stack — `font-serif` Tailwind class will use the font-family CSS variable. We'll apply serif selectively via className on chapter headings only.

### Step 3 — MainLayout (`client/src/components/layout/MainLayout.jsx`)

Add optional `playerHeight` prop (default `null`). When set, reserves space at the bottom of the `<main>` area so the fixed BottomPlayer doesn't overlap content.

```jsx
export function MainLayout({
  book, activeChapterIdx, chapter, onChapterSelect, onNavClick,
  onLoadNewBook, onOpenConfig, children, playerHeight = null,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar ... />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopBar ... />
        <main
          className="flex-1 overflow-hidden"
          style={playerHeight ? { paddingBottom: `${playerHeight}px` } : undefined}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
```

**Why this works:** The `<main>` gets extra bottom padding equal to the player height. Dashboard's content scrolls freely inside it. BottomPlayer renders after MainLayout as a fixed-height strip — no overlap, no clipping.

### Step 4 — Sidebar (`client/src/components/layout/Sidebar.jsx`)

**Changes:**
1. Update `NAV_ITEMS` labels: `'My Projects'` → `'My Books'`
2. Add chapter reading duration estimate alongside each chapter title:
   ```js
   const estMin = ch => Math.ceil(
     (ch.text || '').replace(/[#*`_\[\]]/g, '').trim().split(/\s+/).filter(Boolean).length / 160
   );
   // Render: <span className="ml-auto text-xs text-muted-foreground">{estMin(ch)} min</span>
   ```
3. Add user profile footer (import `useAuth`, read `session?.user`):
   - Avatar: `user.user_metadata?.avatar_url` if available, else initials from `full_name` or `email`
   - Name: `user.user_metadata?.full_name || user.email || 'User'`
   - Email: `user.email`
4. Keep existing props contract unchanged

### Step 5 — TopBar (`client/src/components/layout/TopBar.jsx`)

**Changes (props contract preserved):**
1. Add "← Back to My Books" link before the book title area — navigates to `/` (via `window.history.back()` or programmatic nav)
2. Add notification bell icon button on the right (non-functional placeholder — no notification system exists)
3. Replace/augment the logout button with user avatar (initials circle) on the far right
4. Keep existing New Upload and Configure buttons

### Step 6 — BottomPlayer (`client/src/components/layout/BottomPlayer.jsx`)

**Changes (props contract preserved — all 11 props unchanged):**
1. Add book cover thumbnail (text initials placeholder, since no cover image in data model)
2. Show book title below chapter title in the left info column
3. Change progress bar fill from `bg-primary` to `bg-terracotta`
4. Make the thumb dot always visible (remove `opacity-0` from current hidden thumb)

### Step 7 — Dashboard (`client/src/pages/Dashboard.jsx`) — Main Rewrite

**New layout structure:**
```
MainLayout (playerHeight={80})
  children = <StudioContent />   ← scrolls within reserved space
BottomPlayer                      ← fixed below, no overlap
AudioConfigModal                  ← kept for backwards compat
```

**New state:** `const [activeTab, setActiveTab] = React.useState('transcript');`

**Helper functions (inside Dashboard):**
```js
const estimateWordCount = (text) =>
  text ? text.replace(/[#*`_\[\]]/g, '').trim().split(/\s+/).filter(Boolean).length : 0;
const estimateCharCount = (text) =>
  text ? text.replace(/[#*`_\[\]]/g, '').trim().length : 0;
const estimateReadingMinutes = (text) => {
  if (!text) return 0;
  return Math.ceil(estimateWordCount(text) / 160);
};
```

**StudioContent layout (replaces old children div):**
```jsx
<div className="h-full flex flex-col bg-background">
  {/* Book header */}
  <div className="shrink-0 px-8 pt-6 pb-4 flex items-start gap-4 border-b border-border">
    {/* Book cover placeholder (initials) */}
    <div className="w-12 h-16 shrink-0 rounded-md bg-terracotta/20
                    flex items-center justify-center
                    text-terracotta text-sm font-bold">
      {book.title?.slice(0, 2).toUpperCase()}
    </div>
    {/* Title + chapter */}
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground mb-0.5 font-medium">{book.title}</p>
      <h1 className="text-3xl font-serif font-semibold text-foreground leading-tight">
        {chapter?.title}
      </h1>
      <p className="text-xs text-muted-foreground mt-1">
        Chapter {activeIdx + 1} of {book.chapters.length}
      </p>
    </div>
    {/* Prev/Next */}
    <div className="flex items-center gap-2 shrink-0">
      <button onClick={() => selectChapter(Math.max(0, activeIdx - 1))}
              disabled={activeIdx === 0}
              className="p-2 rounded-lg border border-border hover:bg-muted
                         disabled:opacity-40 disabled:cursor-not-allowed">
        ←
      </button>
      <button onClick={() => selectChapter(Math.min(book.chapters.length - 1, activeIdx + 1))}
              disabled={activeIdx === book.chapters.length - 1}
              className="p-2 rounded-lg border border-border hover:bg-muted
                         disabled:opacity-40 disabled:cursor-not-allowed">
        →
      </button>
    </div>
  </div>

  {/* Tab bar */}
  <div className="shrink-0 px-8 border-b border-border flex items-center gap-6">
    {['transcript', 'read-along', 'chapter-info'].map(tab => (
      <button key={tab} onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-terracotta text-terracotta'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
        {tab === 'transcript' ? 'Transcript' : tab === 'read-along' ? 'Read Along' : 'Chapter Info'}
      </button>
    ))}
  </div>

  {/* Main content + right panel */}
  <div className="flex-1 overflow-hidden flex">
    {/* Central workspace — scrolls independently */}
    <div className="flex-1 overflow-y-auto px-8 py-6 scrollbar-thin">
      {error && <ErrorBanner>{error}</ErrorBanner>}

      {activeTab === 'transcript' && (
        <div>
          <h2 className="text-2xl font-serif font-semibold text-foreground mb-6">
            {chapter?.title}
          </h2>
          {audioUrl ? (
            <ReadAlongPlayer
              audioUrl={audioUrl}
              alignment={alignment}
              chapterText={chapter.text}
              currentTime={player.currentTime}
              currentSentenceIndex={player.currentSentenceIndex}
              onSeek={(s) => player.seek(s)}
            />
          ) : (
            <EmptyState label="No audio generated yet"
                        sublabel="Configure voice settings and generate audio" />
          )}
        </div>
      )}

      {activeTab === 'read-along' && (
        <ReadAlongPlayer
          audioUrl={audioUrl}
          alignment={alignment}
          chapterText={chapter.text}
          currentTime={player.currentTime}
          currentSentenceIndex={player.currentSentenceIndex}
          onSeek={(s) => player.seek(s)}
        />
      )}

      {activeTab === 'chapter-info' && (
        <ChapterInfoView chapter={chapter} estimatedCredits={estimatedCredits}
                         readingMinutes={estimateReadingMinutes(chapter?.text)}
                         wordCount={estimateWordCount(chapter?.text)}
                         charCount={estimateCharCount(chapter?.text)}
                         hasAudio={!!audioResult} audioDuration={player.duration} />
      )}
    </div>

    {/* Right Audio Settings Panel */}
    <div className="w-[390px] shrink-0 border-l border-border bg-settings
                    flex flex-col overflow-y-auto scrollbar-thin p-5 gap-5">
      {/* Section heading */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">Audio settings</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Choose language, voice and speed to generate audio.
        </p>
      </div>

      {/* Language dropdown */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Language
        </p>
        <select value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full appearance-none bg-card border border-border
                           rounded-lg px-3 py-2.5 text-sm text-foreground pr-8
                           focus:outline-none focus:ring-2 focus:ring-terracotta/40
                           cursor-pointer">
          <option value="hi-IN">Hindi</option>
          <option value="en-IN">English</option>
          <option value="te-IN">Telugu</option>
          <option value="ta-IN">Tamil</option>
          <option value="kn-IN">Kannada</option>
          <option value="ml-IN">Malayalam</option>
          <option value="mr-IN">Marathi</option>
          <option value="bn-IN">Bengali</option>
          <option value="gu-IN">Gujarati</option>
          <option value="pa-IN">Punjabi</option>
        </select>
      </div>

      {/* Language filter chips — synced to selectedLanguage */}
      <div className="flex flex-wrap gap-1.5">
        {['all', 'hi-IN', 'en-IN', 'ta-IN', 'te-IN', 'kn-IN'].map(code => (
          <button key={code}
                  onClick={() => {
                    if (code !== 'all') setSelectedLanguage(code);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedLanguage === code
                      ? 'bg-terracotta/15 border-terracotta text-terracotta'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}>
            {code === 'all' ? 'All' : LABELS[code] || code}
          </button>
        ))}
      </div>

      {/* Voice cards — reuses existing VoiceSelector, props contract preserved */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Voice
          </p>
          <button className="text-xs text-terracotta font-medium hover:underline">
            View all →
          </button>
        </div>
        <VoiceSelector
          language={selectedLanguage}
          selectedVoice={selectedVoice}
          onSelect={({ voiceProfile, languageCode }) => {
            setSelectedVoice(voiceProfile);
            if (languageCode) setSelectedLanguage(languageCode);
          }}
          onLanguageChange={(lang) => setSelectedLanguage(lang)}
        />
      </div>

      {/* Playback speed slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Playback speed
          </p>
          <span className="text-xs text-terracotta font-medium">{speed.toFixed(1)}x</span>
        </div>
        <Slider min={0.5} max={2} step={0.1} value={[speed]}
                onValueChange={([v]) => setSpeed(v)} />
      </div>

      {/* Estimated credits card */}
      <div className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Estimated credits
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Based on {estimateReadingMinutes(chapter?.text)} min of audio
          </p>
        </div>
        <span className="text-lg font-bold text-terracotta">{estimatedCredits}</span>
      </div>

      {/* Generate Audio — calls EXISTING handleGenerate, NO duplicated logic */}
      <button onClick={() => handleGenerate({
        language: selectedLanguage,
        voiceProfile: selectedVoice,
        speed,
        submit: true,
      })}
              disabled={isGenerating || !selectedVoice || !chapter}
              className="w-full bg-foreground text-background rounded-lg py-3
                        text-sm font-semibold hover:opacity-90
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-opacity flex items-center justify-center gap-2">
        {isGenerating ? (
          <><Spinner /> Generating…</>
        ) : (
          <><BoltIcon /> Generate Audio</>
        )}
      </button>
    </div>
  </div>
</div>
```

**How Generate Audio preserves existing behavior:**
- Calls `handleGenerate({ language, voiceProfile, speed, submit: true })` — the exact same handler the modal uses
- `handleGenerate` updates state from config (lines 79–81), then runs the API call (lines 83–107)
- The only side-effect is `setIsConfigOpen(false)` on success (line 100) — harmless since no modal is open in studio view
- Loading, error, credit handling, and API payload are identical to existing behavior
- **Zero logic duplication**

**Language filtering (chips ↔ dropdown ↔ VoiceSelector sync):**
- Clicking a chip calls `setSelectedLanguage(code)` — this drives the `<select>` value
- `selectedLanguage` prop feeds into `VoiceSelector` — its `useEffect` re-fetches voices for that language
- VoiceSelector's internal filter chips continue to work independently (they only affect which voices are displayed, not the language)
- Clicking a voice card in VoiceSelector calls `onSelect` → `setSelectedVoice` + `setSelectedLanguage(languageCode)` — keeps everything synchronized
- **No duplicate language state**

**Tab behavior:**
- `activeTab` is independent React state — switching tabs does not affect audio, player, or configuration
- Transcript tab: shows chapter heading + ReadAlongPlayer with sentence highlighting
- Read Along tab: same ReadAlongPlayer (identical experience, just a different tab label)
- Chapter Info tab: reads from `chapter` object directly — displays real title, chapterId, word count, character count, estimated reading time, estimated credits, audio status

---

## Validation Checklist

Before considering the task complete, verify each interaction:

| Interaction | Expected | Verified |
|---|---|---|
| Navigate to Studio | Opens Dashboard with book upload or existing book | ☐ |
| Chapter selection (sidebar) | Loads chapter, clears audio, loads chapter audio | ☐ |
| Prev/Next chapter arrows | Navigates between chapters | ☐ |
| Tab: Transcript | Shows chapter heading + aligned transcript | ☐ |
| Tab: Read Along | Shows synchronized transcript with highlighting | ☐ |
| Tab: Chapter Info | Shows real chapter metadata | ☐ |
| Language dropdown | Updates selected language, VoiceSelector re-fetches | ☐ |
| Language chips | Sync with dropdown, filter VoiceSelector voices | ☐ |
| Voice card click | Selects voice, updates selectedVoice state | ☐ |
| Speed slider | Updates speed state (no generation triggered) | ☐ |
| Generate Audio | Calls handleGenerate → synthesizeAudio API | ☐ |
| Play/pause | Controls actual audio playback | ☐ |
| Seek bar | Jumps to correct time | ☐ |
| Rewind/Forward | Sentence-level or 15s skip | ☐ |
| Speed dropdown (player) | Updates playbackRate | ☐ |
| Back to My Books | Navigates away from studio | ☐ |
| New Upload | Resets book, shows upload screen | ☐ |
| Configure (modal) | Opens AudioConfigModal, works as before | ☐ |

---

## Pre-existing Error Check

Run `npm run typecheck` in `client/` before and after changes. Document any pre-existing errors that are unrelated to this redesign.

---

## Limitations (Reported, Not Implemented)

1. **Voice preview buttons** — No preview API exists in the application. Voice cards render without preview functionality.
2. **Chapter cover images** — No cover image data in the chapter model. Placeholders show title initials.
3. **Chapter durations** — Displayed as estimated reading time (words ÷ 160 wpm), not actual audio duration.
4. **Notification bell** — Non-functional placeholder; no notification system in the app.

---

## Build & Typecheck Commands

```bash
cd client && npm run build
cd client && npm run typecheck
```
