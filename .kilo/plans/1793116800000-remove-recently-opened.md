# Remove the "Recently opened" Section Completely

## Objective
Remove the entire "Recently opened" section from the My Books page (`/my-books`).

## Verification Complete
Searched codebase — confirmed `RecentlyOpenedCard` and `recentlyOpened` are **only used in `MyBooks.jsx`**:
- No other component imports `RecentlyOpenedCard`
- No other computation references `recentlyOpened`
- Component file `RecentlyOpenedCard.jsx` can remain (unused but harmless)

## Files to Change
**Only:** `client/src/pages/MyBooks.jsx`

## Changes (3 edits)

### 1. Remove Import (Line 11)
```diff
- import { RecentlyOpenedCard } from '../components/books/RecentlyOpenedCard.jsx';
```

### 2. Remove Computation (Lines 153-156)
```diff
- const recentlyOpened = [...books]
-   .filter(b => b.last_opened_at)
-   .sort((a, b) => new Date(b.last_opened_at) - new Date(a.last_opened_at))
-   .slice(0, 5);
```

### 3. Remove JSX Block (Lines 445-464)
Remove entire conditional block:
```jsx
{/* Recently opened — only when books exist and on bookshelf/recent tabs */}
{(activeTab === 'bookshelf' || activeTab === 'recent') && recentlyOpened.length > 0 && (
  <div className="mb-8">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-foreground">Recently opened</h2>
      <button className="text-sm text-terracotta font-medium hover:underline">
        View all →
      </button>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {recentlyOpened.map((book) => (
        <RecentlyOpenedCard
          key={book.id}
          book={book}
          onOpen={() => navigate(`/?bookId=${book.id}`)}
        />
      ))}
    </div>
  </div>
)}
```

## Impact Assessment
| Aspect | Before | After |
|--------|--------|-------|
| Page sections | Bookshelf + Recent tabs + Recently opened | Bookshelf + Recent tabs |
| Components imported | 9 components | 8 components |
| State variables | 8 state vars | 7 state vars |
| Backend API calls | Same | Same |
| Database records | `last_opened_at` still stored | `last_opened_at` still stored (unchanged) |

**No functionality removed** — Bookshelf and Recent tabs remain fully functional. Users can still access recent books via the Recent tab.

## Validation Checklist
- [ ] "Recently opened" heading removed from DOM
- [ ] "View all →" button removed
- [ ] Book cards with Open buttons removed
- [ ] No blank space at bottom of page
- [ ] Bookshelf tab renders correctly
- [ ] Recent tab renders correctly  
- [ ] Search works
- [ ] Grid/List toggle works
- [ ] Open button on book cards works
- [ ] Share button works
- [ ] Delete button works (CORS fix from earlier)
- [ ] No console errors
- [ ] `npm run build` passes

## Risk Assessment
- **Low risk:** Pure UI removal, no logic changes
- **No data loss:** Database field `last_opened_at` untouched
- **No breaking changes:** Tabs and navigation unchanged
- **Component file preserved:** `RecentlyOpenedCard.jsx` remains (can be deleted later if desired)

## Build Command
```bash
cd client && npm run build
```
