# My Books & Recent Reorganization - Implementation Plan

## A. Current Architecture

### Data Model (Supabase)
- **books table**: `id`, `user_id`, `title`, `cover_url`, `total_chapters`, `completed_chapters`, `status` ('pending'|'processing'|'completed'|'failed'), `created_at`, `last_opened_at`, `language`, `audio_profile`
- **chapters table**: `id`, `book_id`, `user_id`, `sequence_number`, `title`, `text_content`, `char_count`, `status` ('pending'|'processing'|'completed'|'failed'), `language`
- **audio_generations table**: Links to chapters/books, stores audio URLs
- **downloads table**: Export history

### Current Data Flow
```
Upload document → createBook() → POST /api/studio → books.status='pending'
     ↓
Studio opens → User clicks "Synthesize" → books.status='processing'
     ↓
Audio generation completes → chapters.status='completed' → books.completed_chapters++
     ↓
All chapters done → books.status='completed'
     ↓
Storefront share link works (only for status='completed')
```

### Current UI Tabs (My Books)
- **Bookshelf**: First 5 books (by created_at desc)
- **Recent**: Remaining books (by created_at desc)  
- **Shared**: Placeholder
- **Favorites**: Placeholder

### Current Recent Page (`/recent`)
- Uses `getAllLibraryAudio()` → `/api/library/all-audio`
- Shows **chapters** with completed audio, not books
- Each row = one chapter with audio

### Current "Publish" Button (EXISTING - NON-FUNCTIONAL)
- ActionCard "Publish" button → opens ShareDialog
- ShareDialog creates share link via storefront
- **NO actual publishing state change** - just shares existing completed book
- ShareDialog is a sharing mechanism, NOT a publishing operation

---

## B. Proposed Architecture

### New Book Status Values
Add `'published'` to books.status enum (free-text column, no constraint):
- `pending` → `processing` → `completed` → `published`

### Data Classification
| Classification | Criteria | Appears In |
|---|---|---|
| **Uploaded/Generated** | status IN ('pending','processing','completed') | Recent page |
| **Published** | status = 'published' | Bookshelf (My Books), Storefront |
| **Shared** | Has active share link | Shared tab (future) |
| **Favorites** | User favorited | Favorites tab (future) |

### New Flow
```
UPLOAD → createBook() → status='pending'
     ↓
STUDIO → synthesize → status='processing' → 'completed'
     ↓
RECENT page shows book (activity)
     ↓
PUBLISH button → status='published' (NEW actual backend operation)
     ↓
BOOKSHELF shows book + Storefront accessible
```

---

## C. Existing vs Missing vs New Functionality

### EXISTING (Working)
| Feature | Implementation |
|---|---|
| Book upload & creation | `POST /api/studio` → `books.status='pending'` |
| Audio generation | `POST /api/studio/:bookId/synthesize-all` |
| Chapter synthesis | `POST /api/studio/chapters/:chapterId/synthesize` |
| Storefront share links | `GET /api/storefront/book/:bookId` (filters `status='completed'`) |
| Book listing | `GET /api/studio` returns all user books |
| Book deletion | `DELETE /api/studio/:bookId` |

### MISSING (Needs Implementation)
| Feature | Description |
|---|---|
| **Actual Publish Operation** | No backend endpoint to change book status to 'published' |
| **Publish API endpoint** | `POST /api/studio/:bookId/publish` does not exist |
| **Publish button wiring** | Current button opens ShareDialog instead of calling publish |
| **Published books query** | No filter for `status='published'` in Bookshelf |

### NEW (To Be Implemented)
| Feature | Description |
|---|---|
| **Publish endpoint** | `POST /api/studio/:bookId/publish` - validates, updates status |
| **Publish button handler** | Replaces ShareDialog with actual publish call |
| **Bookshelf filter** | Show only `status='published'` books |
| **Recent page rewrite** | Show books (not chapters) with activity status |
| **Published at timestamp** | Optional `published_at` column |

---

## D. Database & API Compatibility

### Critical Constraint: Do Not Break `status='completed'`
Storefront and existing workflows expect `status='completed'` for:
- Audio generation completion
- Storefront share links (public access)
- Book export functionality

### Publishing Must Be Additive
- `published` is a **new status value** added to existing enum
- `completed` books remain `completed` unless explicitly published
- No existing records modified automatically
- User explicitly clicks Publish to transition `completed` → `published`

### Storefront Integration
Current Storefront filters: `status='completed'` (line 89 in storefrontRoutes.js)
After migration: Storefront should filter `status IN ('completed', 'published')`
OR keep as-is and only published books get storefront access via explicit publish action

---

## E. File-by-File Implementation Plan

### 1. Database Migration (New File)
**File**: `server/migrations/011_add_published_status.sql`
```sql
-- Add published_at timestamp for tracking publication time
ALTER TABLE public.books 
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Index for efficient published books query
CREATE INDEX IF NOT EXISTS books_status_published_idx 
  ON public.books (status) WHERE status = 'published';
```

### 2. API Service (`client/src/services/api.js`)
**Add**: `publishBook(bookId)` function
```javascript
export function publishBook(bookId) {
  return api.post(`/api/studio/${bookId}/publish`).then((res) => res.data);
}
```

### 3. Server Route (`server/src/routes/studioRoutes.js`)
**Add**: `POST /:bookId/publish` endpoint (after line ~691, before export)
```javascript
// POST /:bookId/publish — publish a completed book
router.post('/:bookId/publish', async (req, res) => {
  try {
    const { bookId } = req.params;
    
    // Validate book exists and belongs to user
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, status')
      .eq('id', bookId)
      .eq('user_id', req.user.id)
      .single();
    
    if (bookError || !book) {
      return res.status(404).json({ success: false, error: 'Book not found' });
    }
    
    // Only completed books can be published
    if (book.status !== 'completed') {
      return res.status(400).json({ 
        success: false, 
        error: 'Only completed books can be published' 
      });
    }
    
    // Update to published
    const { data: updated, error: updateError } = await supabase
      .from('books')
      .update({ 
        status: 'published',
        published_at: new Date().toISOString()
      })
      .eq('id', bookId)
      .eq('user_id', req.user.id)
      .select('*')
      .single();
    
    if (updateError) throw updateError;
    
    res.json({ success: true, book: updated });
  } catch (error) {
    console.error('POST /studio/:bookId/publish error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

### 4. My Books Page (`client/src/pages/MyBooks.jsx`)
**Changes**:
- Remove 'recent' from TABS array: `const TABS = ['bookshelf', 'shared', 'favorites'];`
- Remove recentBooksFull logic (lines 188-190)
- Bookshelf filter: `books.filter(b => b.status === 'published')` (or all completed if no published yet)
- Remove Recent tab button from tabs rendering
- Update Publish ActionCard: replace `onShare` with `onClick={handlePublish}`
- Add `handlePublish` function that calls `publishBook()` and refreshes

### 5. Recent Page (`client/src/pages/Recent.jsx`)
**Changes**:
- Replace `getAllLibraryAudio()` with `getBooks()` (or new `getRecentBooks()`)
- Filter: `books.filter(b => ['pending','processing','completed'].includes(b.status))`
- Sort by `last_opened_at` or `created_at` desc
- Display: book title, cover/initials, chapter count, status badge, date, "Open in Studio"
- Keep existing empty/loading states

### 6. BookCard (`client/src/components/books/BookCard.jsx`)
**Update**: Add 'published' to status badge
```javascript
function getStatusLabel(status) {
  switch (status) {
    case 'published': return 'Published';
    case 'completed': return 'Completed';
    // ... existing cases
  }
}
```

### 7. Storefront Route (`server/src/routes/storefrontRoutes.js`)
**Update**: Allow published books in share link (line 89)
```javascript
// Change from:
if (!book || book.status !== 'completed') {
  return res.status(404).json({ success: false, error: 'Not found' });
}
// To:
if (!book || !['completed', 'published'].includes(book.status)) {
  return res.status(404).json({ success: false, error: 'Not found' });
}
```

---

## F. Regression Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Existing completed books disappear from Bookshelf | Default: show `status IN ('completed','published')` until user publishes; or auto-migrate existing |
| Storefront breaks for existing shared links | Update Storefront to allow both 'completed' and 'published' |
| Recent page shows chapters instead of books | Rewrite to use `getBooks()` with client-side filter |
| Publish button still opens ShareDialog | Replace `onShare` with `onClick={handlePublish}` |
| BookCard doesn't show 'Published' badge | Update `getStatusLabel()` and `getStatusColor()` |

---

## G. Verification Plan

1. **Upload → Recent**: Upload PDF → appears in Recent page with "Uploaded" badge
2. **Generate Audio**: Synthesize chapters → book status='completed' → appears in Recent
3. **Publish**: Click Publish button → API call → book status='published' → appears in Bookshelf
4. **Bookshelf**: Only published books shown (or completed if none published yet)
5. **Storefront**: Published books accessible via share link
6. **Existing books**: Verify completed books still work, migrate or display correctly
7. **Tabs**: My Books has Bookshelf, Shared, Favorites (no Recent tab)
8. **Global Recent**: Sidebar Recent item shows uploaded/generated books
9. **Backward compatibility**: Existing completed books still synthesizable, exportable

---

## H. Open Questions (Requiring Decision)

1. **Migration of existing 'completed' books**: 
   - Option A: Auto-publish all existing completed books on migration
   - Option B: Show all completed+published in Bookshelf, require manual publish for new books
   - Option C: Require manual publish for all (cleaner but more work for users)

2. **Recent page data source**: 
   - Reuse `getBooks()` with client filter (simpler, no new endpoint)
   - New endpoint `GET /api/studio/recent` (cleaner, server-side filter)

3. **Published books in Recent**: 
   - Yes (activity view includes all activity including publication)

4. **Unpublish capability**: 
   - Out of scope for MVP, can add later

5. **Cover image**: 
   - Books don't have covers - use initials fallback (existing pattern)

---

## I. Approval Required

This plan requires:
- [ ] Database migration for `published_at` column + index
- [ ] New publish API endpoint (`POST /api/studio/:bookId/publish`)
- [ ] Storefront update to allow 'published' status
- [ ] My Books: Remove Recent tab, filter Bookshelf to published
- [ ] Recent page: Rewrite to show books with activity status
- [ ] Publish button: Wire to actual publish API (not ShareDialog)
- [ ] BookCard: Add 'Published' status badge

**Recommended First Step**: Database migration + publish endpoint + My Books tab removal + Recent page rewrite.