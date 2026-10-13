# Audio Configuration Restore Plan

## Root Cause Analysis

### Issue 1: AudioConfigModal not mounted in book-loaded view
**Location**: `client/src/pages/Dashboard.jsx:149-269`
- Lines 173-182: `AudioConfigModal` rendered only in `!book` branch
- Lines 187-269: Book-loaded branch does NOT render the modal
- `TopBar` calls `onOpenConfig` → `setIsConfigOpen(true)` but modal isn't in DOM

**Fix**: Move `AudioConfigModal` outside the conditional so it renders in both branches.

---

### Issue 2: VoiceSelector prop mismatch
**Dashboard.jsx (lines 223-228)** passes:
```jsx
<VoiceSelector
  language={selectedLanguage}
  voiceProfile={selectedVoice}
  setLanguage={setSelectedLanguage}
  setVoice={setSelectedVoice}
/>
```

**VoiceSelector.jsx (line 17)** expects:
```jsx
export function VoiceSelector({ language, onSelect, onLanguageChange, selectedVoice })
```

**AudioConfigModal.jsx (lines 37-44)** currently passes:
```jsx
<VoiceSelector
  language={selectedLanguage}
  selectedVoice={selectedVoice}
  onSelect={({ voiceProfile, languageCode }) => onGenerate({ voiceProfile, language: languageCode })}
  onLanguageChange={(language) => onGenerate({ language })}
/>
```

**Fix**: 
1. Update Dashboard's inline VoiceSelector to use `onSelect`/`onLanguageChange` callbacks that update state (not `setLanguage`/`setVoice`/`voiceProfile`)
2. Update AudioConfigModal's VoiceSelector to use callbacks that update state via `onGenerate` WITHOUT `submit: true` — selecting language/voice only updates config, does not generate audio
3. Only the "Generate Audio" button passes `submit: true`

---

### Issue 3: Language filter precedence bug
**VoiceSelector.jsx:31**
```jsx
const active = language || fallbackLang;
```
- `language` prop (from Dashboard: `selectedLanguage`) always truthy → "All" button never works
- The filter state (`fallbackLang`) should be independent of the generation language (`selectedLanguage`)

**Fix**: 
1. Use `fallbackLang` for UI filtering (what voices to show)
2. Keep `language` prop only for default selection highlight
3. "All" button sets `fallbackLang='all'` WITHOUT calling `onLanguageChange`
4. Specific language buttons set `fallbackLang=code` AND call `onLanguageChange(code)`

---

### Issue 4: Race condition in handleGenerate
**Dashboard.jsx:78-104**
```jsx
const handleGenerate = async (config) => {
  if (config?.language) setSelectedLanguage(config.language);
  if (config?.voiceProfile) setSelectedVoice(config.voiceProfile);
  if (config?.speed !== undefined) setSpeed(config.speed);

  if (config?.submit && chapter) {
    // Uses selectedLanguage, selectedVoice, speed — STATE MAY BE STALE
    const result = await synthesizeAudio({
      chapterId: chapter.chapterId,
      text: chapter.text,
      language: selectedLanguage,      // <-- stale!
      voiceProfile: selectedVoice,     // <-- stale!
      speed,                           // <-- stale!
    });
  }
};
```
React state updates are asynchronous. The API call reads state before `setSelectedLanguage` etc. have flushed.

**Fix**: Use `config` values directly in the API call:
```jsx
const language = config?.language ?? selectedLanguage;
const voiceProfile = config?.voiceProfile ?? selectedVoice;
const selectedSpeed = config?.speed ?? speed;
```

Then pass `language`, `voiceProfile`, `selectedSpeed` to `synthesizeAudio`.

---

### Issue 5: Selection actions must not trigger generation
**Current behavior**: AudioConfigModal's VoiceSelector calls `onGenerate` on every selection (language or voice), which updates state AND could trigger generation if `submit` were true.

**Required behavior**: 
- Selecting a language → updates `selectedLanguage` only
- Selecting a voice → updates `selectedVoice` only  
- Adjusting speed → updates `speed` only
- Clicking "Generate Audio" → calls synthesis with current config values

**Fix**: AudioConfigModal passes separate callbacks to VoiceSelector:
- `onSelect={({ voiceProfile }) => onGenerate({ voiceProfile })}` (no languageCode, no submit)
- `onLanguageChange={(language) => onGenerate({ language })}` (no submit)
- "Generate Audio" button passes `{ language: selectedLanguage, voiceProfile: selectedVoice, speed: selectedSpeed, submit: true }`

---

### Issue 6: Voice language code preservation
When a voice is selected, it has an associated `languageCode`. The synthesis request must use a valid language code that matches the selected voice profile. The "All" filter (`fallbackLang='all'`) must never be passed as the generation language.

**Fix**: 
- VoiceSelector's `onSelect` callback receives the full voice object and passes `{ voiceProfile: v.id, languageCode: v.languageCode }` to `onGenerate`
- Dashboard's `handleGenerate` uses the `languageCode` from the voice selection if no explicit language was provided
- AudioConfigModal's "Generate Audio" button uses `selectedLanguage` (which was set via `onLanguageChange` when a language filter was clicked) and `selectedVoice`

---

## Implementation Plan

### Files to Modify (client/ only)

| File | Changes |
|------|---------|
| `client/src/pages/Dashboard.jsx` | 1. Move `AudioConfigModal` outside `if (!book)` block<br>2. Fix inline `VoiceSelector` props to use `onSelect`/`onLanguageChange` callbacks that call `setSelectedVoice`/`setSelectedLanguage`<br>3. Fix `handleGenerate` to use `config` values directly (not stale state), including `selectedSpeed` variable<br>4. In `handleGenerate`, when `config.voiceProfile` is provided with `languageCode`, use that languageCode for synthesis if no explicit language was given |
| `client/src/components/studio/VoiceSelector.jsx` | 1. Decouple filter state (`fallbackLang`) from generation language (`language` prop)<br>2. Fix "All" button logic to show all voices from API<br>3. Language buttons update filter AND call `onLanguageChange`<br>4. `onSelect` passes `{ voiceProfile: v.id, languageCode: v.languageCode }` |
| `client/src/components/studio/AudioConfigModal.jsx` | 1. Change VoiceSelector `onSelect` to pass `{ voiceProfile, languageCode }`<br>2. Change VoiceSelector `onLanguageChange` to only pass `language`<br>3. "Generate Audio" button passes all config + `submit: true` |

---

## Validation Steps

1. Run `npm run build` from `client/` — must pass
2. Run `npm run typecheck` from `client/` — must pass
3. Manual verification:
   - Upload document → book loads
   - Click "Configure" → modal opens
   - Click "All" → shows voices from all languages returned by API
   - Select language → filters voices, updates generation language (no audio generated)
   - Select voice → updates generation voice (no audio generated)
   - Adjust speed → updates generation speed (no audio generated)
   - Click "Generate Audio" → loading → success → audio plays
   - Close modal → modal closes
   - Inline VoiceSelector in sidebar also works (selection updates state, no generation)
   - Voice selection preserves its language code for synthesis
   - "All" filter never becomes the generation language

---

## Out of Scope
- Server changes
- Supabase/auth changes
- New dependencies
- Slider fix, Error Boundary, error banners (preserve existing)
- Audio player / read-along sync (preserve existing)
- Dashboard redesign or removal of existing functionality