# Audio Library Import Fix - Completion Plan

## Root Cause
The import for `AudioLibrary` was accidentally removed from `client/src/App.jsx` during a previous refactoring (likely the sidebar/layout changes). The component is still referenced at line 106 in the switch statement but is no longer imported.

## Evidence
Git diff shows:
```
-import AudioLibrary from './pages/AudioLibrary.jsx';
+import Recent from './pages/Recent.jsx';
```

The usage `<AudioLibrary />` at line 106 remains but the import is missing.

## Fix Required
Add the missing import back to `client/src/App.jsx`:
```javascript
import AudioLibrary from './pages/AudioLibrary.jsx';
```

## Files to Change
- `client/src/App.jsx` - Add the missing import

## Verification Plan
1. Run `npm run build --workspace=client` - verify clean build
2. Start dev server and navigate to `/audio-library`
3. Confirm Audio Library page renders with all tabs (All Audio, Downloads)
4. Test playback functionality
5. Check browser console for errors