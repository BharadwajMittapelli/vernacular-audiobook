import { useState, useRef, useEffect, useCallback } from 'react';

export function useAudioPlayer(audioUrl, alignment) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);
  
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioUrl) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current.duration);
      });
      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.addEventListener('ended', handleEnded);
      
      return () => {
        audioRef.current?.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current?.removeEventListener('ended', handleEnded);
        audioRef.current?.pause();
        audioRef.current = null;
      };
    }
  }, [audioUrl]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      
      const sentenceIndex = alignment.findIndex(
        a => time >= a.startTime && time <= a.endTime
      );
      if (sentenceIndex !== -1 && sentenceIndex !== currentSentenceIndex) {
        setCurrentSentenceIndex(sentenceIndex);
      }
    }
  }, [alignment, currentSentenceIndex]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentSentenceIndex(-1);
  }, []);

  const play = useCallback(() => {
    audioRef.current?.play();
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const seek = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const changeRate = useCallback((rate) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  }, []);

  const seekToSentence = useCallback((sentenceIndex) => {
    const entry = alignment[sentenceIndex];
    if (entry) {
      seek(entry.startTime);
    }
  }, [alignment, seek]);

  return {
    currentTime,
    duration,
    isPlaying,
    playbackRate,
    currentSentenceIndex,
    play,
    pause,
    seek,
    changeRate,
    seekToSentence,
  };
}