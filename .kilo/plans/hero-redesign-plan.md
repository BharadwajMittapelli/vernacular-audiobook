# Home Page Hero Redesign Implementation Plan

## Context
Current hero is in `client/src/components/home/Hero.jsx`. `client/src/pages/Home.jsx` passes `userName` and `onUpload={() => navigate('/my-books')}` to Hero. The existing Upload action navigates to My Books, not open a modal. Hero currently renders a simple left text block and a right placeholder image `/hero-mockup.png`.

Goal: redesign only the hero section to match reference visual: two-column warm premium audiobook layout with greeting badge, two-tone serif heading, supporting copy, Upload button, social proof, and right-side visual composition with headphones/book stack/cover/reading panel and four floating feature badges.

## Files to modify
- `client/src/components/home/Hero.jsx` – complete visual rewrite of hero section, keep props `userName` and `onUpload` unchanged.
- No changes to `client/src/pages/Home.jsx` unless greeting source needs adjustment.

## Proposed component structure
Hero
  Left column ~43% width
    Greeting badge: soft cream/peach rounded pill, waving hand icon, dynamic `userName`, subtitle "Ready to listen to something amazing today?"
    Main heading: serif two-tone "Turn your reading" dark charcoal + "into listening" terracotta
    Supporting description paragraph
    CTA: Upload a Book button preserving `onUpload` handler exactly, no "See how it works" button
    Social proof: 4 overlapping avatar circles + text "Join readers turning their books into beautiful audio experiences"
  Right column ~57% width
    Visual composition container with warm ivory background
      High-quality audiobook/headphones illustration as primary visual asset
      Book stack base, large cover, open reading panel with decorative progress and playback controls built with React/CSS
      Four floating feature badges built with React/CSS:
        Natural AI Voices – High-quality multilingual voices
        Multiple Formats – PDF, EPUB, DOCX & more
        Listen Anywhere – On web, mobile or offline
        Multi-language Support
    Use existing design tokens, warm shadows, rounded cards.

## Preservation constraints
- Keep `onUpload` handler and navigation to `/my-books` unchanged.
- Keep `userName` dynamic from AuthContext.
- Do not modify sidebar, top nav, FeatureCards, ContinueListening, QuickActions, or other Home sections.
- No backend changes, no new dependencies.
- Use existing design tokens: warm ivory/cream background, terracotta accents, dark charcoal headings, muted warm-gray text.

## Asset requirements
- Prefer a high-quality audiobook/headphones illustration for right-side visual. Source from existing assets if possible, otherwise use a single sourced illustration that matches warm palette.
- Floating badges, reading panel, decorative elements built with React/CSS and lucide icons.
- Avatar placeholders generated as overlapping circles with initials; no real user data invented.
- Modify only `client/src/components/home/Hero.jsx`; add asset only if genuinely necessary.

## Responsive behavior
Desktop: two-column 43/57 split.
Tablet: reduce illustration scale, keep badges readable.
Mobile: stack left content first then visual, hide/reduce decorative badges to avoid overflow.

## Risks
- Visual fidelity: using illustration for right side requires asset that matches warm palette and does not look out of place.
- Ensure illustration does not overpower left heading and scales well on tablet/mobile.
- Do not introduce non-functional "See how it works" button.

## Open questions
Resolved per approval:
1. Asset source: prefer high-quality illustration for right-side visual; build badges/panel with React/CSS.
2. "See how it works" omitted.
3. Social proof avatars as generic placeholder circles with initials; no invented stats.

## Validation plan
- Greeting displays dynamic user name and is larger/prominent with soft cream badge.
- Heading uses two-tone serif treatment.
- Upload button still navigates to `/my-books` via existing `onUpload` handler.
- Right visual uses illustration + floating badges + reading panel built with React/CSS.
- No "See how it works" button present.
- Hero does not affect FeatureCards, ContinueListening, QuickActions, sidebar, navigation.
- Desktop 43/57 split, tablet reduced scale, mobile stacks.
- Run `npm run build --workspace=client`; build succeeds with no errors.
