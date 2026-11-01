# My Books Functional Regression Fix Plan

## Root Cause Analysis

The commit `fb0f836` (feat(ui): improve My Books page) completely rewrote `client/src/pages/MyBooks.jsx` but introduced **two critical regressions**:

### 1. Missing BookUploader Rendering
- `BookUploader` component is imported (line 7) and `showUploader` state is managed (line 40)
- `showUploader` is set to `true` by:
  - "Create an Audiobook" ActionCard (line 149)
  - BookEmptyState "Upload a Document" button (line 176)
- **But**: No conditional rendering of `BookUploader` in the JSX return statement
- **Result**: Clicking upload buttons sets state but shows no UI

### 2. Missing Upload Handler Functions
- Previous version had `handleUpload`, `handleCloseUploader`, `handleDocumentLoaded` functions
- Current version only has `handleDocumentLoaded` (lines 99-114)
- **Missing**: `handleUpload` (sets `showUploader=true`), `handleCloseUploader` (sets `showUploader=false`)
- **Result**: No way to open/close the uploader modal

### 3. UI Structure Change
- Previous: Used `MyBooksSidebar` + `MyBooksTopBar` with `onUploadBook` prop
- Current: Uses `AppLayout` + `AppTopBar` (no upload button in top bar)
- **Current flow**: Upload happens via ActionCards and EmptyState button → sets `showUploader` → but no modal renders

## Files to Change

| File | Current State | Required Fix |
|------|---------------|--------------|
| `client/src/pages/MyBooks.jsx` | Missing `handleUpload`, `handleCloseUploader`; missing `BookUploader` rendering | Add handlers + conditional BookUploader rendering |

## Fix Implementation

### A. Add Missing Handler Functions
```javascript
const handleUpload = useCallback(() => {
  setShowUploader(true);
  setUploadError(null);
}, []);

const handleCloseUploader = useCallback(() => {
  setShowUploader(false);
  setUploadError(null);
}, []);
```

### B. Add BookUploader Rendering
Add at end of JSX (before ShareDialog):
```jsx
{showUploader && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleCloseUploader}>
    <div className="bg-background rounded-xl p-8 max-w-xl w-full mx-4 relative shadow-xl" onClick={(e) => e.stopPropagation()}>
      <button onClick={handleCloseUploader} className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">
        <X className="h-5 w-5" />
      </button>
      {uploadError && (
        <div className="mb-4 rounded-lg p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {uploadError}
        </div>
      )}
      <BookUploader onDocumentLoaded={handleDocumentLoaded} />
    </div>
  </div>
)}
```

## Verification Checklist

1. [ ] **Create an Audiobook** card opens file picker → upload works
2. [ ] **Upload a Document** button in empty state opens file picker → upload works
3. [ ] **Bookshelf** displays actual books from API (not zero)
4. [ ] **Recent tab** displays books not in bookshelf (not zero if books exist)
5. [ ] **Upload success** navigates to Studio (`/?bookId=${res.book.id}`)
6. [ ] **Cancel/Close** dismisses uploader modal
7. [ ] **Error states** show upload errors
8. [ ] **Existing functionality preserved**: Delete, Share, Search, View modes, Tabs

## Regression Risks

- **None**: Fixes only restore missing functionality from previous version
- **API**: `getBooks()`, `createBook()`, `deleteBook()` unchanged
- **Auth**: `useAuth` unchanged
- **Navigation**: `useNavigate` unchanged
- **UI**: Uses existing `BookUploader` component unchanged