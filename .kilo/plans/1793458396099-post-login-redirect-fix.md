# Post-Login Navigation Fix

## Root Cause

Three locations hardcode `/my-books` as the post-login redirect destination, overriding the correct `/home` destination:

1. **`App.jsx:40`** — First `useEffect` auth guard: authenticated user on `/auth` redirects to `/my-books`
2. **`App.jsx:54`** — Second `useEffect` OAuth callback handler: authenticated user on `/` redirects to `/my-books`
3. **`LandingPage.jsx:564`** — Inline auth modal on landing page: successful login redirects to `/my-books`

`AuthPage.jsx` already calls `navigate('/home')` on success (line 43), but `App.jsx`'s routing guards intercept and override that destination. The OAuth flow is most affected: after Google sign-in, Supabase redirects back to `/`, triggering the second effect and sending the user to `/my-books`.

## Files to Modify

Only two files, three lines total:

### `client/src/App.jsx`

**Line 40** — Change the `/auth` → post-login redirect:
```diff
-      navigate('/my-books');
+      navigate('/home');
```

**Line 54** — Change the OAuth callback `/` → post-login redirect:
```diff
-    navigate('/my-books');
+    navigate('/home');
```

### `client/src/LandingPage.jsx`

**Line 564** — Change the inline modal login redirect:
```diff
-                  navigate('/my-books');
+                  navigate('/home');
```

## Risk Assessment

- **Home page accessibility**: `/home` is already rendered for authenticated users in the `App.jsx` switch statement (line 122-127). It uses `useAuth()` and fetches user-specific data. No new permissions needed.
- **Unauthenticated access to `/home`**: Currently allowed (no auth guard in the switch). This is pre-existing behavior and not changed by this fix.
- **My Books access**: Still fully accessible via sidebar nav links and direct `/my-books` URL. Not affected.
- **OAuth flow**: After changing line 54, OAuth callbacks landing on `/` will now go to `/home` instead of `/my-books`. This is the intended behavior.
- **Existing `/auth` redirect**: AuthPage.jsx line 43 already calls `navigate('/home')`. The App.jsx line 40 change is a safeguard for edge cases (e.g., page refresh while on `/auth` with an active session).

## Validation Steps

1. Open Landing Page while logged out → see `/`
2. Click Login → navigate to `/auth`
3. Log in with email/password → confirm redirect to `/home`
4. Log out, click "Continue with Google" → confirm redirect to `/home` after OAuth
5. Sign up new account → confirm redirect to `/home`
6. Log in via Landing Page inline auth modal → confirm redirect to `/home`
7. Refresh `/home` while logged in → session remains valid, page loads
8. Navigate to `/my-books` from sidebar → still works
9. Log out → redirects to `/auth` or `/` as before
10. Run `npm run build` in `client/` → passes

## Out of Scope

- No changes to My Books page or functionality
- No changes to Home page content or layout
- No changes to authentication APIs or backend
- No changes to protected route configuration
- No changes to logout behavior
- No changes to Audio Library or other routes
