

const WAV_HEADER_SIZE = 44;

// Architectural paragraph spacing: Gnani reads "\n\n" with a period-length
// micro-pause, so we inject a real silence gap between paragraph chunks.
export const DEFAULT_PARAGRAPH_SILENCE_MS = 600;

// 16 kHz mono 16-bit fallback (32,000 B/s) when the fmt chunk can't be parsed.
const FALLBACK_BYTE_RATE = 16000 * 1 * 2;

/**
 * Safely concatenate WAV audio buffers.
 *
 * Legacy mode (silenceMs = 0): keeps the first chunk's 44-byte header, blind-
 * strips 44 bytes from subsequent chunks. Byte-identical to the pre-silence
 * behavior — the gTTS MP3 path must stay exactly here.
 *
 * Silence mode (silenceMs > 0): parses each chunk's `data` chunk, injects a
 * mathematically exact silent PCM buffer at gaps, and rebuilds one fresh
 * canonical 44-byte WAV header from chunk 0's format parameters. Timestamps
 * shift by each injected gap so pseudo-alignments stay in sync.
 *
 * @param {Buffer[]} audioBuffers - Array of WAV audio buffers
 * @param {Array<Array<{start:number, end:number, word:string}>>} chunkTimestamps - Timestamps per chunk
 * @param {number[]} chunkDurations - Duration of each chunk in seconds
 * @param {number} silenceMs - Silence injected at each gap in ms (0 = legacy path)
 * @param {boolean[]|null} gapIndices - gapIndices[i] = silence between chunk i and i+1; null = every gap
 * @returns {{mergedBuffer: Buffer, cumulativeTimestamps: Array, totalDuration: number}}
 */
export function stitch(audioBuffers, chunkTimestamps, chunkDurations, silenceMs = 0, gapIndices = null) {
  if (!audioBuffers.length) {
    return { mergedBuffer: Buffer.alloc(0), cumulativeTimestamps: [], totalDuration: 0 };
  }

  if (audioBuffers.length === 1) {
    return {
      mergedBuffer: audioBuffers[0],
      cumulativeTimestamps: chunkTimestamps[0] || [],
      totalDuration: chunkDurations[0] || 0,
    };
  }

  let mergedBuffer;
  const gapSec = [];

  if (silenceMs > 0) {
    const byteRate = getWavByteRate(audioBuffers[0]) || FALLBACK_BYTE_RATE;
    const silence = buildSilenceBuffer(silenceMs, byteRate);
    const hasGap = (i) => (gapIndices ? !!gapIndices[i] : true);

    const parts = [];
    for (let i = 0; i < audioBuffers.length; i++) {
      if (i > 0) {
        const gap = hasGap(i - 1);
        gapSec[i - 1] = gap ? silence.length / byteRate : 0;
        if (gap) parts.push(silence);
      }
      parts.push(extractPcm(audioBuffers[i]));
    }
    mergedBuffer = Buffer.concat([buildWavHeader(audioBuffers[0], 0), ...parts]);
    mergedBuffer.writeUInt32LE(mergedBuffer.length - 8, 4); // RIFF chunk size
    mergedBuffer.writeUInt32LE(mergedBuffer.length - WAV_HEADER_SIZE, 40); // data chunk size
  } else {
    // Legacy path: keep first chunk's header, blind-strip 44 bytes from the rest.
    const firstChunk = audioBuffers[0];
    const subsequentChunks = audioBuffers.slice(1).map((buf) => buf.subarray(WAV_HEADER_SIZE));

    mergedBuffer = Buffer.concat([firstChunk, ...subsequentChunks]);

    // Fix the RIFF chunk size in the header (bytes 4-7) and data chunk size (bytes 40-43)
    const totalAudioDataSize = mergedBuffer.length - WAV_HEADER_SIZE;
    mergedBuffer.writeUInt32LE(mergedBuffer.length - 8, 4); // RIFF chunk size
    mergedBuffer.writeUInt32LE(totalAudioDataSize, 40); // data chunk size
  }

  // Build cumulative timestamps
  const cumulativeTimestamps = [];
  let timeOffset = 0;

  for (let i = 0; i < chunkTimestamps.length; i++) {
    const chunkTs = chunkTimestamps[i] || [];
    for (const ts of chunkTs) {
      cumulativeTimestamps.push({
        start: ts.start + timeOffset,
        end: ts.end + timeOffset,
        word: ts.word,
      });
    }
    timeOffset += (chunkDurations[i] || 0) + (gapSec[i] || 0);
  }

  return {
    mergedBuffer,
    cumulativeTimestamps,
    totalDuration: timeOffset,
  };
}

/**
 * Read the byte rate (bytes/second) from a WAV buffer's fmt chunk.
 * @param {Buffer} wavBuffer
 * @returns {number} byteRate, or 0 if the buffer is not a parseable RIFF/WAVE
 */
export function getWavByteRate(wavBuffer) {
  if (!wavBuffer || wavBuffer.length < WAV_HEADER_SIZE || wavBuffer.toString('ascii', 0, 4) !== 'RIFF') {
    return 0;
  }
  let p = 12;
  while (p + 8 <= wavBuffer.length) {
    const id = wavBuffer.toString('ascii', p, p + 4);
    const size = wavBuffer.readUInt32LE(p + 4);
    if (id === 'fmt ') {
      return wavBuffer.readUInt32LE(p + 16);
    }
    p += 8 + size + (size % 2);
  }
  return 0;
}

/**
 * Raw PCM silence for the given duration at the given byte rate.
 * Rounded to an even byte count so 16-bit sample alignment never breaks.
 * @param {number} ms
 * @param {number} byteRate - bytes/second (falls back to 16 kHz mono 16-bit if falsy)
 * @returns {Buffer}
 */
export function buildSilenceBuffer(ms, byteRate) {
  const rate = byteRate || FALLBACK_BYTE_RATE;
  return Buffer.alloc(Math.round((ms / 1000) * rate) & ~1);
}

/**
 * Isolate the PCM payload of a WAV buffer by walking to its `data` chunk.
 * Handles the streaming 0xFFFFFFFF data-size sentinel Gnani emits by
 * clamping to the bytes actually present.
 * @param {Buffer} wavBuffer
 * @returns {Buffer} copy of the raw PCM
 */
export function extractPcm(wavBuffer) {
  if (!wavBuffer || wavBuffer.length <= WAV_HEADER_SIZE) {
    return Buffer.alloc(0);
  }
  let p = 12;
  while (p + 8 <= wavBuffer.length) {
    const id = wavBuffer.toString('ascii', p, p + 4);
    const chunkSize = wavBuffer.readUInt32LE(p + 4);
    if (id === 'data') {
      const start = p + 8;
      const available = wavBuffer.length - start;
      return Buffer.from(wavBuffer.subarray(start, start + Math.min(chunkSize, available)));
    }
    p += 8 + chunkSize + (chunkSize % 2);
  }
  return Buffer.from(wavBuffer.subarray(WAV_HEADER_SIZE));
}

/**
 * Canonical 44-byte PCM header copied from chunk 0's fmt parameters
 * (sample rate, channels, bit depth survive format changes upstream).
 * Callers must write chunkSize/dataSize once the payload length is known.
 * @param {Buffer} formatSource - first chunk of the merged stream
 * @param {number} dataSize
 * @returns {Buffer} 44-byte header
 */
export function buildWavHeader(formatSource, dataSize) {
  let sampleRate = 16000;
  let numChannels = 1;
  let bitsPerSample = 16;

  let p = 12;
  while (formatSource.length >= p + 8 && formatSource.toString('ascii', p, p + 4) !== 'fmt ') {
    p += 8 + formatSource.readUInt32LE(p + 4) + (formatSource.readUInt32LE(p + 4) % 2);
  }
  if (formatSource.length >= p + 24) {
    numChannels = formatSource.readUInt16LE(p + 10) || 1;
    sampleRate = formatSource.readUInt32LE(p + 12) || sampleRate;
    bitsPerSample = formatSource.readUInt16LE(p + 22) || bitsPerSample;
  }

  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);

  const header = Buffer.alloc(WAV_HEADER_SIZE);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(0, 4); // patched by caller
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(byteRate / sampleRate, 32); // block align
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40); // patched by caller
  return header;
}

/**
 * Extract duration from a WAV buffer by parsing the header.
 * @param {Buffer} wavBuffer
 * @returns {number} Duration in seconds
 */
export function getWavDuration(wavBuffer) {
  if (wavBuffer.length < 44 || wavBuffer.toString('ascii', 0, 4) !== 'RIFF') {
    return 0;
  }

  // Walk chunks: Gnani streams WAV with data size = 0xFFFFFFFF sentinel, so
  // clamp the reported size to the bytes actually present.
  let p = 12;
  let byteRate = 0;
  while (p + 8 <= wavBuffer.length) {
    const id = wavBuffer.toString('ascii', p, p + 4);
    const size = wavBuffer.readUInt32LE(p + 4);
    if (id === 'fmt ') {
      byteRate = wavBuffer.readUInt32LE(p + 16);
    } else if (id === 'data') {
      const available = wavBuffer.length - (p + 8);
      return Math.min(size, available) / byteRate;
    }
    p += 8 + size + (size % 2);
  }
  return 0;
}

/**
 * Extract duration from MP3 buffer using music-metadata (async).
 * Falls back to estimation if metadata parsing fails.
 * @param {Buffer} mp3Buffer
 * @returns {Promise<number>} Duration in seconds
 */
export async function getMp3Duration(mp3Buffer) {
  try {
    const mm = await import('music-metadata');
    const metadata = await mm.parseBuffer(mp3Buffer, 'audio/mpeg');
    return metadata.format.duration || 0;
  } catch {
    // Fallback: rough estimation based on bitrate (128kbps default)
    return mp3Buffer.length / (128 * 1024 / 8);
  }
}