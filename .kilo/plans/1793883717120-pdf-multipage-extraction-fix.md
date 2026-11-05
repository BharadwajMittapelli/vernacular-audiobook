# PDF Multi-Page Extraction Fix - Implementation Plan

## Problem Statement
Uploaded 23-page PDF only extracts text from first 3 pages. Root cause unknown - could be:
- Scanned/image-only pages (no text layer)
- Font/CMap resolution failure on later pages
- pdf-parse library bug (Issue #72: getText() drops content in v2)
- Per-page error silently stopping extraction
- Worker/transfer issues on Windows Node 24 (Issue #119)

## Current Architecture
```
POST /api/documents/upload
  → multer (memory storage, 20MB limit)
  → pdfText(buffer) in documentRoutes.js:59-88
      → PDFParse({ data, cMapUrl, standardFontDataUrl })
      → parser.getText()  ← NO PARAMS = should parse ALL pages
      → returns result.text (concatenated string)
  → splitTextIntoChapters(raw)
  → returns chapters array
```

## Diagnostic Protocol (Phase 1 - Mandatory Before Any Fix)

### 1.1 Add Page-Level Visibility Logging
**File:** `server/src/routes/documentRoutes.js`  
**Function:** `pdfText()` (lines 59-88)

Add after line 73 (`const result = await parser.getText();`):
```javascript
console.log('[pdfText] DIAGNOSTIC:');
console.log('  result.total (pages in PDF):', result.total);
console.log('  result.pages.length (pages parsed):', result.pages?.length);
console.log('  Per-page text lengths:', result.pages?.map((p, i) => ({
  pageNum: i + 1,
  textLen: p.text?.length || 0,
  preview: p.text?.slice(0, 100)
})));
```

### 1.2 Test with Known Multi-Page PDF
- Create/test with a 5+ page searchable PDF (not scanned)
- Verify `result.total === result.pages.length`
- Confirm all pages have `textLen > 0`

### 1.3 Classify Root Cause from Logs
| Log Pattern | Root Cause | Fix Path |
|-------------|------------|----------|
| `total: 23, pages.length: 3` | Parsing stops at page 3 | Phase 2A: Per-page error handling |
| `total: 3, pages.length: 3` | PDF only has 3 pages | User file issue - not code |
| `total: 23, pages.length: 23, but pages 4-23 textLen: 0` | No text layer (scanned) | Phase 2B: OCR fallback / user guidance |
| `total: 23, pages.length: 23, textLen > 0 but concatenated wrong` | pageJoiner/pageJoiner bug (Issue #66) | Phase 2C: Fix concatenation |

---

## Fix Implementation (Phase 2 - Based on Diagnostic Results)

### 2A: Per-Page Error Resilience (if parsing stops early)
**File:** `server/src/routes/documentRoutes.js`  
**Approach:** Wrap per-page extraction in try/catch, continue on failure

```javascript
// Replace parser.getText() call with custom page-by-page extraction
const doc = await parser.load();
const allText = [];
for (let i = 1; i <= doc.numPages; i++) {
  try {
    const page = await doc.getPage(i);
    const text = await parser.getPageText(page, {}, doc.numPages);
    allText.push(text);
    page.cleanup();
  } catch (pageErr) {
    console.error(`[pdfText] Page ${i} extraction failed:`, pageErr.message);
    allText.push(`[PAGE ${i} EXTRACTION FAILED]`);
  }
}
return allText.join('\n\n');
```

### 2B: Scanned PDF Detection & Guidance (if pages have 0 text)
**File:** `server/src/routes/documentRoutes.js`  
**Add after page-level logging:**
```javascript
const emptyPages = result.pages
  ?.map((p, i) => ({ page: i + 1, len: p.text?.length || 0 }))
  ?.filter(p => p.len === 0)
  ?.map(p => p.page) || [];

if (emptyPages.length > 0) {
  console.warn('[pdfText] Pages with no text layer (likely scanned):', emptyPages);
  // Optionally: return structured info to caller for OCR suggestion
}
```

### 2C: pageJoiner Concatenation Fix (if Issue #66)
**File:** `server/src/routes/documentRoutes.js`  
**Pass explicit `pageJoiner: ''` to getText():**
```javascript
const result = await parser.getText({ pageJoiner: '' });
```

---

## Validation Protocol (Phase 3)

### 3.1 Unit Tests (Add to `server/test/documentUpload.test.js`)
```javascript
test('Multi-page PDF extracts all pages', async () => {
  // Create 5-page test PDF programmatically or use fixture
  const multiPagePdf = createMultiPagePdf(5); // helper needed
  const fd = new FormData();
  fd.append('file', new Blob([multiPagePdf], { type: 'application/pdf' }), 'multi.pdf');
  const res = await fetch(url, { method: 'POST', body: fd });
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.ok(body.success);
  // Should have at least 5 chapters or 1 chapter with all content
  const totalText = body.chapters.map(c => c.text).join('');
  assert.ok(totalText.includes('Page 1'));
  assert.ok(totalText.includes('Page 5'));
});

test('Scanned PDF returns appropriate error/guidance', async () => {
  // Use image-only PDF fixture
  // Expect 400 with "scanned/image-only" guidance message
});
```

### 3.2 Integration Test Scenarios
| Scenario | Expected Result |
|----------|-----------------|
| 23-page searchable PDF | All 23 pages extracted, chapters split correctly |
| 23-page scanned PDF | Clear error: "PDF appears to be scanned/image-only" |
| Mixed (some scanned, some searchable) | Searchable pages extracted, scanned pages flagged |
| PDF with special fonts/CMaps | Text extracted if CMaps available, else graceful degradation |

### 3.3 Manual Verification Checklist
- [ ] Upload user's 23-page PDF → verify all pages in output
- [ ] Check server logs show `total: 23, pages.length: 23`
- [ ] Verify chapter splitting works on full text
- [ ] Confirm no duplicate/missing content from pageJoiner
- [ ] Test memory usage stays within limits (20MB file → <500MB RSS)

---

## Rollout Strategy

1. **Deploy diagnostic logging only** (Phase 1) → observe production logs
2. **Analyze logs** → classify root cause
3. **Implement targeted fix** (Phase 2A/2B/2C)
4. **Run test suite** → `npm test` in server workspace
5. **Deploy fix** → verify with user's PDF
6. **Monitor** for regressions

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| pdf-parse v2.4.5 has unfixable bug | Medium | High | Consider migration to `unpdf` or `pdfjs-dist` direct |
| @napi-rs/canvas native dep fails on Railway | Low | High | Already handled in build; verify Railway has canvas support |
| Memory spike on 23-page PDF | Low | Medium | Streaming not possible with pdf-parse; monitor RSS |
| Chapter splitter breaks on full text | Low | Medium | Existing tests cover chapter splitting |

---

## Open Questions (Resolve Before Implementation)

1. **OCR fallback?** Should we integrate Tesseract.js for scanned pages, or just return clear error guiding user to OCR first?
2. **pdf-parse version pin?** Stay on 2.4.5 or upgrade? (v7+ has breaking changes per Issue #73)
3. **Worker configuration?** Current `buildPdfBaseUrl()` sets CMaps - is it working for all pages? Need diagnostic logs first.
4. **Timeout handling?** Large PDFs may exceed default timeouts - add AbortController?

---

## Decision Required

**Before implementing any fix, we MUST run Phase 1 diagnostics.** The plan cannot proceed to Phase 2 without knowing which root cause pattern matches the logs.

**Recommended next step:** Deploy diagnostic logging (Phase 1.1), upload the 23-page PDF, capture server logs, then return with the log output to classify the root cause.

---

## Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `server/src/routes/documentRoutes.js` | 1, 2A, 2B, 2C | Diagnostic logging, per-page extraction, scanned detection, pageJoiner fix |
| `server/test/documentUpload.test.js` | 3 | Multi-page test cases, scanned PDF test |
| `package.json` (server) | Optional | Add Tesseract.js if OCR fallback approved |

---

## Success Criteria

- [ ] User's 23-page PDF produces complete audiobook script (all 23 pages)
- [ ] Server logs show `result.total === 23 && result.pages.length === 23`
- [ ] All pages have `textLen > 50` characters (reasonable content)
- [ ] No regression on existing single-page PDF tests
- [ ] Clear error message for scanned/image-only PDFs