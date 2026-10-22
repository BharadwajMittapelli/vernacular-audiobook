import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import mammoth from 'mammoth';

const doc = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello Docx</w:t></w:r></w:p></w:body></w:document>`;
const zip = new AdmZip();
zip.addFile('[Content_Types].xml', Buffer.from(`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`));
zip.addFile('_rels/.rels', Buffer.from(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`));
zip.addFile('word/document.xml', Buffer.from(doc));

const { value } = await mammoth.extractRawText({ buffer: zip.toBuffer() });
assert.ok(value.includes('Hello Docx'), `extraction failed, got: ${JSON.stringify(value)}`);
console.log('documentRoutes docx extraction selfcheck: OK');
