# Implementation Plan: Ekithab AI All Audio Page UI (Phase 2)

## 1. Objective
Reproduce the exact All Audio page UI from the provided reference screenshot with pixel-perfect fidelity, layout, typography, visual hierarchy, spacing, colors, borders, and component structure, without modifying backend, database, or unrelated files.

## 2. Screenshot Analysis & Mapping
- **Left Section (Audio Library):**
  - Heading: **Audio Library** (with subtitle "Listen to your generated audiobooks, organize them, and continue from where you left off.").
  - Navigation Tabs: **All Audio** (active with underline/indicator), **By Book**, **Favorites**, **Downloads**, plus a **"All books"** dropdown filter on the far right.
  - Table Header row: `TITLE`, `BOOK`, `CHAPTER`, `LANGUAGE`, `VOICE`, `DURATION`, `CREATED`, plus action buttons.
  - Audio rows:
    - Play/Pause circular button (terracotta when active).
    - Chapter Title & Book subtitle.
    - Book cover thumbnail + Book title.
    - Chapter number (e.g. `Chapter 02`).
    - Language flag emoji + name (`🇮🇳 Hindi`, `🇺🇸 English`, etc.).
    - Voice name (`Kaveri`, `Deepak`, etc.).
    - Duration (`12:18`).
    - Relative time (`2 days ago`).
    - More options button (`...`).
  - Active audio row: Distinct background (`terracotta/10` or similar tint) with subtle border.
  - Continue Listening section at the bottom.

- **Right Section (Player Panel):**
  - Cover image in rounded card with drop shadow.
  - Heart favorite button (top right of cover).
  - Chapter title (Lora serif font) & Book subtitle.
  - Chapter sequence & duration info.
  - Skip back 10s, Play/Pause (large terracotta circle), Skip forward 10s controls.
  - Audio progress bar (range slider with terracotta accent) with current time (e.g. `04:32`) and total duration (`12:18`).
  - Metadata rows:
    - Language (Flag + Name)
    - Voice (Name + chevron)
    - Playback speed (`1.0x`)
  - Action buttons:
    - **Download Audio** (dark/black button with download icon).
    - **Open in Studio** (outline button with external link icon).

- **Left Sidebar & Topbar:**
  - Standard Ekithab AI app layout (`AppLayout` with `AppSidebar` and `AppTopBar`).
  - Recent books list in the sidebar.
  - Studio Online status indicator.
  - User profile at bottom of sidebar.
  - Search bar in topbar.

## 3. File-by-File Modification Plan
1. **`client/src/components/audioLibrary/LibraryTopBar.jsx`**:
   - Refine tab styling and dropdown positioning to match the screenshot exactly.
2. **`client/src/components/audioLibrary/AudioRow.jsx`**:
   - Align columns (`TITLE`, `BOOK`, `CHAPTER`, `LANGUAGE`, `VOICE`, `DURATION`, `CREATED`, `ACTIONS`), typography, padding, and hover states with the screenshot.
3. **`client/src/components/audioLibrary/AudioTable.jsx`**:
   - Ensure table header matches the exact column widths and headers from the screenshot.
4. **`client/src/components/audioLibrary/PlayerPanel.jsx`**:
   - Match player panel layout, cover size, typography (serif title), skip buttons, progress bar, metadata rows (`Language`, `Voice`, `Speed`), and action buttons (`Download Audio`, `Open in Studio`).
5. **`client/src/pages/AudioLibrary.jsx`**:
   - Wire up sample/mock fallback items or ensure the layout cleanly embeds `LibraryTopBar`, `AudioTable`, and `PlayerPanel` in the two-column layout matching the desktop target.

## 4. Verification Plan
- Run client build (`npm run build`) and check for any syntax or compilation errors.
- Verify responsiveness and visual alignment.
