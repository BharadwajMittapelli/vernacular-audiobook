# Plan: Audio Library — Typography Consistency Fix

**Scope:** `client/src/components/audioLibrary/LibraryTopBar.jsx`, `ContinueListening.jsx`, `PlayerPanel.jsx`  
**Branch:** `master`

---

## Problem

The Audio Library page overuses `font-serif` (Lora) on UI headings, breaking the app's established typographic convention:

- **Serif is reserved for reading content** — chapter titles in the studio (Dashboard), transcript text (TranscriptEditor, TranscriptHighlighter, ReadAlongPlayer).
- **Sans-serif (Inter) is used for all UI headings and labels** — page titles (MyBooks, Login, Register), section headers (Settings), nav labels, table headers, metadata labels.

**Current misuse in Audio Library:**
| Location | Element | Current | Should be |
|----------|---------|---------|-----------|
| `LibraryTopBar.jsx:24` | Page title "Audio Library" | `font-serif text-3xl` | `text-3xl` (no font-serif) |
| `ContinueListening.jsx:30` | Section header "Continue Listening" | `font-serif text-lg` | `text-lg` (no font-serif) |
| `PlayerPanel.jsx:103` | Active chapter title in player | `font-serif text-lg` | `font-serif text-lg` — **KEEP** (this is reading content, matches Dashboard:485) |

**Note on Settings:** `Settings.jsx:179` also uses `font-serif` for its page title — that is a pre-existing inconsistency in the codebase, but it is **out of scope** for this fix. Only the Audio Library components are touched.

---

## Tasks

### 1. `client/src/components/audioLibrary/LibraryTopBar.jsx`

Remove `font-serif` from the `<h1>` title:

```diff
- <h1 className="font-serif text-3xl font-semibold text-foreground">
+ <h1 className="text-3xl font-semibold text-foreground">
    Audio Library
  </h1>
```

### 2. `client/src/components/audioLibrary/ContinueListening.jsx`

Remove `font-serif` from the `<h2>` section header:

```diff
- <h2 className="font-serif text-lg font-semibold text-foreground">Continue Listening</h2>
+ <h2 className="text-lg font-semibold text-foreground">Continue Listening</h2>
```

### 3. `client/src/components/audioLibrary/PlayerPanel.jsx`

**No changes.** The chapter title `<h2>` at line 103 correctly uses `font-serif` — it displays reading content (a chapter title the user will listen to), consistent with `Dashboard.jsx:485` which uses `font-serif` for the same purpose.

---

## Files Changed

| File | Change |
|------|--------|
| `client/src/components/audioLibrary/LibraryTopBar.jsx` | Remove `font-serif` from h1 |
| `client/src/components/audioLibrary/ContinueListening.jsx` | Remove `font-serif` from h2 |
| `client/src/components/audioLibrary/PlayerPanel.jsx` | No change |

---

## Validation

```bash
cd client && npm run typecheck && npm run build
```

Visual check — after `npm run dev`:
- Navigate to `/audio-library` → "Audio Library" page title renders in Inter (sans-serif), matching MyBooks.jsx:163 style.
- "Continue Listening" section header renders in Inter, matching Settings section headers.
- Active chapter title in the right player panel remains in Lora (serif), consistent with Dashboard chapter titles.
