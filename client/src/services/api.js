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

// ponytail: hold a reference to the session resolver so interceptors can await it
let sessionPromise = supabase.auth.getSession();

// Refresh the session promise whenever auth state changes
supabase.auth.onAuthStateChange((_event, session) => {
  sessionPromise = Promise.resolve(session);
});

api.interceptors.request.use(async (config) => {
  // DEBUG: Log outgoing request
  console.log('[API Interceptor] Request:', config.method?.toUpperCase(), config.url);

  // ponytail: defensive destructuring — protects against Supabase return-shape drift
  // (would otherwise crash as "number N is not iterable" on a non-object return)
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;

    // DEBUG: Log session state
    console.log('[API Interceptor] Session:', session ? { hasToken: !!session.access_token, tokenPreview: session.access_token?.slice(0, 20) + '...' } : 'NO SESSION');

    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
      console.log('[API Interceptor] Auth header set:', config.headers.Authorization?.slice(0, 30) + '...');
    } else {
      // Session not ready yet — wait briefly and retry once
      console.log('[API Interceptor] No token, waiting 100ms...');
      await new Promise((r) => setTimeout(r, 100));
      const { data: refreshed } = await supabase.auth.getSession();
      if (refreshed?.session?.access_token) {
        config.headers.Authorization = `Bearer ${refreshed.session.access_token}`;
        console.log('[API Interceptor] Auth header set after retry:', config.headers.Authorization?.slice(0, 30) + '...');
      } else {
        console.warn('[API Interceptor] STILL no token after retry!');
      }
    }
  } catch (err) {
    console.error('[API Interceptor] Error fetching session:', err);
    // Silently continue without auth header if session fetch fails
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

export function getChapterDetails(chapterId) {
  return api.get(`/api/studio/chapters/${chapterId}`).then((res) => res.data);
}

export function updateChapter(chapterId, payload) {
  return api.put(`/api/studio/chapters/${chapterId}`, payload).then((res) => res.data);
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

export function getPublicBook(bookId) {
  return api.get(`/api/storefront/book/${bookId}`).then((res) => res.data);
}

export function exportBookMp3(bookId) {
  return api.get(`/api/studio/${bookId}/export-mp3`, { responseType: 'blob' });
}

export function spatialPreview({ chapterText, bookId }) {
  return api
    .post('/api/studio/spatial-preview', { chapterText, bookId }, { responseType: 'blob' })
    .then((res) => res.data);
}

export function getBooks() {
  return api.get('/api/studio').then((res) => res.data);
}

export function getBookDetails(bookId) {
  return api.get(`/api/studio/${bookId}`).then((res) => res.data);
}

export function getBookStatus(bookId) {
  return api.get(`/api/studio/${bookId}/status`).then((res) => res.data);
}

export function createBook({ title, chapters }) {
  return api.post('/api/studio', { title, chapters }).then((res) => res.data);
}

export function deleteBook(bookId) {
  return api.delete(`/api/studio/${bookId}`).then((res) => res.data);
}

export function getSettingsStats() {
  return api.get('/api/settings/stats').then((res) => res.data);
}

export function getAllLibraryAudio() {
  return api.get('/api/library/all-audio').then((res) => res.data);
}

export function updateProfile({ full_name, avatar_url }) {
  return api.put('/api/settings/profile', { full_name, avatar_url }).then((res) => res.data);
}

export default api;
