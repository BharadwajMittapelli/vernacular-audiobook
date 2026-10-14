# Fix: Slider Crash

**Date:** 2026-10-13  
**Symptom:** After uploading a .txt/.md file, the app shows "Something went wrong — context.values.map is not a function" and a 404 error in console.

---

## Root Cause

`Dashboard.jsx` passes `value={speed}` (single number) and `onChange={setSpeed}` to the Slider. `@radix-ui/react-slider` v1.x requires `values` (array) and `onValueChange`. The same Slider component works correctly in `AudioConfigModal.jsx` because it already uses the v1 API. This inconsistency causes a render crash caught by the Error Boundary in `main.jsx`.

The 404 on `/api/audio/:chapterId` is **expected**: no audio has been generated yet for the newly uploaded chapter. `loadChapterAudio`'s catch block silently ignores 404s (line 47). This is correct behavior — do not modify the backend to suppress it.

The error banners added in the prior plan (SUSP-002/SUSP-003) remain in place and will surface backend errors once the Slider crash is resolved.

---

## Tasks

### Task 1 — Fix Slider props in Dashboard.jsx (BUG-006)

**File:** `client/src/pages/Dashboard.jsx`, lines 230–236

Change:
```jsx
<Slider
  min={0.7}
  max={2}
  step={0.1}
  value={speed}
  onChange={setSpeed}
/>
```

To:
```jsx
<Slider
  min={0.7}
  max={2}
  step={0.1}
  value={[speed]}
  onValueChange={([v]) => setSpeed(v)}
/>
```

This matches the pattern in `AudioConfigModal.jsx:52-58`. No other props, state, or features change.

---

## Files to Change

| File | Change |
|------|--------|
| `client/src/pages/Dashboard.jsx` | Fix Slider `value`/`onChange` → `values`/`onValueChange` (lines 230–236) |

No other files are modified. Error Boundary (`main.jsx`) and error banners are preserved as-is.

---

## Validation

Run from `client/` directory:

```bash
npm run build
npm run typecheck
```

Both must pass with no errors.

Then confirm runtime:

1. `npm run dev` from project root (client:5175, server:4001)
2. `curl http://localhost:4001/health` — backend healthy
3. Log in with Google OAuth
4. Upload a `.txt` file
5. **Expected:** Book UI renders without crash; speed slider is functional
6. Console: no `context.values.map is not a function` error
7. 404 on `/api/audio/:chapterId` in console is **expected** (no audio generated yet) — ReadAlongPlayer shows "No audio generated yet"
8. Click "Configure" → select voice → "Generate Audio" → verify synthesis flow completes

---

## Notes

- Only one line pair changes: `value={speed}` → `value={[speed]}` and `onChange={setSpeed}` → `onValueChange={([v]) => setSpeed(v)}`.
- `speed` state, slider range (`min=0.7`, `max=2`, `step=0.1`), and all other Dashboard functionality are preserved unchanged.
