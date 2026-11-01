# Set Bookshelf Default View to List Layout

## Current State
- `MyBooks.jsx` line 40: `const [viewMode, setViewMode] = useState('grid');`
- Grid/List toggle buttons exist at lines 231-255 with active-state styling
- Both view layouts are fully implemented:
  - Grid view (line 287-298): Uses `BookCard` component
  - List view (line 299-342): Inline horizontal rows with thumbnail, title, chapter count, status, Open, Share, Delete

## Change Required
**File:** `client/src/pages/MyBooks.jsx`  
**Line 40:** Change initial state from `'grid'` to `'list'`

```jsx
// Before
const [viewMode, setViewMode] = useState('grid');

// After
const [viewMode, setViewMode] = useState('list');
```

## Persistence Behavior
- No localStorage persistence for `viewMode` exists in the codebase
- The change makes List View the default for all users on initial load
- User's toggle selection persists during session (React state)
- On page refresh, List View will be shown again (new default)

## Validation Checklist
- [ ] Opening Bookshelf (`/my-books`) initially displays horizontal list rows
- [ ] The List View toggle button is selected/active by default
- [ ] Clicking Grid View switches to existing grid layout (BookCard grid)
- [ ] Clicking List View switches back to horizontal rows
- [ ] Search continues working in both views
- [ ] Tabs (Bookshelf, Recent, Shared, Favorites) continue working
- [ ] Open button navigates to book reader
- [ ] Share button opens ShareDialog
- [ ] Delete button (X icon) works with confirmation
- [ ] Page refresh shows List View by default
- [ ] No horizontal overflow or console errors

## Files to Change
- `client/src/pages/MyBooks.jsx` (1 line change)