# Studio UI Correction Plan

## Goal
Match the running Studio UI to the reference screenshot provided.

---

## Visual Comparison: Reference vs Current Implementation

### Sidebar

| Element | Reference | Current |
|---------|-----------|---------|
| Logo | Book icon + "Ekithab AI" | Same |
| Nav items | Studio (active, light bg), My Books, Audio Library, Settings | Same labels but "My Projects" → "My Books" |
| Active nav style | Light bg fill, dark text | `bg-active text-primary` (purple tint) — **wrong color** |
| Chapter list header | "Current Book" with book cover thumbnail + "12 chapters" label | Missing — no book cover, no chapter count label |
| Chapter items | Numbered (01, 02), title, duration right-aligned | Title only, no number, no duration in list |
| Footer status | Green dot + "Studio Online" + "Ready to create" | User avatar + name + email |
| Bottom user section | User avatar circle "V" + name + email | Same structure but using primary color for avatar bg |

### TopBar

| Element | Reference | Current |
|---------|-----------|---------|
| Back link | "← Back to My Books" | Present |
| New Upload button | Terracotta bg (`bg-terracotta`), white text, rounded | Ghost button — **wrong variant** |
| Configure button | Outline style | Ghost button — **should be outline** |
| Chapter info | "Chapter 02 — The Beginning" (em dash) | "Ch. 2 · The Beginning" (middle dot) — **wrong format** |
| Sign out | Circular "V" avatar | Circular "V" avatar (after uncommitted changes) |
| Bell icon | Present | Present (after uncommitted changes) |

### Main Content Area

| Element | Reference | Current |
|---------|-----------|---------|
| Book header | Book cover thumbnail (left), large title "The Art of Reading", subtitle "Chapter 02 — The Beginning", prev/next arrows | Has book cover + title + arrows, but no cover image in reference data |
| Chapter title | `text-3xl font-serif font-semibold` large serif heading | `text-2xl font-serif font-semibold` — **too small** |
| Tab icons | Transcript (doc icon), Read Along (book icon), Chapter Info (info icon) | No icons on tabs |
| Transcript area | Full paragraph text, warm highlight for current sentence | Uses ReadAlongPlayer — correct |
| Right panel width | ~320px | `w-[390px]` — **too wide** |
| Right panel bg | White (`bg-card`) | `bg-settings` (slightly gray) — **wrong** |
| Right panel padding | `p-4` | `p-5` — slightly more |
| Right panel gap | `gap-4` | `gap-5` — slightly more |

### Audio Settings Panel (Right)

| Element | Reference | Current |
|---------|-----------|---------|
| Language dropdown | Shows India flag 🇮🇳 + "Hindi" + chevron | Plain `<select>` — no flag |
| Language chips | All/ Hindi(active)/ English/ Tamil/ Telugu | Same pills but with wrong active color (terracotta vs reference terracotta) |
| Voice card layout | Avatar circle + name + accent desc + play button (right) | Name + gender/accent — **no avatar, no play button** |
| Selected voice card | Terracotta border + light terracotta bg | `border-primary bg-primary/10` (purple) — **wrong color** |
| Playback speed | Slider with terracotta track/thumb, "1.0x >" right-aligned | Slider with primary track/thumb, `{speed.toFixed(1)}x` — **wrong color & format** |
| Speed range | 0.5x to 2.0x | `min=0.5, max=2, step=0.1` — correct range |
| Credits card | "Estimated credits" label, "Based on 10 min of audio", "120 credits" in terracotta box | Similar but uses `text-lg font-bold text-terracotta` — close |
| Generate button | Black/dark bg (`bg-foreground`), rounded, "⚡ Generate Audio" | `bg-foreground` — correct |

### Bottom Player

| Element | Reference | Current |
|---------|-----------|---------|
| Book cover | Small thumbnail on left | 40×40 thumbnail — correct |
| Chapter title | "The Beginning" + "The Art of Reading" below | Same |
| Controls | Rewind, Play/Pause (large circle), Forward | Same |
| Progress bar | Terracotta filled, knob visible | Terracotta — correct |
| Time | "04:32" — "12:18" | Same |
| Speed | "1.0x" dropdown | Same |

---

## Root Causes & Required Changes

### 1. `client/src/components/layout/Sidebar.jsx`

**Changes:**
- Fix active nav item color: change `text-primary` to `text-foreground` for Studio active state (reference shows dark text on light bg, not purple)
- Add "Current Book" section above chapter list with:
  - Book cover thumbnail (generated from first 2 chars of title in a small rectangle)
  - Book title + "N chapters" label
- Format chapter items: show `01`, `02` prefix before title, duration on right
- Add green dot + "Studio Online" + "Ready to create" status line
- Keep user avatar at very bottom

### 2. `client/src/components/layout/TopBar.jsx`

**Changes:**
- Change "New" button to "New Upload" with `bg-terracotta text-background` (solid terracotta)
- Change "Configure" button to `variant="outline"` instead of ghost
- Change chapter separator from `·` to `—` (em dash)
- Update chapter prefix from `Ch. {n}` to `Chapter {n+1}` padded to 2 digits (e.g., "Chapter 02")

### 3. `client/src/pages/Dashboard.jsx`

**Changes:**
- Increase chapter title in transcript tab from `text-2xl` to `text-3xl`
- Add icons to tab bar: use `FileText` for Transcript, `BookOpen` for Read Along, `Info` for Chapter Info (import from lucide-react)
- Change right panel: `w-[390px]` → `w-[320px]`, `bg-settings` → `bg-card`, `p-5 gap-5` → `p-4 gap-4`
- Language dropdown: prepend India flag emoji for Hindi option
- VoiceSelector: update voice cards to show avatar circle (initials), name, accent, and a play button on the right
- Voice card selected state: change from `border-primary bg-primary/10` to `border-terracotta bg-terracotta/5`
- Playback speed: change slider track/thumb to terracotta colors, change label format to `{speed.toFixed(1)}x >`
- Estimated credits: keep as-is but ensure layout matches reference
- Generate button: ensure `bg-foreground` (black) — already correct

### 4. `client/src/components/studio/VoiceSelector.jsx`

**Changes:**
- Voice cards: wrap each card in a flex layout with avatar circle (left), name + accent (center), play button icon (right)
- Selected card border: `border-terracotta bg-terracotta/5` instead of `border-primary bg-primary/10`
- Play button: small circular button with Play icon on the right side of each card

### 5. `client/src/components/layout/BottomPlayer.jsx`

**Changes:**
- Already has book cover thumbnail — verify it renders correctly
- No structural changes needed

---

## Files to Modify

1. `client/src/components/layout/Sidebar.jsx`
2. `client/src/components/layout/TopBar.jsx`
3. `client/src/pages/Dashboard.jsx`
4. `client/src/components/studio/VoiceSelector.jsx`

## Files NOT to Modify
- `client/src/components/layout/MainLayout.jsx` — no changes needed
- `client/src/components/layout/BottomPlayer.jsx` — no changes needed
- `client/src/index.css` — no changes needed
- `client/tailwind.config.js` — no changes needed
- Any backend files

---

## Validation Checklist

- [ ] Sidebar: Studio nav item has light bg with dark text (not purple)
- [ ] Sidebar: "Current Book" section shows book thumbnail + title + chapter count
- [ ] Sidebar: Chapter items show number prefix (01, 02) and duration on right
- [ ] Sidebar: "Studio Online" with green dot appears above user footer
- [ ] TopBar: "New Upload" button is solid terracotta
- [ ] TopBar: "Configure" is outline style
- [ ] TopBar: Chapter info uses em dash "—" and zero-padded number
- [ ] Dashboard: Chapter title in transcript is `text-3xl font-serif`
- [ ] Dashboard: Tab bar has icons next to labels
- [ ] Dashboard: Right panel is ~320px wide with white bg
- [ ] Dashboard: Language dropdown shows flag for Hindi
- [ ] Dashboard: Voice cards have avatar circles, names, accents, play buttons
- [ ] Dashboard: Selected voice card uses terracotta border/bg
- [ ] Dashboard: Speed slider is terracotta colored
- [ ] Dashboard: Speed label shows "1.0x >" format
- [ ] BottomPlayer: Book cover thumbnail renders correctly
- [ ] Build: `npm run build` passes without errors
- [ ] Functionality: All existing controls (chapter nav, language, voice, speed, generate) still work
