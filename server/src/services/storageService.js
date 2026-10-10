import { supabase, AUDIO_BUCKET } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

const FORMAT_MAP = {
  mp3: { ext: 'mp3', contentType: 'audio/mpeg' },
  wav: { ext: 'wav', contentType: 'audio/wav' },
};

export async function uploadAudio(audioBuffer, chapterId, format = 'wav') {
  const { ext, contentType } = FORMAT_MAP[format] || FORMAT_MAP.wav;
  const fileName = `${chapterId}/${uuidv4()}.${ext}`;

  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(fileName, audioBuffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data } = await supabase.storage.from(AUDIO_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}