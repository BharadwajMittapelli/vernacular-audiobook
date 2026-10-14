# UI/UX Redesign Plan — Vernacular Audiobook Client

**Scope**: `/Users/vamshikrishna/vernacular-audiobook/client/src/` only
**Target**: Professional dark AI Audio Studio with sidebar, toolbar, transcript editor, voice panel, bottom player
**Input**: Existing React 18 + Vite + Tailwind + Lucide + shadcn/ui components

---

## Inspection Summary

### Existing Files (all in `client/src/`)

| File | Role |
|------|------|
| `App.jsx` | Single-page app with header + main grid |
| `main.jsx` | Entry point |
| `index.css` | Tailwind + CSS variables (light+dark default theme) |
| `tailwind.config.js` | Default shadcn theme config |
| `components/studio/AudioConfigModal.jsx` | Voice/speed modal dialog |
| `components/studio/BookUploader.jsx` | Drag-drop upload + file read |
| `components/studio/CreditEstimateBadge.jsx` | Credits display |
| `components/studio/VoiceSelector.jsx` | Language tabs + voice grid |
| `components/player/ReadAlongPlayer.jsx` | Transcript + playback controls wrapper |
| `components/player/TranscriptHighlighter.jsx` | Sentence-by-sentence highlight |
| `components/player/PlaybackControls.jsx` | Floating bottom player bar (inline in ReadAlongPlayer) |
| `components/ui/button.jsx` | CVA-based button |
| `components/ui/select.jsx` | Radix select |
| `components/ui/slider.jsx` | Radix slider |
| `components/storefront/AudioStorefrontWidget.jsx` | Storefront preview widget |
| `hooks/useAudioPlayer.jsx` | Audio playback hook |
| `services/api.js` | Axios API client |
| `services/chapterSplitter.js` | Chapter splitting utility |
| `lib/utils.js` | cn() utility |

### Key Architecture Observations

1. **Single-page app** — no routing; `App.jsx` manages all state
2. **Existing playback**: `useAudioPlayer` is a self-contained hook that creates a native `<audio>` element; it's used by `ReadAlongPlayer`, which also renders `PlaybackControls` internally (fixed-bottom floating bar). **The current `PlaybackControls` is already positioned as a floating dock at `fixed bottom-4 left-1/2 -translate-x-1/2`** — this is very close to the target persistent player.
3. **No sidebar or right panel exists** — current layout is a simple 2-column grid.
4. **No global `motion` animation plugin** in Tailwind config (no animate classes beyond what shadcn provides).
5. **No `@fontsource` or Google Fonts import** — currently relying on system font stack via `font-sans`.
6. **Current dark theme uses** `--background: 222.2 84% 4.9%` (near-black blue). The spec calls for `#0B0D12` (darker navy). These are close but not identical.
7. **Index.html title** is "eKithab Audio Pipeline" — should update to something like "AI Audiobook Studio".
8. **`AudioStorefrontWidget`** is orphaned — not imported anywhere in `App.jsx`.
9. **`useAudioPlayer` has a ponytail comment** at line 53-54 noting alignment listeners don't update mid-playback — acceptable for this redesign scope.
10. **`ReadAlongPlayer`** embeds its own `pb-28` bottom padding to compensate for the fixed player — this will need adjustment when we move to a true bottom dock.

---

## Design System Changes (Phase 1)

### Files to modify

1. **`src/index.css`** — Replace theme variables with dark-first palette:
   - `--background`: `220 13% 6%` (≈ #0B0D12)
   - `--sidebar-background`: `220 13% 8%` (≈ #0F1118) — new variable
   - `--panel-background`: `220 13% 9%` (≈ #12151D) — new variable  
   - `--elevated`: `220 13% 12%` (≈ #191D28) — new variable
   - `--border`: `220 13% 18%` (≈ #282D3A)
   - `--primary`: `252 100% 75%` (≈ #8B7CFF)
   - `--accent`: same as primary
   - Remove light mode entirely — studio is dark-only
   - Keep `--foreground`, `--muted-foreground`, `--success`, `--warning`, `--destructive` mapped correctly

2. **`tailwind.config.js`** — Add custom colors for new design tokens, extend borderRadius, add scrollbar styling in `index.css` utilities.

3. **`index.html`** — Add Inter font from Google Fonts via `<link>`, update `<title>`.

### New CSS additions (`index.css`)
- Scrollbar styling for transcript container
- Focus ring styles matching accent color
- Custom utility for panel backgrounds

---

## Layout & Shell (Phase 2)

### Files to create

1. **`src/components/layout/Sidebar.jsx`** — Left navigation with logo, nav items, credit balance area. Mobile: collapsible drawer.
2. **`src/components/layout/TopBar.jsx`** — Project toolbar showing book title, chapter context, action buttons. Mobile: hamburger + simplified bar.
3. **`src/components/layout/MainLayout.jsx`** — Wraps Sidebar + TopBar + children + persistent BottomPlayer. Manages mobile sidebar open/close state.

### Files to modify

4. **`src/App.jsx`** — Rebuild return to use `MainLayout` shell instead of raw header + main. Move all current logic into the layout body. Preserve all existing state and handlers.

### Existing components to reuse
- `Button` from `components/ui/button.jsx` — already good, just needs new color tokens
- `Select` from `components/ui/select.jsx` — reuse for chapter picker in sidebar

### New components needed
- `Sidebar` — logo (BookOpen icon), nav items: Studio, My Projects (disabled/placeholder), Audio Library (disabled), Settings (disabled). Credit balance badge at bottom.
- `TopBar` — shows book title, chapter indicator, "Configure" button, "Load New Book" button.
- `BottomPlayer` — extracted/refactored from current `PlaybackControls` to be truly persistent and fixed at viewport bottom.

---

## Transcript Editor (Phase 3)

### Files to modify

1. **`src/components/player/TranscriptHighlighter.jsx`** — Redesign for dark theme readability:
   - Larger text (16–18px)
   - Better line height for Indic scripts
   - Active sentence highlight: subtle background fill (`bg-primary/10`) + text color change
   - Hover state: `hover:bg-elevated`
   - Selected state: `border-l-2 border-primary pl-3`
   - Remove `prose` class (Tailwind typography plugin not present — will error)
   - Add proper ARIA roles

2. **`src/components/player/ReadAlongPlayer.jsx`** — Minor adjustment: remove `pb-28` padding since the player moves to `MainLayout`. Extract the transcript area scroll behavior.

### Existing components to reuse
- `useAudioPlayer` — unchanged
- `TranscriptHighlighter` — heavily edited

---

## Voice Configuration Panel (Phase 4)

### Files to modify

1. **`src/components/studio/AudioConfigModal.jsx`** — Keep as-is functionally, restyle for dark theme. This remains a modal, not a side panel — the task allows this since the current modal works well.

2. **`src/components/studio/VoiceSelector.jsx`** — Restyle tabs and voice grid for dark theme. No functional changes.

3. **`src/components/studio/CreditEstimateBadge.jsx`** — Restyle for dark theme.

### New component

4. **`src/components/studio/VoiceConfigPanel.jsx`** — Right-side persistent panel version of the voice config (alternative to modal for desktop). Shows language, voice selector, speed slider, estimated credits, Generate button. Only shown on desktop within `MainLayout`. On mobile, falls back to modal.

### Decision point

> **Keep the modal approach (AudioConfigModal) as primary, add a right-panel as a desktop-only persistent alternative?**

Recommended: **Yes.** Modal stays for mobile/simple interactions. Add `VoiceConfigPanel` as an optional right panel on desktop. `App.jsx` toggles between them based on screen width or a dedicated "Show Panel" toggle.

---

## Persistent Bottom Player (Phase 5)

### Files to modify

1. **`src/components/player/PlaybackControls.jsx`** — Keep existing logic, restyle for dark theme. Add previous/next sentence navigation (currently missing — only has skip back/forward 15s). Map to `useAudioPlayer.seekToSentence`.

2. **`src/App.jsx`** — Move playback control rendering out of `ReadAlongPlayer`'s internal `PlaybackControls` import. Instead, `MainLayout` will render a `BottomPlayer` component that receives audio state from context or App-level props.

3. **`src/hooks/useAudioPlayer.jsx`** — Already good. No changes needed.

### Decision: State sharing

The bottom player needs access to audio state. Options:
- **A) Lift state to App.jsx and pass down** — minimal change, straightforward
- **B) Create a small React Context** — cleaner separation

**Recommended: Option A.** Lift `audioResult`, `isPlaying`, `currentTime`, `duration`, `playbackRate`, `play`, `pause`, `seek`, `setPlaybackRate`, `currentSentenceIndex`, `seekToSentence` from `useAudioPlayer` into App-level state or pass via props. This avoids a new file for a single piece of shared state.

Actually — even simpler: the `BottomPlayer` can receive `useAudioPlayer` hook directly. But `ReadAlongPlayer` also uses it. Two hooks would create two audio elements. **That is a bug risk.**

**Correct approach**: App renders one `useAudioPlayer` hook instance and passes all state/actions down to both `ReadAlongPlayer` (transcript area) and `BottomPlayer` (persistent dock). This requires refactoring `ReadAlongPlayer` to accept player state as props instead of calling the hook internally.

### Files to modify (player state lift)

1. **`src/components/player/ReadAlongPlayer.jsx`** — Accept player state as props instead of calling `useAudioPlayer` internally.
2. **`src/App.jsx`** — Call `useAudioPlayer` at App level, pass state to `ReadAlongPlayer` and `BottomPlayer`.
3. **`src/components/player/BottomPlayer.jsx`** — New component receiving player state props, always visible at bottom.

---

## Book Upload & Chapter Navigation (Phase 6)

### Files to modify

1. **`src/components/studio/BookUploader.jsx`** — Restyle for dark theme (dashed border, upload icon, drag states). Minor UX polish (transition animations on drag state).

2. **`src/components/layout/Sidebar.jsx`** — Add chapter list as navigable items within sidebar when a book is loaded. Each chapter shows title, character count. Active chapter highlighted.

### Existing components to reuse
- `chapterSplitter.js` — unchanged
- `uploadDocument` API call — unchanged

---

## Responsiveness & Accessibility (Phase 7)

### Layout breakpoints

| Breakpoint | Layout |
|------------|--------|
| `>= 1024px` (lg) | Full sidebar + editor + voice panel + bottom player |
| `>= 768px` (md) | Compact sidebar (icons only) + editor + bottom player |
| `< 768px` | Collapsible sidebar (drawer) + single column editor + compact bottom player |

### Accessibility additions
- All icon buttons get `aria-label`
- Chapter list items get `role="listitem"`, active gets `aria-current="page"`
- Focus visible rings use `--ring` variable
- `BottomPlayer` controls are keyboard accessible

### Files to modify
1. **`src/components/layout/MainLayout.jsx`** — Add responsive breakpoint classes
2. **`src/components/layout/Sidebar.jsx`** — Add mobile drawer support
3. **All component files** — Audit and add missing `aria-label` attributes

---

## Testing & Build (Phase 8)

### Verification steps
1. Run `npm run build` from `client/` — must succeed with zero errors
2. Run `npm run dev` and verify:
   - App loads in dark theme
   - Book upload works (.txt, .md)
   - Chapter switching works
   - Audio generation flow completes (if server running)
   - Playback controls work
   - Responsive layout adapts at 1024px, 768px, 320px
3. Run existing self-check: `node client/test/chapterSplitter.selfcheck.mjs`
4. Console: zero errors, zero warnings about missing props

### Risk assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `prose` class used in TranscriptHighlighter but Tailwind typography plugin not installed | High | Remove `prose` from JSX |
| Google Fonts load blocking render | Low | Add `preconnect` link, use `font-display: swap` |
| Two audio elements from duplicate hooks | High if not careful | Lift hook to App level, pass state as props |
| `AudioStorefrontWidget` breaks build if imported | None | Not imported in App.jsx currently |
| Dark-only theme removes light mode for users who prefer it | Medium | Add theme toggle or keep CSS vars adjustable |

---

## Implementation Sequence

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8
```

Each phase is self-contained but later phases build on earlier ones. Phase 5 (player lift) depends on Phase 2 (layout) being ready.

### File inventory

**Create:**
- `src/components/layout/Sidebar.jsx`
- `src/components/layout/TopBar.jsx`
- `src/components/layout/MainLayout.jsx`
- `src/components/layout/BottomPlayer.jsx`
- `src/components/studio/VoiceConfigPanel.jsx`

**Modify:**
- `index.html` — font, title
- `src/index.css` — dark theme, new CSS variables, scrollbar styles
- `tailwind.config.js` — extended theme tokens
- `src/App.jsx` — restructure to use MainLayout, lift useAudioPlayer
- `src/components/player/ReadAlongPlayer.jsx` — accept props instead of hook
- `src/components/player/PlaybackControls.jsx` — restyle, add sentence prev/next
- `src/components/player/TranscriptHighlighter.jsx` — restyle, remove prose
- `src/components/studio/BookUploader.jsx` — restyle
- `src/components/studio/AudioConfigModal.jsx` — restyle
- `src/components/studio/VoiceSelector.jsx` — restyle
- `src/components/studio/CreditEstimateBadge.jsx` — restyle
- `src/components/layout/Sidebar.jsx` — (new, with chapter nav)

**Do NOT modify:**
- `src/hooks/useAudioPlayer.jsx`
- `src/services/api.js`
- `src/services/chapterSplitter.js`
- `src/lib/utils.js`
- `src/components/storefront/AudioStorefrontWidget.jsx`
- `src/main.jsx`
- Any file outside `client/`

---

## Open Questions for User Review

1. **Theme toggle**: Should the studio be dark-only (as specified), or include a light/dark toggle? Dark-only is simpler and matches the "professional audio studio" brief.

2. **Right panel vs modal**: Keep `AudioConfigModal` as the primary voice config UI, or replace it entirely with a persistent right panel? Recommended: modal for mobile, persistent panel for desktop ≥ 1024px.

3. **Sidebar chapter nav**: Show chapter list in the sidebar when a book is loaded, or keep chapter selection in the top toolbar? Recommended: sidebar list (better for multi-chapter books).

4. **`AudioStorefrontWidget`**: This component is orphaned. Should it be removed entirely, or is it part of a future storefront feature? Recommended: leave as-is, do not import in this redesign.

5. **Credits display**: Where should the user's credit balance appear? The backend has a credit ledger (`creditService.js`). Should we fetch and display it in the sidebar? If yes, the API endpoint needs to be identified — if not exposed, show a placeholder.

---

## Plan Status

**Awaiting user approval.** This plan is read-only. No files have been modified. Implementation begins only after explicit approval.
