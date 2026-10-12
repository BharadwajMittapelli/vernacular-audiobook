import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4001',
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

export function getEmbedData(generationId) {
  return api.get(`/api/storefront/embed/${generationId}`).then((res) => res.data);
}

export default api;
