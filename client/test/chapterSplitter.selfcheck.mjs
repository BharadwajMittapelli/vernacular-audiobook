import assert from 'node:assert/strict';
import { splitChapters } from '../src/services/chapterSplitter.js';

// header split (Chapter / CHAPTER / #)
const fm = 'x'.repeat(120);
let ch = splitChapters(`${fm}\n\nChapter 1\nAlpha text\n\nCHAPTER 2\nBeta text`);
assert.equal(ch.length, 3);
assert.equal(ch[0].title, 'Front Matter');
assert.equal(ch[1].title, 'Chapter 1');
assert.equal(ch[2].title, 'CHAPTER 2');
assert.match(ch[2].text, /Beta text/);

// markdown headers, ** stripped from title
ch = splitChapters('# **Title Line**\nBody\n## Second\nMore');
assert.equal(ch.length, 2);
assert.equal(ch[0].title, 'Title Line');

// short front matter dropped
ch = splitChapters('tiny\nChapter 1\nbody');
assert.equal(ch.length, 1);
assert.equal(ch[0].title, 'Chapter 1');

// no headers → fallback chunking at paragraph boundary
const paras = Array.from({ length: 80 }, (_, i) => `Paragraph ${i} `.repeat(20)).join('\n\n');
ch = splitChapters(paras);
assert.ok(ch.length >= 2);
assert.ok(ch.every((c) => c.text.length > 0 && c.chapterId.length > 30));

// no headers, no paragraph breaks → hard slice
ch = splitChapters('w'.repeat(12000));
assert.equal(ch[0].text.length, 5000);
assert.equal(ch.length, 3);

// empty → []
assert.deepEqual(splitChapters('   '), []);

console.log('chapterSplitter selfcheck OK');
