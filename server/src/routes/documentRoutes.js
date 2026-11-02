import express from 'express';
import multer from 'multer';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { splitTextIntoChapters } from '../utils/chapterSplitter.js';
import { VALID_LANGUAGES } from '../config/gnaniVoices.js';

// Handle unhandled rejections from pdf.js worker threads
process.on('unhandledRejection', (reason, promise) => {
  console.error('[documentRoutes] unhandledRejection:', reason?.stack || reason);
});

const INDIC_RE = /[\u0900-\u0D7F]/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// multer errors (oversize file, unexpected field) bypass the handler's try/catch
const uploadSingle = (req, res, next) =>
  upload.single('file')(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, error: 'File exceeds the 20 MB limit' });
    }
    if (err) {
      console.error('[documentRoutes] multer error:', err.stack || err);
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });

function buildPdfBaseUrl() {
  // pdf-parse v2.4.5 depends on pdfjs-dist@5.4.296 (Mozilla's pdf.js).
  // The cmaps/ and standard_fonts/ dirs live in pdfjs-dist/legacy/build/,
  // NOT inside pdf-parse's own dist/. We resolve pdfjs-dist directly; if npm
  // didn't hoist it (e.g. old npm <7 or nested workspaces), fall back to
  // looking inside pdf-parse/node_modules/.
  // IMPORTANT: on Windows, pathToFileURL does NOT add a trailing slash for
  // directories, so we must ensure the base URL ends with '/' before joining
  // 'legacy/build/', otherwise new URL() resolves relative to the parent dir.
  const require = createRequire(import.meta.url);
  let pkgJson;
  try {
    pkgJson = require.resolve('pdfjs-dist/package.json');
  } catch {
    pkgJson = require.resolve('pdf-parse/package.json');
    pkgJson = path.join(path.dirname(pkgJson), '..', 'node_modules', 'pdfjs-dist', 'package.json');
  }
  const pkgRoot = path.dirname(pkgJson);
  const baseUrl = pathToFileURL(pkgRoot).href + (pathToFileURL(pkgRoot).href.endsWith('/') ? '' : '/');
  return new URL('legacy/build/', baseUrl);
}

async function pdfText(buffer) {
  console.log('[pdfText] START buffer.length=', buffer.length);
  const cMapsBase = buildPdfBaseUrl();
  console.log('[pdfText] cMapsBase=', cMapsBase.href);
  
  const parser = new PDFParse({
    data: new Uint8Array(buffer),
    cMapUrl: new URL('cmaps/', cMapsBase).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('standard_fonts/', cMapsBase).href,
  });
  console.log('[pdfText] PDFParse constructed');
  
  try {
    const result = await parser.getText();
    console.log('[pdfText] getText() resolved, text.length=', result.text?.length);
    return result.text;
  } catch (e) {
    console.error('[pdfText] getText() threw:', e.stack || e);
    throw new Error(`PDF parse error: ${e.message}`);
  } finally {
    console.log('[pdfText] calling parser.destroy()');
    try {
      await parser.destroy();
      console.log('[pdfText] parser.destroy() done');
    } catch (destroyErr) {
      console.error('[pdfText] parser.destroy() failed (non-fatal):', destroyErr.stack || destroyErr);
    }
  }
}

async function docxText(buffer) {
  try {
    const raw = await mammoth.extractRawText({ buffer });
    return raw.value;
  } catch (e) {
    console.error('[docxText] DOCX parsing failed:', e.stack || e);
    throw new Error(`DOCX parse error: ${e.message}`);
  }
}

const decodeEntities = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

function epubText(buffer) {
  try {
    const zip = new AdmZip(buffer);
    // ponytail: filename order approximates the OPF spine; parse container.xml + spine if clients report scrambled chapters
    const files = zip
      .getEntries()
      .filter((e) => !e.isDirectory && /\.x?html$/i.test(e.entryName))
      .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }));
    return files
      .map((e) =>
        decodeEntities(
          zip
            .readAsText(e)
            .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
            // block-level ends become newlines so h1/p don't fuse into one title line
            .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>|<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
        )
      )
      .join('\n\n');
  } catch (e) {
    console.error('[epubText] EPUB parsing failed:', e.stack || e);
    throw new Error(`EPUB parse error: ${e.message}`);
  }
}

const router = express.Router();

// POST /api/documents/upload — server-side PDF/EPUB extraction (stateless: parse, split, return)
router.post('/upload', uploadSingle, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded (multipart field: file)' });
    }
    const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
    const isDocx = ext === 'docx' || req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (ext !== 'pdf' && ext !== 'epub' && !isDocx) {
      return res.status(400).json({ success: false, error: 'Only .pdf, .epub, and .docx are supported on this endpoint' });
    }

    // Optional ?language= query param lets the client declare intent for Indic
    // PDFs that are already in-script (e.g. ml-IN). Defaults to en-IN when absent.
    const queryLang = req.query.language;
    if (queryLang && !VALID_LANGUAGES.includes(queryLang)) {
      return res.status(400).json({ success: false, error: `Unsupported language ${queryLang}. Valid: ${VALID_LANGUAGES.join(', ')}` });
    }
    const language = queryLang || 'en-IN';

    let raw;
    try {
      raw = ext === 'pdf' ? await pdfText(req.file.buffer) : isDocx ? await docxText(req.file.buffer) : epubText(req.file.buffer);
    } catch (parseErr) {
      // Distinguish parse-time failures (422) from config/unexpected (500)
      const msg = parseErr.message || 'Document parsing failed';
      console.error('[documentRoutes] parse error:', parseErr.stack || parseErr);
      return res.status(422).json({ success: false, error: msg });
    }

    console.log('[documentRoutes] pdfText succeeded, raw.length=', raw.length);
    const chapters = splitTextIntoChapters(raw.replace(/\uFEFF/, ''));
    console.log('[documentRoutes] splitTextIntoChapters returned', chapters.length, 'chapters');
    if (!chapters.length) {
      return res.status(422).json({ success: false, error: 'No readable text found in document' });
    }

    // When the caller asked for an Indic language but the PDF extracted no
    // Indic glyphs, guide them to either drop the param (English PDF) or
    // re-save as a searchable PDF (scan/image PDF).
    if (language !== 'en-IN' && !INDIC_RE.test(raw)) {
      return res.status(400).json({
        success: false,
        error: `Selected language ${language} is Indic, but the PDF extracted no Indic characters. This usually means the PDF is either (a) scanned/image-only — re-save as searchable PDF, or (b) actually in English — remove ?language.`,
      });
    }

    res.json({
      success: true,
      title: req.file.originalname.replace(/\.[^.]+$/, ''),
      chapters,
      language,
    });
  } catch (error) {
    console.error('[documentRoutes] unexpected error:', error.stack || error);
    res.status(500).json({ success: false, error: 'Document parsing failed' });
  }
});

export { pdfText, docxText, epubText };
export default router;
