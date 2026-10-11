// ponytail: self-check for stitch() — fails loudly if WAV concatenation or
// cumulative timestamps drift. Run: node server/src/services/audioStitcher.selfcheck.mjs

import { stitch } from './audioStitcher.js';

function makeWavHeader(sampleRate = 16000, bitsPerSample = 16, numChannels = 1, dataSize = 0) {
  const buf = Buffer.alloc(44);
  // RIFF
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4); // chunk size
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28); // byte rate
  buf.writeUInt16LE(numChannels * bitsPerSample / 8, 32); // block align
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); failures++; }
  else console.log('ok:', msg);
}

// 1. Single chunk passthrough
{
  const header = makeWavHeader(16000, 16, 1, 16000); // 1s of audio data
  const { mergedBuffer, cumulativeTimestamps, totalDuration } = stitch(
    [header],
    [[{ start: 0, end: 1, word: 'hello' }]],
    [1]
  );
  assert(mergedBuffer.length === 44, 'single chunk keeps header');
  assert(totalDuration === 1, 'single chunk duration');
  assert(cumulativeTimestamps.length === 1 && cumulativeTimestamps[0].start === 0, 'single chunk timestamps');
}

// 2. Multi-chunk concatenation with header stripping
{
  const h1 = makeWavHeader(16000, 16, 1, 16000); // 1s
  const h2 = makeWavHeader(16000, 16, 1, 16000); // 1s
  const payload1 = Buffer.from('AAAA'.repeat(4000)); // dummy data
  const payload2 = Buffer.from('BBBB'.repeat(4000));
  const b1 = Buffer.concat([h1, payload1]);
  const b2 = Buffer.concat([h2, payload2]);

  const { mergedBuffer, cumulativeTimestamps, totalDuration } = stitch(
    [b1, b2],
    [
      [{ start: 0, end: 1, word: 'hello' }],
      [{ start: 0, end: 1, word: 'world' }],
    ],
    [1, 1]
  );

  // 44 (header) + 16000 + 16000 = 32044
  assert(mergedBuffer.length === 44 + 16000 + 16000, `multi-chunk length got ${mergedBuffer.length}`);
  assert(mergedBuffer.readUInt32LE(4) === mergedBuffer.length - 8, 'RIFF size patched');
  assert(mergedBuffer.readUInt32LE(40) === 16000 + 16000, 'data size patched');
  assert(totalDuration === 2, 'multi-chunk duration');
  assert(cumulativeTimestamps.length === 2, 'two timestamps');
  assert(cumulativeTimestamps[0].start === 0 && cumulativeTimestamps[1].start === 1, 'timestamp offsets applied');
  // Verify payload bytes are concatenated (not header bytes)
  assert(mergedBuffer[44] === payload1[0], 'first payload byte preserved');
  assert(mergedBuffer[44 + 16000] === payload2[0], 'second payload byte preserved');
}

// 3. Empty input
{
  const { mergedBuffer, cumulativeTimestamps, totalDuration } = stitch([], [], []);
  assert(mergedBuffer.length === 0, 'empty -> empty buffer');
  assert(cumulativeTimestamps.length === 0, 'empty -> empty timestamps');
  assert(totalDuration === 0, 'empty -> zero duration');
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);