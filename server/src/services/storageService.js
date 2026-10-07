import { supabase, AUDIO_BUCKET } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

export async function uploadAudio(audioBuffers, chapterId) {
  const combinedBuffer = Buffer.concat(audioBuffers);
  const fileName = `${chapterId}/${uuidv4()}.wav`;

  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(fileName, combinedBuffer, {
      contentType: 'audio/wav',
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}