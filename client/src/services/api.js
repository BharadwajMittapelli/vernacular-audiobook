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

// Shared in-flight refresh promise to prevent concurrent refreshes
let refreshPromise = null;

// Helper to get a valid session, triggering refresh if needed
async function getValidSession() {
  const { data } = await supabase.auth.getSession();
  if (data?.session?.access_token) {
    return data.session;
  }
  if (!refreshPromise) {
    refreshPromise = supabase.auth.refreshSession().finally(() => { refreshPromise = null; });
  }
  const { data: refreshed, error } = await refreshPromise;
  if (error || !refreshed?.session?.access_token) {
    throw error || new Error('No session after refresh');
  }
  return refreshed.session;
}

// Refresh the session promise whenever auth state changes
supabase.auth.onAuthStateChange((_event, session) => {
  // Session is automatically updated by Supabase client
});

api.interceptors.request.use(async (config) => {
  try {
    const session = await getValidSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (err) {
    console.error('[API Interceptor] Auth failed:', err.message);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const session = await getValidSession();
        if (session?.access_token) {
          originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
          return api.request(originalRequest);
        }
      } catch (refreshErr) {
        console.error('[API Interceptor] Token refresh failed:', refreshErr.message);
        await supabase.auth.signOut();
      }
    }
    return Promise.reject(error);
  }
);

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

export function getLastOpenedBook() {
  return api.get('/api/studio/last-opened-book').then((res) => res.data?.book);
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

export function logExport(download) {
  return api.post('/api/library/downloads/log', download).then((res) => res.data);
}

export function logPlayback({ bookId, chapterId }) {
  return api.post('/api/library/playback/log', { bookId, chapterId }).then((res) => res.data);
}

export function getPlaybackHistory() {
  return api.get('/api/library/playback/history').then((res) => res.data);
}

export function getDownloads() {
  return api.get('/api/library/downloads').then((res) => res.data);
}

export function deleteDownload(id) {
  return api.delete(`/api/library/downloads/${id}`).then((res) => res.data);
}

export function getByBook() {
  return api.get('/api/library/by-book').then((res) => res.data);
}

export function getFavorites() {
  return api.get('/api/library/favorites').then((res) => res.data);
}

export function addFavorite({ bookId, chapterId }) {
  return api.post('/api/library/favorites', { bookId, chapterId }).then((res) => res.data);
}

export function removeFavorite(chapterId) {
  return api.delete(`/api/library/favorites/${chapterId}`).then((res) => res.data);
}

export default api;
