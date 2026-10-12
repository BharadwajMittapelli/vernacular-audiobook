import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { PDFParse } from 'pdf-parse';
import { splitTextIntoChapters } from '../utils/chapterSplitter.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// multer errors (oversize file) bypass the handler's try/catch
const uploadSingle = (req, res, next) =>
  upload.single('file')(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, error: 'File exceeds the 20 MB limit' });
    }
    next(err);
  });

async function pdfText(buffer) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
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
}

const router = express.Router();

// POST /api/documents/upload — server-side PDF/EPUB extraction (stateless: parse, split, return)
router.post('/upload', uploadSingle, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded (multipart field: file)' });
    }
    const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
    if (ext !== 'pdf' && ext !== 'epub') {
      return res.status(400).json({ success: false, error: 'Only .pdf and .epub are supported on this endpoint' });
    }

    const raw = ext === 'pdf' ? await pdfText(req.file.buffer) : epubText(req.file.buffer);
    const chapters = splitTextIntoChapters(raw.replace(/\uFEFF/, ''));
    if (!chapters.length) {
      return res.status(422).json({ success: false, error: 'No readable text found in document' });
    }

    res.json({
      success: true,
      title: req.file.originalname.replace(/\.[^.]+$/, ''),
      chapters,
    });
  } catch (error) {
    console.error('POST /api/documents/upload error:', error);
    res.status(500).json({ success: false, error: error.message || 'Document parsing failed' });
  }
});

export default router;
