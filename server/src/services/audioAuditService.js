export class AudioAuditError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AudioAuditError';
  }
}

/**
 * Hard-gate validation before upload. Throws AudioAuditError on failure.
 * Auto-detects format from magic bytes (WAV/MP3/gTTS output).
 */
export function auditAudio(buffer, text, durationSeconds) {
  // Check 1: minimum buffer size
  if (!buffer || buffer.length < 500) {
    throw new AudioAuditError('Audio buffer too small (< 500 bytes)');
  }

  // Check 2: Auto-detect Magic bytes
  const isWav = buffer.slice(0, 4).toString('utf8') === 'RIFF';
  const isId3 = buffer.slice(0, 3).toString('utf8') === 'ID3';
  const isMpegSync = buffer[0] === 0xff && (buffer[1] & 0b11100000) === 0b11100000;

  if (!isWav && !isId3 && !isMpegSync) {
    throw new AudioAuditError('Invalid audio buffer: missing WAV, ID3, or MPEG sync magic bytes');
  }

  // Check 3: duration vs text length ratio
  // Average reading speed: ~20 chars/sec → expected min = text.length / 20
  const expectedMinDuration = text.length / 20;
  const threshold = expectedMinDuration * 0.2;
  if (durationSeconds < threshold && threshold > 0) {
    throw new AudioAuditError(
      `Audio duration anomalously short: ${durationSeconds}s vs expected min ${threshold.toFixed(1)}s for ${text.length} chars`
    );
  }
}
