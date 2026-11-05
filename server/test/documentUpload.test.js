import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import AdmZip from 'adm-zip';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { default: router } = require('../src/routes/documentRoutes.js');

// Minimal PDF with "Hello" text (1 page)
const MINIMAL_PDF = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (Hello) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000361 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
469
%%EOF`;

// 3-page PDF with distinct content per page
const MULTI_PAGE_PDF = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 8 0 R >> >> >>
endobj
4 0 obj
<< /Length 58 >>
stream
BT /F1 12 Tf 100 700 Td (Page 1 Content) Tj ET
endstream
endobj
5 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 8 0 R >> >> >>
endobj
6 0 obj
<< /Length 58 >>
stream
BT /F1 12 Tf 100 700 Td (Page 2 Content) Tj ET
endstream
endobj
7 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 8 0 R /Resources << /Font << /F1 8 0 R >> >> >>
endobj
8 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (Page 3 Content) Tj ET
endstream
endobj
9 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>
endobj
xref
0 10
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000361 00000 n
0000000456 00000 n
0000000551 00000 n
0000000646 00000 n
0000000741 00000 n
trailer
<< /Size 10 /Root 1 0 R >>
startxref
800
%%EOF`;

// Minimal DOCX
function buildStubDocx() {
  const z = new AdmZip();
  z.addFile('[Content_Types].xml', Buffer.from(`<?xml version="1.0"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`));
  z.addFile('_rels/.rels', Buffer.from(`<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`));
  z.addFile('word/_rels/document.xml.rels', Buffer.from(`<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hdrFtr" Target="hdrftr.xml"/>
</Relationships>`));
  z.addFile('word/document.xml', Buffer.from(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p><w:r><w:t>Hello from docx</w:t></w:r></w:p></w:body>
</w:document>`));
  return z.toBuffer();
}

// Minimal EPUB
function buildStubEpub() {
  const z = new AdmZip();
  z.addFile('mimetype', Buffer.from('application/epub+zip'));
  z.addFile('META-INF/container.xml', Buffer.from(`<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`));
  z.addFile('OEBPS/content.opf', Buffer.from(`<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uid" version="3.0"><metadata><dc:title xmlns:dc="http://purl.org/dc/terms/">Test</dc:title></metadata><manifest><item id="ch" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="ch"/></spine></package>`));
  z.addFile('OEBPS/chapter.xhtml', Buffer.from(`<html><body><h1>Chapter One</h1><p>Epub body text here.</p></body></html>`));
  return z.toBuffer();
}

async function withServer(fn) {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use('/api/documents', router);
  const srv = app.listen(0);
  try { await fn(srv); } finally { srv.close(); }
}

test('English PDF upload returns 200', async () => {
  await withServer(async (srv) => {
    const port = srv.address().port;
    const pdf = Buffer.from(MINIMAL_PDF, 'utf8');
    const fd = new FormData();
    fd.append('file', new Blob([pdf], { type: 'application/pdf' }), 'test.pdf');
    const res = await fetch(`http://127.0.0.1:${port}/api/documents/upload`, { method: 'POST', body: fd });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);
    assert.ok(body.chapters.length > 0);
    assert.strictEqual(body.language, 'en-IN');
  });
});

test('Multi-page PDF extracts all pages', async () => {
  await withServer(async (srv) => {
    const port = srv.address().port;
    const pdf = Buffer.from(MULTI_PAGE_PDF, 'utf8');
    const fd = new FormData();
    fd.append('file', new Blob([pdf], { type: 'application/pdf' }), 'multi.pdf');
    const res = await fetch(`http://127.0.0.1:${port}/api/documents/upload`, { method: 'POST', body: fd });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);
    assert.ok(body.chapters.length > 0);
    // Verify all 3 pages' content is present
    const allText = body.chapters.map(c => c.text).join(' ');
    assert.ok(allText.includes('Page 1 Content'), 'Page 1 content missing');
    assert.ok(allText.includes('Page 2 Content'), 'Page 2 content missing');
    assert.ok(allText.includes('Page 3 Content'), 'Page 3 content missing');
  });
});

test('DOCX upload returns 200', async () => {
  await withServer(async (srv) => {
    const port = srv.address().port;
    const docx = await buildStubDocx();
    const fd = new FormData();
    fd.append('file', new Blob([docx], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'test.docx');
    const res = await fetch(`http://127.0.0.1:${port}/api/documents/upload`, { method: 'POST', body: fd });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);
    assert.ok(body.chapters.length > 0);
  });
});

test('EPUB upload returns 200', async () => {
  await withServer(async (srv) => {
    const port = srv.address().port;
    const epub = await buildStubEpub();
    const fd = new FormData();
    fd.append('file', new Blob([epub], { type: 'application/epub+zip' }), 'test.epub');
    const res = await fetch(`http://127.0.0.1:${port}/api/documents/upload`, { method: 'POST', body: fd });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);
    assert.ok(body.chapters.length > 0);
  });
});

test('Missing file returns 400', async () => {
  await withServer(async (srv) => {
    const port = srv.address().port;
    const res = await fetch(`http://127.0.0.1:${port}/api/documents/upload`, { method: 'POST' });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('No file uploaded'));
  });
});

test('Unsupported file type returns 400', async () => {
  await withServer(async (srv) => {
    const port = srv.address().port;
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from('test')], { type: 'text/plain' }), 'test.txt');
    const res = await fetch(`http://127.0.0.1:${port}/api/documents/upload`, { method: 'POST', body: fd });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('Only .pdf, .epub, and .docx'));
  });
});

test('Indic language with Latin PDF returns 400', async () => {
  await withServer(async (srv) => {
    const port = srv.address().port;
    const pdf = Buffer.from(MINIMAL_PDF, 'utf8');
    const fd = new FormData();
    fd.append('file', new Blob([pdf], { type: 'application/pdf' }), 'test.pdf');
    const res = await fetch(`http://127.0.0.1:${port}/api/documents/upload?language=hi-IN`, { method: 'POST', body: fd });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('Indic characters'));
  });
});