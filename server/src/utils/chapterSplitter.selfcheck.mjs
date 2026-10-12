import assert from 'node:assert/strict';
import { splitTextIntoChapters } from './chapterSplitter.js';

let ch = splitTextIntoChapters(`${'x'.repeat(120)}\n\nChapter 1\nAlpha\n\nCHAPTER 2\nBeta`);
assert.equal(ch.length, 3);
assert.equal(ch[0].title, 'Front Matter');
assert.equal(ch[1].title, 'Chapter 1');

ch = splitTextIntoChapters('# **Title**\nBody\n## Second\nMore');
assert.equal(ch.length, 2);
assert.equal(ch[0].title, 'Title');

ch = splitTextIntoChapters('tiny\nChapter 1\nbody');
assert.equal(ch.length, 1);

ch = splitTextIntoChapters('w'.repeat(12000));
assert.equal(ch.length, 3);
assert.equal(ch[0].text.length, 5000);

assert.deepEqual(splitTextIntoChapters('  \uFEFF  '), []);
assert.ok(splitTextIntoChapters('a\n\nb').every((c) => c.chapterId.length > 30));

console.log('chapterSplitter selfcheck OK');
