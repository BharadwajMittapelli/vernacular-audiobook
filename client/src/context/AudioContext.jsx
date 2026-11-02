import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import { getChapterAudio } from '../services/api.js';

const AudioContext = createContext(null);

export function AudioProvider({ children }) {
  const audioRef = useRef(new Audio());
  const { session } = useAuth();
  const [state, setState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1.0,
    activeChapter: null,
  });

  // Ref for current chapter to avoid stale closure in event handlers
  const activeChapterRef = useRef(state.activeChapter);
  activeChapterRef.current = state.activeChapter;

  // Ref for retry state in error recovery
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  const BASE_DELAY = 1000;

  const updateState = (updates) => setState((prev) => ({ ...prev, ...updates }));

  // Clear playback state on logout
  useEffect(() => {
    if (!session) {
      audioRef.current.pause();
      audioRef.current.src = '';
      updateState({
        isPlaying: false,
        activeChapter: null,
        currentTime: 0,
        duration: 0,
      });
      retryCountRef.current = 0;
    }
  }, [session]);

  useEffect(() => {
    const audio = audioRef.current;

    const onTimeUpdate = () => updateState({ currentTime: audio.currentTime });
    const onLoadedMetadata = () => updateState({ duration: audio.duration });
    const onEnded = () => updateState({ isPlaying: false, currentTime: audio.duration });

    const onError = async (e) => {
      console.error('[AudioContext] Audio error:', audio.error);
      updateState({ isPlaying: false });

      // Only recover from MEDIA_ERR_SRC_NOT_SUPPORTED (code 4) or MEDIA_ERR_DECODE (code 3)
      // These typically indicate expired signed URLs or codec issues
      const isRecoverableError = audio.error?.code === 4 || audio.error?.code === 3;

      if (isRecoverableError && retryCountRef.current < MAX_RETRIES) {
        const ch = activeChapterRef.current;
        if (ch) {
          const delay = BASE_DELAY * Math.pow(2, retryCountRef.current);
          console.log(`[AudioContext] Retrying audio recovery in ${delay}ms (attempt ${retryCountRef.current + 1}/${MAX_RETRIES})`);
          await new Promise(r => setTimeout(r, delay));
          retryCountRef.current++;

          try {
            const fresh = await getChapterAudio(ch.chapterId);
            if (fresh?.audioUrl) {
              audio.src = fresh.audioUrl;
              audio.currentTime = audioRef.current.currentTime || 0;
              await audio.play();
              updateState({ isPlaying: true });
              retryCountRef.current = 0; // reset on success
              return;
            }
          } catch (err) {
            console.error('[AudioContext] Failed to recover audio:', err);
          }
        }
      }

      // Max retries exceeded or non-recoverable error
      retryCountRef.current = 0;
      updateState({ isPlaying: false });
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
    // Only re-attach listeners when chapter changes, not on every timeupdate
  }, [state.activeChapter]);

  const play = useCallback(async (chapter) => {
    if (!chapter?.audioUrl) {
      console.warn('[AudioContext] Play called without audioUrl');
      return;
    }

    const audio = audioRef.current;

    // If chapter changed, update src and state immediately
    if (chapter?.chapterId !== activeChapterRef.current?.chapterId) {
      audio.src = chapter.audioUrl;
      // Update ref immediately to avoid stale reads in onError
      activeChapterRef.current = chapter;
      updateState({
        activeChapter: chapter,
        currentTime: 0,
        duration: 0,
      });
      // Reset retry counter on new chapter
      retryCountRef.current = 0;
    }

    try {
      audio.playbackRate = state.playbackRate;
      await audio.play();
      updateState({ isPlaying: true });
    } catch (err) {
      // If play() fails due to expired URL, onError will handle recovery
      console.error('[AudioContext] Play failed:', err);
      updateState({ isPlaying: false });
    }
  }, [state.playbackRate]);

  const pause = useCallback(() => {
    audioRef.current.pause();
    updateState({ isPlaying: false });
  }, []);

  const seek = useCallback((time) => {
    const audio = audioRef.current;
    audio.currentTime = time;
    updateState({ currentTime: time });
  }, []);

  const setPlaybackRate = useCallback((rate) => {
    audioRef.current.playbackRate = rate;
    updateState({ playbackRate: rate });
  }, []);

  return (
    <AudioContext.Provider value={{ ...state, play, pause, seek, setPlaybackRate, audioRef }}>
      {children}
    </AudioContext.Provider>
  );
}

export const useAudio = () => useContext(AudioContext);