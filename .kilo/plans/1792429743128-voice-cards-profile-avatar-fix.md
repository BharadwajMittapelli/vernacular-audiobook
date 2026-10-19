# Plan: Fix Voice Cards and Profile Avatar

## Context
Project: Ekithab AI / Vernacular Audiobook
Working directory: /Users/vamshikrishna/vernacular-audiobook

Inspected components:
- `client/src/components/studio/VoiceSelector.jsx` – controls voice card layout, language filters, selection and preview. Currently uses `grid grid-cols-2 gap-2`. Voice name has `truncate`.
- `client/src/components/layout/TopBar.jsx` – top-right profile avatar button uses `bg-primary/10 text-primary hover:bg-primary/20` with `h-8 w-8 rounded-full`.
- Design tokens: `--terracotta: 19 40% 52%`, `--terracotta-foreground: 0 0% 100%`. Tailwind `terracotta` mapped to `hsl(var(--terracotta))`.
- VoiceSelector used in `AudioConfigModal.jsx` and `Dashboard.jsx` right audio settings panel `w-[320px] shrink-0 overflow-y-auto`.

## Objectives
Issue A – Voice Cards
1. Single-column vertical list, cards occupy full panel width.
2. Full voice name and description readable, no truncation.
3. Preview button aligned right.
4. Preserve terracotta selected styling and neutral unselected styling.
5. Preserve language filters, voice selection, preview behavior, API data usage.
6. Preserve panel scrolling, prevent horizontal overflow.

Issue B – Profile Avatar
1. Replace purple primary background with terracotta design token.
2. White initials.
3. Keep circular shape and `h-8 w-8` dimensions.
4. Preserve user info, click behavior, auth integration.
5. Do not change global `--primary`.

Constraints: preserve Phase 1-7 work, no backend/API/Supabase/env changes, no new dependencies, no git ops, no unrelated component changes.

## Files to modify
- `client/src/components/studio/VoiceSelector.jsx`
- `client/src/components/layout/TopBar.jsx`

## Proposed changes

### VoiceSelector.jsx
- Layout container:
  - Replace `className="grid grid-cols-2 gap-2"` with single-column layout: `className="grid grid-cols-1 gap-2"` or `flex flex-col gap-2`. Grid-cols-1 ensures each card occupies available panel width.
- Card content:
  - Remove `truncate` from voice name `<div className="text-sm font-medium truncate">` → `text-sm font-medium`.
  - Keep `min-w-0 flex-1` on text wrapper to allow wrapping. Text will wrap naturally.
  - Change card flex alignment from `items-center` to `items-start` to keep preview button right-aligned and vertically stable when name wraps.
  - Preview div remains `shrink-0` at end, aligning right.
- Styling preservation:
  - Keep selected classes: `border-terracotta bg-terracotta/5`, initials `bg-terracotta`.
  - Change selected initials text color from `text-background` to `text-terracotta-foreground` to provide white contrast using existing terracotta foreground token.
  - Keep unselected classes unchanged: initials `bg-muted text-muted-foreground`, card `border-border bg-card`.
- Language filter and selection logic untouched. API data used via `getVoices(language)`.

Overflow guard:
- Panel parent already `overflow-y-auto scrollbar-thin`. Single column removes horizontal constraint. Ensure card `max-w-full` implicit via grid.

### TopBar.jsx
- Avatar button:
  - Current classes: `h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold`
  - Change to terracotta token with white initials:
    - `bg-terracotta text-terracotta-foreground hover:bg-terracotta/90`
    - Preserve `h-8 w-8 rounded-full text-xs font-semibold`
  - Do not alter `variant="ghost" size="icon"` props; Tailwind classes override.
  - Keep `onClick` signOut and initials calculation unchanged.
- No change to `--primary` CSS variable.

## Decisions
- Use existing Tailwind `terracotta` token, not create new color.
- Use `text-terracotta-foreground` for selected voice initials to ensure white contrast.
- Keep initials generation logic unchanged.
- Do not modify `VoiceSelector` props interface.
- Grid-cols-1 is minimal change vs rewriting to flex; preserves `role="listbox"` semantics.
- Verify layout in both Dashboard right panel and AudioConfigModal modal.

## Risks / Edge cases
- Long voice names may increase card height; preview button remains right-aligned but vertical centering may shift. Acceptable per requirement.
- Changing selected initials text from `text-background` to `text-terracotta-foreground` improves contrast and uses existing token; verify no regression in other terracotta usages.
- Avatar hover state with terracotta may be slightly darker; `hover:bg-terracotta/90` provides feedback without introducing new token.
- Verify no horizontal overflow in Dashboard `w-[320px]` panel and AudioConfigModal `max-w-md` with wrapped names.

## Validation plan
- Voice cards render in one column in Dashboard right panel `w-[320px]` and AudioConfigModal `max-w-md`.
- Full voice name and `gender · accent` description readable without truncation; long names wrap to multiple lines.
- Preview Play button visually right-aligned on each card and remains aligned on wrap.
- Language filter tabs still filter `shown` list and call `onLanguageChange`.
- Voice selection updates `selectedVoice` and triggers `onSelect`.
- Panel scroll works, no horizontal overflow in both layouts.
- Selected voice initials use `bg-terracotta text-terracotta-foreground` for white contrast.
- TopBar avatar shows terracotta background, white initials via `text-terracotta-foreground`, circular `32x32px`.
- Clicking avatar still signs out; auth integration unchanged.
- Responsive behavior verified; no horizontal scrollbar appears.
- Frontend production build passes `npm run build` with no type/lint errors.

## Out of scope
- Backend API changes.
- Adding new dependencies.
- Changing global `--primary` color.
- Modifying unrelated components.

## Open questions
None; implementation parameters confirmed from inspected code.
