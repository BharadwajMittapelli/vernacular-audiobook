import { supabase, AUDIO_BUCKET } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

const FORMAT_MAP = {
  mp3: { ext: 'mp3', contentType: 'audio/mpeg' },
  wav: { ext: 'wav', contentType: 'audio/wav' },
};

/**
 * Generate a time-limited signed streaming URL for a stored audio file.
 * @param {string} filePath  - Raw storage path, e.g. "audiobook/<chapterId>/<uuid>.mp3"
 * @param {number} expiresInSeconds
 * @returns {Promise<string>} Signed URL string
 * @throws {Error} if the bucket is private and the file doesn't exist
 */
export async function getSignedAudioUrl(filePath, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error) {
    throw new Error(`Signed URL generation failed: ${error.message}`);
  }
  return data.signedUrl;
}

/**
 * Return a fresh signed URL for a generation record if audio_path exists,
 * otherwise fall back to the stored audio_url (legacy public CDN row).
 *
 * This is the single source of truth for every read path — it prevents
 * returning expired tokens from the idempotency cache or polling branch.
 *
 * @param {{ audio_path?: string | null, audio_url?: string | null }} record
 * @returns {Promise<string|null>} Fresh signed URL or fallback audio_url, or null if neither exists
 */
export async function resolveAudioUrl(record) {
  if (record.audio_path) {
    try {
      return await getSignedAudioUrl(record.audio_path, 3600);
    } catch (signError) {
      console.warn(`[Storage] Signed URL generation failed for ${record.audio_path}: ${signError.message}`);
    }
  }
  // Legacy fallback: pre-migration rows or signed-URL failure
  return record.audio_url || null;
}

/**
 * Upload audio buffer, store raw path, and return both path and a fresh signed URL.
 * The signed URL is what gets returned to clients (preserves audio_url response shape).
 *
 * @returns {{ audioPath: string, signedAudioUrl: string }}
 */
export async function uploadAudio(audioBuffer, chapterId, format = 'wav') {
  const { ext, contentType } = FORMAT_MAP[format] || FORMAT_MAP.wav;
  const fileName = `${chapterId}/${uuidv4()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(fileName, audioBuffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Supabase upload failed: ${uploadError.message}`);
  }

  // Generate a time-limited signed URL (anti-ripping: replaces persistent public CDN links)
  const signedUrl = await getSignedAudioUrl(fileName, 3600);

  return { audioPath: fileName, signedAudioUrl: signedUrl };
}
