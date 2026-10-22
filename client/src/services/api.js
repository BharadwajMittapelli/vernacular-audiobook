import axios from 'axios';
import { supabase } from '../lib/supabaseClient';

if (!crypto.randomUUID) {
  crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  };
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4001',
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

export function getVoices(language) {
  return api
    .get('/api/voices', language ? { params: { language } } : undefined)
    .then((res) => res.data.voices);
}

export function synthesizeAudio(payload) {
  return api
    .post('/api/audio/synthesize', payload, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    })
    .then((res) => res.data);
}

export function synthesizeAsync({ chapters, ...rest }) {
  return api
    .post('/api/audio/synthesize-async', {
      chapters: chapters.map((ch) => ({
        idempotencyKey: crypto.randomUUID(),
        ...ch,
      })),
      ...rest,
    })
    .then((res) => res.data);
}

export function getChapterAudio(chapterId) {
  return api.get(`/api/audio/${chapterId}`).then((res) => res.data);
}

export function uploadDocument(file, language) {
  const form = new FormData();
  form.append('file', file);
  return api
    .post(`/api/documents/upload${language ? `?language=${encodeURIComponent(language)}` : ''}`, form)
    .then((res) => res.data);
}

export function getEmbedData(generationId) {
  return api.get(`/api/storefront/embed/${generationId}`).then((res) => res.data);
}

export default api;
