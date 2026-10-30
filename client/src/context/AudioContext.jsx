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
    activeChapter: null, // { chapterId, bookId, title, coverUrl, audioUrl, alignment }
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
    const onEnded = () => updateState({ isPlaying: false });
    const onError = async (e) => {
      if (audio.error?.code === 4) { // MEDIA_ERR_SRC_NOT_SUPPORTED/FORBIDDEN
        const ch = state.activeChapter;
        if (ch) {
          const fresh = await getChapterAudio(ch.chapterId);
          audio.src = fresh.audioUrl;
          audio.currentTime = state.currentTime;
          audio.play();
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
    if (chapter?.chapterId !== state.activeChapter?.chapterId) {
      audioRef.current.src = chapter.audioUrl;
      updateState({ activeChapter: chapter, isPlaying: true });
    } else {
      updateState({ isPlaying: true });
    }
    await audioRef.current.play();
  }, [state.activeChapter]);

  const pause = useCallback(() => {
    audioRef.current.pause();
    updateState({ isPlaying: false });
  }, []);

  const seek = useCallback((time) => {
    audioRef.current.currentTime = time;
    updateState({ currentTime: time });
  }, []);

  return (
    <AudioContext.Provider value={{ ...state, play, pause, seek, audioRef }}>
      {children}
    </AudioContext.Provider>
  );
}

export const useAudio = () => useContext(AudioContext);
