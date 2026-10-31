import { useRef, useEffect, useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useAudio } from '../context/AudioContext.jsx';

export function useAudioPlayer(audioUrl, alignment = [], options = {}) {
  const { onPlaybackVerified, chapterId, bookId } = options;

  const { session } = useAuth();
  const { 
    isPlaying, 
    currentTime, 
    duration, 
    playbackRate,
    play: audioPlay, 
    pause: audioPause, 
    seek: audioSeek, 
    setPlaybackRate: audioSetPlaybackRate,
    audioRef: audioContextRef
  } = useAudio();

  const hasLoggedPlaybackRef = useRef(false);
  const currentAudioUrlRef = useRef(audioUrl);
  const currentChapterIdRef = useRef(chapterId ?? null);
  const currentBookIdRef = useRef(bookId ?? null);
  const playbackVerifiedRef = useRef(false);

  const audioRef = useRef(null);
  const alignmentRef = useRef(alignment);

  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);

  useEffect(() => {
    alignmentRef.current = alignment;
  }, [alignment]);

  // Reset tracking when audioUrl changes (new chapter)
  useEffect(() => {
    if (audioUrl !== currentAudioUrlRef.current) {
      hasLoggedPlaybackRef.current = false;
      playbackVerifiedRef.current = false;
      currentAudioUrlRef.current = audioUrl;
    }
  }, [audioUrl]);

  // Reset tracking when chapter/book IDs change (rapid chapter switching protection)
  useEffect(() => {
    if (chapterId !== currentChapterIdRef.current || bookId !== currentBookIdRef.current) {
      hasLoggedPlaybackRef.current = false;
      playbackVerifiedRef.current = false;
      currentChapterIdRef.current = chapterId ?? null;
      currentBookIdRef.current = bookId ?? null;
    }
  }, [chapterId, bookId]);

  // Use AudioContext's authoritative audio element when available.
  useEffect(() => {
    if (audioContextRef) {
      audioRef.current = audioContextRef.current;
    }
  }, [audioContextRef?.current]);

  // Reset tracking when the shared audio element's URL changes
  useEffect(() => {
    if (audioContextRef && audioRef.current !== audioContextRef.current) {
      hasLoggedPlaybackRef.current = false;
      playbackVerifiedRef.current = false;
      currentAudioUrlRef.current = audioUrl;
    }
  }, [audioContextRef?.current, audioUrl]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (!audioUrl) return;

    const audio = audioRef.current;
    const last = alignment?.[alignment?.length - 1];

    const onTimeUpdate = () => {
      if (last && audio.currentTime >= last.endTime) {
        audio.currentTime = last.endTime;
        audio.pause();
      }
      setCurrentSentenceIndex(
        alignment?.findIndex((a) => audio.currentTime < a.endTime) ?? -1
      );
    };

    const onLoadedMetadata = () => {
      // Duration is set via AudioContext
    };

    // Verify successful playback: audio loaded AND playing (not stalled)
    let playbackVerified = false;
    const onPlay = () => {
      // Fire once per chapter session when playback actually starts
      if (onPlaybackVerified && !hasLoggedPlaybackRef.current && !playbackVerified) {
        playbackVerified = true;
        playbackVerifiedRef.current = true;
        hasLoggedPlaybackRef.current = true;
        onPlaybackVerified(currentChapterIdRef.current, currentBookIdRef.current);
      }
    };

    const onPause = () => {
      // isPlaying is managed by AudioContext
    };
    const onEnded = () => {
      // isPlaying is managed by AudioContext
    };
    const onError = () => {
      // Playback failed — reset verification so retry can log
      playbackVerified = false;
      playbackVerifiedRef.current = false;
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
    };
  }, [audioUrl, onPlaybackVerified, chapterId, bookId]);

  const play = useCallback(() => {
    if (!audioUrl) return;
    const chapter = { audioUrl, chapterId, bookId };
    return audioPlay(chapter);
  }, [audioPlay, audioUrl, chapterId, bookId]);

  const pause = useCallback(() => {
    audioPause(); // Use AudioContext's pause method
  }, [audioPause]);

  const seek = useCallback((seconds) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    audioSeek(seconds); // Use AudioContext's seek method
  }, [audioSeek]);

  const setPlaybackRate = useCallback((rate) => {
    audioSetPlaybackRate(rate);
  }, [audioSetPlaybackRate]);

  const seekToSentence = useCallback(
    (index) => alignment[index] && seek(alignment[index].startTime),
    [alignment, seek]
  );

  return {
    currentTime,
    duration,
    isPlaying,
    playbackRate,
    currentSentenceIndex,
    play,
    pause,
    seek,
    setPlaybackRate,
    seekToSentence,
  };
}