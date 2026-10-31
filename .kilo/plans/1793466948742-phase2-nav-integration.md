# Ekithab AI — Phase 2: Global Navigation & Cross-Page Integration

## 1. Current State Inspection

### Routes
| Route | Component | Data Context |
|---|---|---|
| `/` | `LandingPage` | Public |
| `/home` | `Home` | Authenticated |
| `/my-books` | `MyBooks` | Authenticated |
| `/recent` | (New) | Authenticated |
| `/` (w/ query) | `Dashboard` | Authenticated |
| `/audio-library` | `AudioLibrary` | Authenticated |
| `/settings` | `Settings` | Authenticated |

### Navigation
- `App.jsx` handles routing manually.
- `Sidebar` components are duplicated (one for MyBooks, AudioLibrary, Settings, and now Home).
- Studio (Dashboard) uses a complex sidebar that manages local chapter-selection state.

## 2. Revised Architecture Plan

### Unified Layout (`AppLayout`)
- `AppLayout` will contain `AppSidebar` and `AppTopBar`.
- `AppSidebar` will render standard navigation (Home, My Books, Recent, Studio, Audio Library, Settings).
- `AppLayout` will provide a `SidebarContent` slot for contextual content (e.g., the Studio chapter list).

### StudioChapterPanel
- Instead of polluting `AppSidebar` with Studio logic, `AppLayout` will accept a `contextualSidebar` prop. When present, it replaces the sidebar content or appends to it.

### Recent Page (`pages/Recent.jsx`)
- Fetches `getAllLibraryAudio()` data.
- Sorts by `createdAt` desc.
- Displays as a list of recently generated/finalized audio chapters.
- Does NOT fabricate listening history.

### App.jsx
- Wrap authenticated routes in `AppLayout` instead of just returning pages.
- Standardize all navigation to use `navigate()` from `NavigateContext`.

### Data Flow
- **Credits:** Fetch once in `AppLayout` (or `App` level) and pass to sidebar to prevent duplicate API calls.
- **State:** Use existing state where possible; do not introduce new state management libs.

## 3. Revised Implementation Steps

1.  **Create Shared UI:** `AppSidebar.jsx`, `AppTopBar.jsx`, `AppLayout.jsx`.
2.  **Create Recent Page:** `Recent.jsx` using `getAllLibraryAudio()`.
3.  **Refactor Pages:** Update `Home.jsx`, `MyBooks.jsx`, `AudioLibrary.jsx`, `Settings.jsx` to use `AppLayout`.
4.  **Adapt Studio:** Refactor `Dashboard.jsx` to use `AppLayout` and inject the chapter list as a contextual panel.
5.  **Clean up:** Remove duplicate sidebar components (`HomeSidebar.jsx`, `MyBooksSidebar.jsx`, etc.).

## 4. Verification
- Validate navigation states across all 6 pages.
- Check responsive behavior of the mobile drawer.
- Verify Studio chapter-list context persists in `AppLayout`.
- Build and verify via `npm run build`.

---

## Decisions Pending Approval

1. **Contextual Sidebar:** Does the proposed `contextualSidebar` injection into `AppLayout` satisfy the Studio requirement? (Recommended: Yes, it keeps the sidebar clean while allowing Studio's complex state).
2. **Recent Page Data:** Is `getAllLibraryAudio()`'s chapter list the acceptable data source for the "Recent" page? (Recommended: Yes, it's the only verified recent activity data available).
3. **Sidebar Consolidation:** Shall we delete the old duplicate sidebars after integration? (Recommended: Yes, to maintain a single source of truth).
