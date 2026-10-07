import React from 'react';
import { TranscriptHighlighter } from './TranscriptHighlighter.jsx';
import { PlaybackControls } from './PlaybackControls.jsx';
import { useAudioPlayer } from '../../hooks/useAudioPlayer.jsx';

export function ReadAlongPlayer({ audioUrl, alignment, chapterText }) {
  const {
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
  } = useAudioPlayer(audioUrl, alignment);

  if (!audioUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-center">No audio generated yet. Open configuration to generate audio.</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full pb-28">
      <div className="flex-1 overflow-y-auto p-4 pr-12">
        <TranscriptHighlighter
          alignment={alignment}
          currentSentenceIndex={currentSentenceIndex}
          onSentenceClick={seekToSentence}
        />
      </div>
      <PlaybackControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        playbackRate={playbackRate}
        onPlay={play}
        onPause={pause}
        onSeek={seek}
        onRewind={() => seek(Math.max(0, currentTime - 15))}
        onRateChange={changeRate}
      />
    </div>
  );
}