# Book Uploader UI Redesign — Implementation Plan

## 1. Objectives & Requirements
Transform `client/src/components/studio/BookUploader.jsx` to match Screenshot 2 while strictly maintaining:
- Exact current modal dimensions (`max-w-xl`, padding, layout structure in `MyBooks.jsx`) without overflow or scrolling.
- All existing functionality (file selection, drag-and-drop, server-side PDF/EPUB parsing, in-browser TXT/MD parsing, language selection, error states, and `onDocumentLoaded` callbacks).

## 2. Visual & Structural Changes

### Header
- Replace top icon with `BookOpen` inside a soft peach rounded background (`w-12 h-12 rounded-xl bg-terracotta/10 text-terracotta`).
- Heading: "Create a New Audio Book" (with "Audio Book" styled in terracotta text).
- Subtitle: "Upload a book to begin generating audiobooks".

### Language Selection
- Add `Globe` icon before the dropdown or inside the select container.
- Update border and focus ring styling to use terracotta (`border-border focus:border-terracotta focus:ring-terracotta/40`).
- Preserve helper text: "Used when .pdf, .epub and .docx files are parsed on the server".

### Upload Dropzone Area
- Large rounded dropzone with dashed terracotta/border styling (`border-2 border-dashed border-terracotta/40 hover:border-terracotta/60 bg-card hover:bg-muted/30`).
- Cloud upload icon (`CloudUpload` or `UploadCloud`) inside a peach circle (`w-14 h-14 rounded-full bg-terracotta/10 text-terracotta`).
- Main text: "Drop a book here, or click to browse" with "click to browse" highlighted in terracotta.
- Subtitle: ".txt and .md parse in-browser · .pdf and .epub parse on the server".
- Prominent terracotta button: "Choose a File" with a folder icon (`FolderOpen`), which triggers the file input click.

### Divider & Supported Formats
- Horizontal divider lines with "or" in the center.
- Row of 5 format cards (PDF, EPUB, DOCX, TXT, MD) with custom soft-colored icon badges and uppercase labels underneath.
- Footer text: "Supported formats: PDF, EPUB, DOCX, TXT, MD".

## 3. File Scope
- **Modified files:** `client/src/components/studio/BookUploader.jsx` only.
- **No other files modified.**

## 4. Preservation of Functionality
- `handleFile(file)` processes PDF/EPUB via `uploadDocument(file, language)` and TXT/MD via `FileReader` and `splitChapters`.
- `onDocumentLoaded` callback correctly invoked with `{ title, chapters }`.
- Drag-and-drop event handlers (`onDragOver`, `onDragLeave`, `onDrop`) and hidden file input element remain intact.

## 5. Validation Checklist
1. Modal opens from "Create a New Audio Book" button with exact same dimensions and no overflow.
2. Header typography and colors match Screenshot 2.
3. Language dropdown functions correctly with globe icon and terracotta focus rings.
4. Drag-and-drop and "Choose a File" button successfully trigger file upload.
5. PDF and EPUB files parse on the server; TXT and MD parse in-browser.
6. Format icons (PDF, EPUB, DOCX, TXT, MD) display correctly as specified.
7. `npm run build` passes successfully without errors.
