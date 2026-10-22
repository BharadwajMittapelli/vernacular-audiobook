

const WAV_HEADER_SIZE = 44;

/**
 * Safely concatenate WAV audio buffers by stripping headers from subsequent chunks.
 * Only works for identical format WAV files (same sample rate, bit depth, channels).
 *
 * @param {Buffer[]} audioBuffers - Array of WAV audio buffers
 * @param {Array<Array<{start:number, end:number, word:string}>>} chunkTimestamps - Timestamps per chunk
 * @param {number[]} chunkDurations - Duration of each chunk in seconds
 * @returns {{mergedBuffer: Buffer, cumulativeTimestamps: Array, totalDuration: number}}
 */
export function stitch(audioBuffers, chunkTimestamps, chunkDurations) {
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

  // Keep first chunk's header, strip headers from subsequent chunks
  const firstChunk = audioBuffers[0];
  const subsequentChunks = audioBuffers.slice(1).map((buf) => buf.subarray(WAV_HEADER_SIZE));

  const mergedBuffer = Buffer.concat([firstChunk, ...subsequentChunks]);

  // Fix the RIFF chunk size in the header (bytes 4-7) and data chunk size (bytes 40-43)
  const totalAudioDataSize = mergedBuffer.length - WAV_HEADER_SIZE;
  mergedBuffer.writeUInt32LE(mergedBuffer.length - 8, 4); // RIFF chunk size
  mergedBuffer.writeUInt32LE(totalAudioDataSize, 40); // data chunk size

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
    timeOffset += chunkDurations[i] || 0;
  }

  return {
    mergedBuffer,
    cumulativeTimestamps,
    totalDuration: timeOffset,
  };
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