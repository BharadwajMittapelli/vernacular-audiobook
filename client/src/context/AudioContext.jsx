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
      if (audio.error?.code === 4) { // MEDIA_ERR_SRC_NOT_SUPPORTED/FORBIDDEN
        const ch = state.activeChapter;
        if (ch) {
          try {
            const fresh = await getChapterAudio(ch.chapterId);
            if (fresh?.audioUrl) {
              audio.src = fresh.audioUrl;
              audio.currentTime = state.currentTime;
              await audio.play();
              updateState({ isPlaying: true });
            }
          } catch (err) {
            console.error('[AudioContext] Failed to recover audio:', err);
            updateState({ isPlaying: false });
          }
        }
      }
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
  }, [state.activeChapter, state.currentTime]);

  const play = useCallback(async (chapter) => {
    if (!chapter?.audioUrl) {
      console.warn('[AudioContext] Play called without audioUrl');
      return;
    }

    const audio = audioRef.current;

    if (chapter?.chapterId !== state.activeChapter?.chapterId) {
      audio.src = chapter.audioUrl;
      // Reset time and duration for new chapter
      updateState({
        activeChapter: chapter,
        currentTime: 0,
        duration: 0,
      });
    }

    try {
      audio.playbackRate = state.playbackRate;
      await audio.play();
      updateState({ isPlaying: true });
    } catch (err) {
      console.error('[AudioContext] Play failed:', err);
      updateState({ isPlaying: false });
    }
  }, [state.activeChapter, state.playbackRate]);

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