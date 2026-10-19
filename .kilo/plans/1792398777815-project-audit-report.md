# Phase 1 Repair Plan — Fix Backend Startup Error

## Goal
Restore the Express server so it starts successfully by installing the missing `mammoth` dependency.

## Root Cause
- `mammoth@^1.13.0` is declared in `server/package.json:23` and present in `package-lock.json`
- The actual package directory (`node_modules/mammoth/`) does not exist on disk
- `npm install` was never run after mammoth was added to the manifest, or the install was interrupted
- Server crashes at startup with: `ERR_MODULE_NOT_FOUND: Cannot find package 'mammoth'`

## Pre-Install Verification

Before running any command, confirm the following state:

| Check | Command | Expected |
|-------|---------|----------|
| Mammoth declared | `grep mammoth server/package.json` | `"mammoth": "^1.13.0"` |
| Mammoth in lockfile | `grep -c "node_modules/mammoth" package-lock.json` | `1` |
| Mammoth on disk | `ls node_modules/mammoth 2>/dev/null` | NOT FOUND |
| Lockfile integrity | `npm install --dry-run` | No changes expected |

## Installation Command

```bash
npm install
```

**Manifest impact analysis:**
- `package.json` files: **No change** — this command installs declared dependencies without modifying manifests
- `package-lock.json`: **May be updated** — if the lockfile version or integrity hashes need refreshing, npm will update the lockfile. This is expected and safe.
- `node_modules/`: **Will add** `mammoth` and ensure all other declared dependencies exist

If the dry-run shows changes beyond node_modules creation, stop and ask for approval before proceeding.

## Post-Install Verification

After `npm install` completes:

```bash
# Confirm mammoth exists
ls node_modules/mammoth/package.json

# Start the backend in the background
cd server && npm run dev &

# Wait ~3 seconds for startup, then hit health endpoint
curl -s http://localhost:4001/health

# Expected response: {"status":"ok","timestamp":"..."}
```

## Success Criteria
1. `node_modules/mammoth/` exists after `npm install`
2. `npm run dev` starts without `ERR_MODULE_NOT_FOUND`
3. `GET /health` returns HTTP 200 with JSON body
4. No source code files were modified

## Failure Cases to Report
- If `npm install` reports additional missing packages beyond mammoth, list them
- If the server starts but `/health` fails, capture the error output
- If `package-lock.json` is unexpectedly modified (e.g., version bumps), report the diff

## Files That May Change
- `node_modules/mammoth/` (new directory created)
- `package-lock.json` (possible integrity hash refresh — non-breaking)

## Files That Will NOT Change
- `server/package.json` (already correct)
- `client/package.json`
- `package.json` (root)
- Any `.js`, `.jsx`, `.ts`, `.tsx`, `.sql` source files
