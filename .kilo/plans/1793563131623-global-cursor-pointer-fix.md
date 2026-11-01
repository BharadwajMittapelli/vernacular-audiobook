# Global Cursor Pointer Fix — Final Plan

## Problem
Clickable elements (buttons, links, tabs, sliders, ARIA controls) show default arrow cursor instead of pointer across all pages.

## Root Cause
No global CSS rule sets `cursor: pointer` on interactive elements. Individual components sometimes use the `cursor-pointer` Tailwind class, but this is inconsistent — many native interactive elements rely on implicit browser defaults which vary by element type.

## Solution
Add cursor rules to the existing `@layer base` block in `client/src/index.css`.

### File to modify
- `client/src/index.css` (only file)

### Change
Add the following rules inside the existing `@layer base` block (after the `body` rule, before the closing brace):

```css
button:not(:disabled),
a[href],
input[type="range"],
[role="button"]:not([aria-disabled="true"]):not(:disabled),
[role="tab"] {
  cursor: pointer;
}
```

### Selector breakdown
| Selector | Covers | Excludes |
|----------|--------|----------|
| `button:not(:disabled)` | All `<button>` elements (sidebar nav, action buttons, form submits) | Disabled buttons |
| `a[href]` | All anchor links with `href` (nav links, external links) | Empty `<a>` tags used as layout containers |
| `input[type="range"]` | All range sliders (playback progress, volume, speed controls) | — |
| `[role="button"]:not([aria-disabled="true"]):not(:disabled)` | Custom ARIA buttons (e.g., TranscriptHighlighter sentence activators) | Disabled ARIA buttons via `aria-disabled="true"` or native `disabled` |
| `[role="tab"]` | Tab navigation elements | — |

### Why this works
- `@layer base` ensures these rules cascade below utility classes, so explicit `cursor-default` / `cursor-not-allowed` on specific elements still win.
- `:not(:disabled)` and `:not([aria-disabled="true"])` preserve the correct cursor on disabled elements.
- `a[href]` excludes empty `<a>` tags that may be used as layout containers.
- No other files need modification. No dependencies added. No UI changes.

## Interactive elements discovered in codebase

**Native buttons** (`button:not(:disabled)`):
- Sidebar navigation items (AppSidebar, HomeSidebar, AudioLibrarySidebar, MyBooksSidebar)
- Action buttons (BookCard, QuickActions, ContinueListening "View all", PlayerPanel controls)
- Form submits, modals, dropdowns

**Links** (`a[href]`):
- Landing page navigation links
- Any external/internal links

**Range inputs** (`input[type="range"]`):
- Playback progress sliders (GlobalPlayer, BottomPlayer, PlayerPanel)
- Playback speed selector

**ARIA buttons** (`[role="button"]`):
- TranscriptHighlighter sentence activators (line 71)

**Tabs** (`[role="tab"]`):
- Not currently used in codebase, but selector added per correction for future-proofing

**Clickable divs with explicit `cursor-pointer` class** (already work):
- ContinueListening book cards
- DownloadsView PackageRow
- AudioLibrarySidebar recent books
- ByBookView chapter rows

## Strict Modification Restrictions
- Modify only `client/src/index.css`
- Do not redesign or restyle any page
- Do not change layouts, colors, typography, spacing, animations, or component behavior
- Do not modify backend files, APIs, database, Supabase configuration, or authentication
- Do not add dependencies
- Do not refactor unrelated components

## Verification Checklist
Test cursor behavior in browser across all pages:
1. ✅ Enabled buttons display hand pointer
2. ✅ Disabled buttons retain default/not-allowed cursor
3. ✅ Navigation links and sidebar links display hand pointer
4. ✅ Navigation tabs (if any) display hand pointer
5. ✅ Range sliders display hand pointer
6. ✅ ARIA buttons (TranscriptHighlighter) display hand pointer
7. ✅ Disabled ARIA buttons do not display hand pointer
8. ✅ Non-interactive text, containers, and cards retain normal cursor
9. ✅ Pages verified: Home, Dashboard, Studio, My Books, Audio Library, All Audio, By Book, Favorites, Downloads, Settings

## Required Completion Report
After implementation, report:
- Exact file modified: `client/src/index.css`
- CSS selectors added
- Browser verification results
- Confirmation no unrelated functionality or styling changed