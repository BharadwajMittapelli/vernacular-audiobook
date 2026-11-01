# BookUploader Visual Styling Update — Implementation Plan

## Audit Findings

The existing plan violates critical constraints from the auditing context:

| Existing Plan | Auditing Context Requirement | Violation |
|---------------|------------------------------|-----------|
| Change modal wrapper to `max-w-[960px]` | **DO NOT CHANGE MODAL SIZE** — preserve current `max-w-xl` (560px) | ✗ Critical |
| Enable DOCX client-side support | "Do not change file acceptance or parsing logic" | ✗ Critical |
| Show PDF/EPUB/DOCX/TXT/MD format icons | "Only display formats genuinely supported" | ✗ Critical |
| Change modal padding to `p-8` in MyBooks | Modal dimensions/positioning must remain exactly as-is | ✗ Critical |

**Current modal (MyBooks.jsx:380):** `max-w-xl` (560px), `p-8`, `rounded-xl`, `bg-background`
**Current supported formats (BookUploader.jsx):** PDF, EPUB (server), TXT, MD (client) — 4 formats total

## Implementation Plan

### Pre-Implementation Verification
Before any changes, inspect the actual modal dimensions:
- Current modal (MyBooks.jsx:379-392): `fixed inset-0 z-50 flex items-center justify-center bg-black/50` with inner `bg-background rounded-xl p-8 max-w-xl w-full mx-4 relative shadow-xl`
- Verify `max-w-xl` equals 36rem (576px) in Tailwind config
- Verify viewport rendering matches current screenshot (first image)

### Files to Modify
- `client/src/components/studio/BookUploader.jsx` — Complete visual restyling only
- `client/src/pages/MyBooks.jsx` — **Only** change modal background to `#FFFCF8` (keep all dimensions, padding, max-width)

### No Backend Changes

### Color Tokens (Reference)
```css
--ivory: #FFFCF8;           /* Modal background */
--dark-brown: #38221D;      /* "Create a New" text */
--terracotta: #B96F4C;      /* "Audio Book" text, borders, buttons, focus rings */
--peach: #FFE5D9;           /* Icon backgrounds, hover states */
--light-terracotta: #E8A87C; /* Dashed dropzone border */
--muted-warm-gray: #8B7D72;  /* Subtitle, helper text */
```

### Task List

#### 1. Update MyBooks.jsx Modal Wrapper (Minimal)
- Line 380: Change `bg-background` → `bg-[#FFFCF8]`
- Keep: `rounded-xl`, `p-8`, `max-w-xl`, `w-full`, `mx-4`, `shadow-xl`, backdrop `bg-black/50`
- **Do not change** max-width, padding, border-radius, positioning

#### 2. BookUploader.jsx — Header Restyle
- **Book icon:** Replace `FileText` with `BookOpen` (lucide)
  - Container: rounded-square with peach background `bg-[#FFE5D9] rounded-lg p-3` (match reference: soft peach rounded-square)
  - Icon stroke: terracotta `#B96F4C`, `h-6 w-6`
  - Centered above heading
- **Heading:** "Create a New Audio Book" centered, serif typography
  - "Create a New" in `#38221D` (dark brown), font weight semi-bold
  - "Audio Book" in `#B96F4C` (terracotta), font weight semi-bold or bold
  - Font size: `text-xl` or `text-2xl`, scale down to fit 560px width without awkward wrapping
- **Subtitle:** "Upload a book to begin generating audiobooks" in muted warm gray `#8B7D72`, `text-sm` centered
- **Close button:** Existing X button in MyBooks.jsx remains (top-right of modal)

#### 3. BookUploader.jsx — Language Selector Restyle
- **Visual container:** `bg-white border border-[#FFE5D9] rounded-lg px-3 py-2.5 flex items-center gap-2`
- **Globe icon:** `Globe` (lucide) in terracotta `#B96F4C`, `h-5 w-5` on left side of selector
- **Select element:** Full-width with transparent background, native chevron on right
- **Focus state:** `focus:ring-2 focus:ring-[#B96F4C]/30 focus:border-[#B96F4C]`
- **Helper text:** "Used when .pdf, .epub and .docx files are parsed on the server" — keep existing muted gray
- Preserve: `value`, `onChange`, helper text, `languages` state, `id="upload-language"`

#### 4. BookUploader.jsx — Dropzone Restyle
- **Container:** `border-2 border-dashed border-[#E8A87C] rounded-xl p-6 bg-white`
  - Inner padding reduced from modal's `p-8` to fit content within 560px
  - Border color: light terracotta dashed
- **Cloud-upload icon:** 
  - Container: `bg-[#FFE5D9] rounded-full p-4` (peach circle)
  - Icon: `UploadCloud` in terracotta `#B96F4C`, `h-8 w-8`
  - Centered above dropzone heading
- **Heading:** "Drop a book here, or click to browse"
  - Style: serif or semi-bold text, centered
  - "click to browse" could be terracotta-colored to match reference
- **Supporting text:** ".txt and .md parse in-browser · .pdf and .epub parse on the server" — muted warm gray, `text-sm`, centered
- **Drag-over state:** `border-[#B96F4C] bg-[#FFE5D9]/20 scale-[1.01]`
- **Choose file button:** Visible terracotta button inside dropzone (see section 5)
- **Layout:** Icon → Heading → Supporting text → Button → Divider → Format icons

#### 5. BookUploader.jsx — "Choose a File" Button
- **Visible button:** Inside dropzone, centered below supporting text
- **Style:** 
  - `bg-[#B96F4C] text-white px-6 py-2.5 rounded-lg font-medium`
  - Hover: `hover:opacity-90` or `hover:bg-[#A05E3F]`
  - Transition: `transition-colors duration-150`
- **Icon:** `Folder` (lucide) in white, `h-5 w-5 mr-2` 
- **Label:** "Choose a File"
- **Behavior:** Click triggers hidden file input
- **Hidden input:** `className="sr-only"` remains, `accept=".txt,.md,.pdf,.epub"` unchanged

#### 6. BookUploader.jsx — Horizontal Divider and Format Icons
- **Divider:** 
  - `flex items-center gap-4 my-4`
  - Left/right borders: `border-t border-gray-200` (warm ivory)
  - Center text: "or" in muted warm gray, `text-sm`
- **Format icons row:** 
  - 4 icons: PDF, EPUB, TXT, MD (genuinely supported formats only)
  - Layout: `flex items-center justify-center gap-4` or `gap-6`
  - Container: `bg-gray-100` rounded square with icon
- **Icon details (visual fidelity):**
  - PDF: Red icon (`#E53935`) — PDF document icon
  - EPUB: Green icon — EPUB book icon
  - TXT: Purple/blue icon — Text document icon
  - MD: Gray icon — Markdown icon
  - Each in soft rounded square background, centered
- **Supported formats text:** "Supported formats: PDF, EPUB, TXT, MD" below icons in muted gray `text-xs`
- **Note on DOCX:** Reference screenshot shows DOCX but client code does NOT accept it (`accept` attribute excludes it, `handleFile` rejects it). Per explicit auditing instruction: "Only display formats genuinely supported by the current uploader. Do not change file acceptance or parsing logic." Therefore DOCX must NOT be displayed or enabled. The reference visual styling is emulated but DOCX icon is omitted.

#### 7. Preserve All Functionality
- `handleFile` logic unchanged (PDF/EPUB server, TXT/MD client)
- `accept=".txt,.md,.pdf,.epub"` unchanged
- Drag-and-drop, file input, error handling, uploading state
- `onDocumentLoaded` prop contract unchanged
- Language selection, `getVoices` initialization unchanged

### Responsive Behavior
- Desktop: 560px max-width, current padding
- Tablet: Scale heading size, keep centered
- Mobile: Modal fits viewport (existing behavior), format tiles wrap, heading scales down

### Validation Checklist
1. Modal opens at **exact same dimensions** (560px max-width, current height)
2. Modal position **unchanged** (centered, same backdrop)
3. Background is `#FFFCF8` (warm ivory)
4. Heading reads "Create a New Audio Book" with two-tone styling
5. Language selector has peach border, terracotta globe icon, terracotta focus ring
6. Dropzone has dashed light terracotta border, peach-circle cloud icon
7. "Choose a File" button is terracotta with white folder icon
8. Format tiles show **only** PDF, EPUB, TXT, MD — no overflow
9. Upload works: PDF/EPUB → server, TXT/MD → in-browser parsing
10. Error messages display correctly
11. Close button works
12. Production build succeeds

### Out of Scope
- DOCX support (client doesn't accept it)
- Modal size/position changes
- New dependencies or icons beyond lucide-react
- Backend/API changes
- Right-side illustration or feature cards from reference

---

**Implementation Order:** MyBooks.jsx background → BookUploader.jsx header → language selector → dropzone → choose file button → format tiles → validation