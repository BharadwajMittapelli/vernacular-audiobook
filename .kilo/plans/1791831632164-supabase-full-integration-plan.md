# Supabase Full Integration Plan for Vernacular Audiobook

## Current State Analysis

**Supabase Project**: `vernacualr-audiobook` (sgpkxgwnxusjagjnesir) - ACTIVE_HEALTHY in ap-northeast-1
- **Database**: Empty (no tables)
- **Storage**: Empty (no buckets)
- **Project URL**: https://sgpkxgwnxusjagjnesir.supabase.co
- **Anon Key**: Retrieved ✓
- **Service Role Key**: **MISSING** - must be obtained from Supabase Dashboard > Settings > API

**Existing Codebase**:
- 4 SQL migrations in `server/migrations/` (001-004) - NOT YET APPLIED
- Server uses `@supabase/supabase-js` with service role key (server/src/config/supabase.js)
- Storage bucket name configured as `audiobook` (AUDIO_BUCKET constant)
- All DB operations route through server API - frontend never calls Supabase directly
- Auth is stubbed (hardcoded mock user ID)

---

## Implementation Tasks

### Phase 1: Database Schema (Migrations)
**Apply 4 existing migrations in order:**

| Migration | Purpose | Tables/Functions Created |
|-----------|---------|-------------------------|
| 001_align_audio_generations.sql | Align audio_generations with schema | `audio_generations` columns, indexes |
| 002_ledger_deduct_refund.sql | Credit ledger with atomic RPCs | `users`, `credit_transactions`, `deduct_credits()`, `refund_credits()` |
| 003_add_audio_path.sql | Storage path for signed URLs | `audio_path` column on audio_generations |
| 004_async_queue_support.sql | Async bulk synthesis | `books` table, `book_id` FK, `get_user_balance()`, `increment_book_completion()`, `mark_book_failed()` |

**Action**: Execute all 4 migrations via Supabase SQL Editor or MCP `apply_migration`.

---

### Phase 2: Storage Bucket
**Create bucket: `audiobook`**

Configuration per PROJECT_DOCUMENTATION.md security requirements:
- **Privacy**: Private (no public access)
- **File size limit**: 50MB (sufficient for audio chapters)
- **Allowed MIME types**: `audio/mpeg`, `audio/wav`, `audio/mp3`
- **Path structure**: `audiobook/{chapterId}/{uuid}.{ext}`

**RLS Policies needed**:
```sql
-- Only service_role can insert/update/delete
CREATE POLICY "Service role full access" ON storage.objects
  FOR ALL USING (auth.role() = 'service_role');

-- Anon/authenticated can only read via signed URLs (handled by server)
-- No direct SELECT policy needed - server generates signed URLs
```

---

### Phase 3: Row Level Security (RLS) Policies
**Enable RLS on all tables + policies for user data isolation:**

```sql
-- users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own balance" ON public.users
  FOR SELECT USING (auth.uid() = id);
-- Service role has full access via RLS bypass

-- audio_generations
ALTER TABLE public.audio_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own generations" ON public.audio_generations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own generations" ON public.audio_generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON public.audio_generations
  FOR ALL USING (auth.role() = 'service_role');

-- credit_transactions
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own transactions" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON public.credit_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- books
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own books" ON public.books
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own books" ON public.books
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON public.books
  FOR ALL USING (auth.role() = 'service_role');
```

**Note**: Server uses `service_role` key which bypasses RLS. Policies protect against anon/authenticated direct access.

---

### Phase 4: Environment Configuration

**server/.env** (update with actual values):
```env
GNANI_API_KEY_ID=your_gnani_api_key_here
SUPABASE_URL=https://sgpkxgwnxusjagjnesir.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<FROM_DASHBOARD>
PORT=4001
FRONTEND_URL=http://localhost:5175
TTS_PROVIDER=gtts
GTTS_FALLBACK_ENABLED=true
SUPABASE_BUCKET_NAME=audiobook
```

**client/.env** (add Supabase client config if needed):
```env
VITE_API_URL=http://localhost:4001
VITE_SUPABASE_URL=https://sgpkxgwnxusjagjnesir.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNncGt4Z3dueHVzamFnam5lc2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MjMxOTMsImV4cCI6MjEwNzM5OTE5M30.6sVjDGpwQYtiRfRu9xQy0h1c2-Zucvf3pgY7rEKqeAA
```

**Critical**: Service role key NEVER goes in client/.env or frontend code.

---

### Phase 5: Auth Middleware Upgrade (Future)
Current: Hardcoded mock user ID
Required: JWT verification from eKithab
- Add `EKITHAB_JWT_SECRET` to server/.env
- Implement `authMiddleware` to verify JWT and extract `req.user.id`
- Remove stub fallback

---

### Phase 6: Validation & Testing

**Database Verification**:
- [ ] All 4 tables exist with correct columns
- [ ] All 5 RPC functions exist and are executable by service_role only
- [ ] Unique indexes on idempotency_key, email
- [ ] Foreign keys: book_id → books.id, user_id → users.id

**Storage Verification**:
- [ ] Bucket `audiobook` exists, private
- [ ] Server can upload audio buffer → returns signed URL
- [ ] Signed URL works for playback (1h TTL)

**API Integration Tests**:
- [ ] POST /api/audio/synthesize - creates generation, deducts credits, returns signed URL
- [ ] GET /api/audio/:chapterId - returns fresh signed URL
- [ ] POST /api/audio/synthesize-async - creates book, queues chapters
- [ ] GET /api/storefront/embed/:generationId - public, no auth, signed URL
- [ ] Idempotency: duplicate Idempotency-Key returns existing without double charge
- [ ] Credit atomicity: concurrent requests respect balance

**Security Verification**:
- [ ] Anon key cannot read users, audio_generations, credit_transactions, books directly
- [ ] Service role can perform all operations
- [ ] Storage objects not publicly accessible
- [ ] No secrets in client bundle

---

## Manual Actions Required from User

1. **Get Service Role Key**: Go to Supabase Dashboard > Project `vernacualr-audiobook` > Settings > API > Service Role Key (secret)
2. **Apply Migrations**: Run 4 migration files in order via SQL Editor or provide permission for MCP to apply
3. **Create Storage Bucket**: Create `audiobook` bucket via Dashboard > Storage or provide permission for MCP
4. **Configure RLS**: Run RLS policy SQL via SQL Editor

---

## Dependencies & Risks

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Service Role Key | Cannot proceed without it | User must provide from Dashboard |
| Gnani API Key | Synthesis fails without it | Already in server/.env.example placeholder |
| RLS Policies | Data exposure if misconfigured | Test with anon key after setup |

---

## Rollback Plan
- Migrations are IF NOT EXISTS / IF EXISTS safe to re-run
- Bucket can be deleted and recreated
- .env files can be reverted to placeholders
- No destructive operations on existing data (DB is empty)

---

## Success Criteria
1. All 4 migrations applied successfully
2. `audiobook` bucket created, private, with correct limits
3. RLS policies active on all 4 tables
4. server/.env has valid SUPABASE_SERVICE_ROLE_KEY
5. client/.env has valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
6. Server starts without "Missing Supabase environment variables" error
7. POST /api/audio/synthesize returns valid signed audio URL with alignment
8. GET /api/storefront/embed/:id works without auth
9. Credits deducted atomically, refunds work on failure

---

## Open Questions for User

1. **Service Role Key**: Can you provide it, or should I guide you to retrieve it from Dashboard?
2. **Migration Execution**: Should I apply via MCP `apply_migration`, or will you run them in SQL Editor?
3. **Bucket Creation**: Should I create via MCP, or will you create in Dashboard?
4. **RLS Policies**: Apply via MCP SQL, or manual in Dashboard?
5. **Auth**: Keep stub for now, or implement JWT verification now?