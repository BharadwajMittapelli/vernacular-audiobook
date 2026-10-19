# Plan: Fix TopBar Toolbar Alignment

## Root Cause
`TopBar.jsx` line 25 uses `justify-between` with two children:
1. Menu button (`lg:hidden` — invisible on desktop)
2. Controls div (New Upload, Configure, Notifications, Profile)

On desktop, the invisible menu button means `justify-between` collapses to `flex-start`, placing controls at the left edge.

## Fix
Add `ml-auto` to the controls container div on line 34.

## File to Modify
`client/src/components/layout/TopBar.jsx`

## Change
Line 34:
```jsx
// Before
<div className="flex items-center gap-2 shrink-0">

// After
<div className="flex items-center gap-2 shrink-0 ml-auto">
```

Single class addition. No other changes needed.

## Validation
- New Upload, Configure, Notifications, Profile all appear at far-right corner
- Sidebar unchanged
- Terracotta avatar preserved
- Button order: New Upload → Configure → Notifications → Profile (unchanged)
- No horizontal overflow
- Responsive behavior preserved

## Build
```bash
cd /Users/vamshikrishna/vernacular-audiobook/client && npm run build
```
