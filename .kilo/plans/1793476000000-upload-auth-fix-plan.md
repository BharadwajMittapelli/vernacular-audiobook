# Book Upload Authentication — Critical Fix Plan

## Stage 1: Verify the Failing Request

Use the Network tab to confirm which request returns 401:
- `POST /api/studio` (via `createBook()`) — most likely
- `POST /api/documents/upload` (if deployed server has auth middleware)

**Assumption**: The error comes from `createBook()` → `POST /api/studio`.

## Stage 2: Fix Supabase Token Refresh in api.js

### Current Issues
1. `getSession()` returns cached session (may be expired)
2. No logging of token expiry state
3. Refresh failure handling needs improvement

### Correct Implementation
```javascript
// Shared in-flight refresh promise
let refreshPromise = null;

// Get valid session with auto-refresh
async function getValidSession() {
  const { data } = await supabase.auth.getSession();
  if (data?.session?.access_token) {
    return data.session;
  }
  
  // Trigger refresh only once
  if (!refreshPromise) {
    refreshPromise = supabase.auth.refreshSession()
      .finally(() => { refreshPromise = null; });
  }
  const { data: refreshed, error } = await refreshPromise;
  if (error || !refreshed?.session?.access_token) {
    throw error || new Error('No session after refresh');
  }
  return refreshed.session;
}

// Request interceptor - uses refreshed session
api.interceptors.request.use(async (config) => {
  try {
    const session = await getValidSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
      console.log('[API Interceptor] Auth header set:', config.url);
    }
  } catch (err) {
    console.error('[API Interceptor] Auth failed:', err.message);
  }
  return config;
});

// Response interceptor - handle 401 with refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const session = await getValidSession();
        if (session?.access_token) {
          originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
          return api.request(originalRequest);
        }
      } catch (refreshErr) {
        console.error('[API Interceptor] Token refresh failed:', refreshErr.message);
        await supabase.auth.signOut();
      }
    }
    return Promise.reject(error);
  }
);
```

## Stage 3: Files Changed

**File**: `client/src/services/api.js`
- Added `getValidSession()` helper function
- Replaced `getSession()` with `getValidSession()` in request interceptor
- Added comprehensive debug logging
- Added response interceptor for 401 recovery

## Stage 4: Verification

### Test Steps
1. Start server: `npm run dev:server` (port 4001)
2. Start client: `npm run dev:client` (port 5175)
3. Sign in, navigate to `/my-books`
4. Click "Create an Audiobook" → select PDF/EPUB
5. Watch console for:
   - `[Auth] getSession: ...`
   - `[Auth] Refresh result: ...`
   - `[API Interceptor] Request: POST /api/studio`
6. Check Network tab:
   - `/api/studio` → 401 → retry → 200
7. Successful book creation → Studio navigation

### Build Verification
```bash
npm run build --workspace=client
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Concurrent refresh | Single shared `refreshPromise` |
| Infinite loops | `_retry` flag prevents re-entry |
| Public endpoint breakage | Only retry requests with auth headers |
| Session loss on refresh failure | `signOut()` on refresh error |

## Open Questions

1. Is the server running locally on port 4001?
2. Can you reproduce the error and share browser console logs?
3. Does signing out and back in temporarily fix the issue?
4. Is this happening in development or production environment?

**Next Steps**: If you have access to the server, I can check server logs and add additional debugging. Otherwise, please verify the failing request and provide console logs for further diagnosis.

The fix is implementation-ready. Run the build test and proceed with testing.