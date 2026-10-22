# DEV B — User Profile Endpoint: NO-OP (already covered)

## Decision (user-confirmed 2026-10-22)
Skip `GET /api/users/me`. No server code changes. Sprint item closes as already-shipped.

## Why no endpoint is needed
1. **Bottom-left avatar** (stated objective): already fully populated client-side from the Supabase auth session — `client/src/components/layout/Sidebar.jsx:20-26,145-158` renders `session.user.user_metadata.avatar_url` / `full_name` / `email`. Zero server involvement; adding `/me` would duplicate data the client already holds.
2. **Credits**: `GET /api/audio/credits` (server/src/routes/audioRoutes.js:459-477) returns `{ success, balance }` from `users.credits` behind auth.

## Rejected spec issues (recorded rationale)
- Spec import `../config/supabaseClient.js` doesn't exist — actual module is `../config/supabase.js`.
- `select('*')` would expose the entire users row (all internal columns) to the client; violates the repo's narrow-select convention used everywhere else (e.g. `.select('credits')`, `.select('id, status')`).
- `email` likely isn't a column of the `users` table at all (it comes from the JWT; auth middleware already sets `req.user.email` at middleware/auth.js:21).

## If profile fields are needed later
Minimal correct shape would be: new `userRoutes.js` returning `{ id, email: req.user.email, credits }` (exact select, JWT-derived email, `authMiddleware`-guarded, mounted `/api/users/me` in index.js). Only when more profile fields than credits exist justifies the round-trip.

## Validation
None required — no changes made. Optionally confirm the shipped behavior: sidebar shows avatar/email after login, and `GET /api/audio/credits` returns 200 with a JWT.
