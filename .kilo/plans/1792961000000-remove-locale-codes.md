# Remove Locale Codes from Language Dropdown Labels

## Problem
In the "Start a New Project" modal (`BookUploader.jsx`), language dropdown options display both the human-readable name AND the locale code in parentheses, e.g.:
- English (en-IN)
- Hindi (hi-IN)
- Telugu (te-IN)

The user wants only the human-readable names displayed:
- English
- Hindi
- Telugu

## Root Cause
`client/src/components/studio/BookUploader.jsx:95` renders:
```jsx
{LANGUAGE_LABELS[code] ?? code} ({code})
```

This appends the locale code in parentheses to every option.

## Fix

### File: `client/src/components/studio/BookUploader.jsx`

**Line 95** — Change:
```jsx
{LANGUAGE_LABELS[code] ?? code} ({code})
```

To:
```jsx
{LANGUAGE_LABELS[code] ?? code}
```

## Impact

| Aspect | Before | After |
|--------|--------|-------|
| Display | English (en-IN) | English |
| Internal value | `en-IN` | `en-IN` (unchanged) |
| API payload | `language: 'en-IN'` | `language: 'en-IN'` (unchanged) |
| Backend behavior | Unchanged | Unchanged |

## Other Language Dropdowns

Checked for similar patterns:
- **Dashboard.jsx** (Studio config): Already displays just the label ✓
- **PreferencesTab.jsx** (Settings): Already displays just the label ✓
- **PlaybackTab.jsx**: Already displays just the label ✓
- **VoiceSelector.jsx**: Does not render a language dropdown (shows voices, not languages)

No other files need changes.

## Validation

1. Open `http://localhost:5175/my-books` or Studio
2. Click "Upload a book" to open "Start a New Project" modal
3. Click the Language dropdown
4. Verify options show only: English, Hindi, Telugu, Tamil, Kannada, Malayalam, Bengali, Gujarati, Marathi, Punjabi
5. Select a language (e.g., "Hindi")
6. Verify the dropdown displays "Hindi" (not "Hindi (hi-IN)")
7. Upload a document and verify the correct language code is sent to the backend

## Files to Change

- `client/src/components/studio/BookUploader.jsx` (1 line change)
