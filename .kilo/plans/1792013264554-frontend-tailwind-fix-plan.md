# Frontend Tailwind CSS/PostCSS Fix Plan

## Summary
Fix frontend startup failure caused by mismatched Tailwind version and missing PostCSS plugin after Git pull.

## Root Cause
- Lockfile requires Tailwind v4 (`^4.3.3`) and `@tailwindcss/postcss` plugin
- Installed version is Tailwind v3 (`3.4.19`) from earlier install
- `@tailwindcss/postcss` plugin missing from `node_modules`
- Workspace installation incomplete (`client/node_modules` empty)
- PostCSS config references non-existent `@tailwindcss/postcss` plugin

## Verification Steps
1. Confirm current versions in package.json vs installed node_modules
2. Verify PostCSS config syntax matches intended Tailwind version
3. Check workspace installation state

## Implementation Plan

### Step 1: Clean workspace installation
- Remove `node_modules` and `client/node_modules`
- Remove `package-lock.json` (regenerate)

### Step 2: Install correct dependencies
- Run `npm install --workspace=client` to install client dependencies
- This will pull Tailwind v4 and `@tailwindcss/postcss`

### Step 3: Validate installation
- Verify `node_modules/@tailwindcss/postcss` exists
- Verify `node_modules/tailwindcss` shows v4.3.3
- Run `cd client && npm run dev` to test startup

### Step 4: Cross-platform verification
- Document exact `npm install` command for Windows developers
- Ensure no OS-specific paths or dependencies

## Files to Modify
- None (this is a dependency installation fix)
- Only package-lock.json will be regenerated

## Rollback Plan
- Restore original lockfile if new install fails
- Reinstall from lockfile only

## Validation Criteria
- `cd client && npm run dev` loads without PostCSS config error
- Login page renders with Tailwind styling
- No missing dependencies errors
- Both macOS and Windows can reproduce success

## Open Questions
1. Should we complete Tailwind v4 migration or revert to v3?
   - Current config uses v4 syntax (`@import "tailwindcss";`)
- 2. Is the workspace install command correct for both OS?
   - Test on Windows after macOS success
- 3. Are there any other missing v4 dependencies?

## Next Steps
Implementation agent should execute the installation steps and report results.