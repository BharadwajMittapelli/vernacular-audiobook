import { useState, useRef, useEffect, useCallback } from 'react';

export function useAudioPlayer(audioUrl, alignment = []) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);

  const audioRef = useRef(null);
  const alignmentRef = useRef(alignment);

  useEffect(() => {
    alignmentRef.current = alignment;
  }, [alignment]);

  useEffect(() => {
    if (!audioUrl) return;
    setCurrentTime(0);
    setCurrentSentenceIndex(-1);
    setIsPlaying(false);

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.playbackRate = playbackRate;

    const last = alignment[alignment.length - 1];

    const onTimeUpdate = () => {
      const currentAlignment = alignmentRef.current;
      const currentLast = currentAlignment[currentAlignment.length - 1];

      if (currentLast && audio.currentTime >= currentLast.endTime) {
        audio.currentTime = currentLast.endTime;
        audio.pause();
      }
      setCurrentTime(audio.currentTime);
      setCurrentSentenceIndex(currentAlignment.findIndex((a) => audio.currentTime < a.endTime));
    };

    const onLoadedMetadata = () => setDuration(audio.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, [audioUrl]);

  const play = useCallback(() => audioRef.current?.play(), []);
  const pause = useCallback(() => audioRef.current?.pause(), []);
  const seek = useCallback((seconds) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  }, []);
  const setPlaybackRate = useCallback((rate) => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
    setPlaybackRateState(rate);
  }, []);
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
