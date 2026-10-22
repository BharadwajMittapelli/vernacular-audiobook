# Fix: buildPdfBaseUrl() — CMap path resolution & Windows URL safety

## Problem

`server/src/routes/documentRoutes.js:28-36` — `buildPdfBaseUrl()` contains two bugs:

1. **Wrong resolution target.** It calls `require.resolve('pdf-parse/package.json')` but pdf-parse v2.4.5's `exports` field does NOT declare `./package.json` → Node throws `Package subpath './package.json' is not defined by "exports"`.
2. **Wrong resource path.** Even if resolution succeeded, the code assumes CMaps live at `dist/pdf-parse/legacy/build/` — but `pdfjs-dist` (Mozilla's `pdf.js`) is a **separate package** (`pdf-parse` depends on it). The cmaps/standard_fonts dirs live at `node_modules/pdfjs-dist/legacy/build/`.
3. **Windows path safety.** `new URL('relative/', winPath)` fails on Windows because `winPath` is a backslash-separated filesystem path, not a valid base URL. Must use `pathToFileURL()` first.

## Root Cause

The original plan assumed pdf-parse bundles pdfjs-dist's resources inside its own `dist/` folder. In reality:
- `pdf-parse@2.4.5` declares `"pdfjs-dist": "5.4.296"` as a **peer-like dependency** (installed alongside, not bundled).
- `pdfjs-dist@5.4.296` (Mozilla's `pdf.js`) ships `legacy/build/cmaps/` and `legacy/build/standard_fonts/`.

## Fix

### Step 1 — Update imports

Add `pathToFileURL` to the `node:url` import. Remove unused `fileURLToPath`.

```js
import { pathToFileURL } from 'node:url';
```

(Keep `createRequire` and `path` — still needed.)

### Step 2 — Rewrite `buildPdfBaseUrl()`

Resolve `pdfjs-dist` directly (the package that actually owns the cmaps). Fall back to looking inside `pdf-parse/node_modules/` for environments where npm didn't hoist.

```js
function buildPdfBaseUrl() {
  const require = createRequire(import.meta.url);
  // pdf-parse v2.4.5 depends on pdfjs-dist@5.4.296 (Mozilla's pdf.js).
  // The cmaps/standard_fonts dirs live in pdfjs-dist/legacy/build/.
  // Try resolving directly first (hoisted), then fall back to nested.
  let pdfjsDistRoot;
  try {
    pdfjsDistRoot = require.resolve('pdfjs-dist/package.json');
  } catch {
    pdfjsDistRoot = require.resolve('pdf-parse/package.json');
    // Walk up from pdf-parse's package.json to its nested node_modules.
    pdfjsDistRoot = path.join(path.dirname(pdfjsDistRoot), '..', 'node_modules', 'pdfjs-dist', 'package.json');
  }
  const pkgRoot = path.dirname(pdfjsDistRoot);
  // Use pathToFileURL to safely handle Windows backslash paths.
  return new URL('legacy/build/', pathToFileURL(pkgRoot));
}
```

This resolves the correct package root regardless of npm hoisting behavior, and produces a valid `file://` URL on both Unix and Windows.

### Step 3 — No other changes needed

The rest of `documentRoutes.js` (handler, language param, INDIC_RE guard) is already correct from the prior implementation pass. Only `buildPdfBaseUrl()` and the `node:url` import change.

## Files to Modify

| File | Change |
|---|---|
| `server/src/routes/documentRoutes.js` | Add `pathToFileURL` to `node:url` import; rewrite `buildPdfBaseUrl()` |

## Validation

```
node --check server/src/routes/documentRoutes.js
```

No output = green light.

## Notes

- The server's `node_modules` is currently incomplete (only nodemon deps installed). `npm install` in `server/` must be run before runtime testing.
- Once `npm install` completes, `pdfjs-dist` will be resolvable either at the top level (hoisted) or nested inside `pdf-parse/node_modules/`. Both paths are covered.
