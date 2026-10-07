import React from 'react';
import { Play, Volume2 } from 'lucide-react';
import { ReadAlongPlayer } from '../player/ReadAlongPlayer.jsx';

export function AudioStorefrontWidget({ audioUrl, alignment, chapterText, title }) {
  const [isPlaying, setIsPlaying] = React.useState(false);

  if (!audioUrl) {
    return (
      <div className="bg-card border rounded-lg p-6 text-center">
        <Volume2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Audio Not Available</h3>
        <p className="text-muted-foreground">Generate audio in Creator Studio to enable playback.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Volume2 className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">{title || 'Audiobook'}</h3>
            <p className="text-sm text-muted-foreground">Read-Along Enabled</p>
          </div>
        </div>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-full hover:bg-primary/90 transition-colors"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>
      {isPlaying && (
        <ReadAlongPlayer
          audioUrl={audioUrl}
          alignment={alignment}
          chapterText={chapterText}
        />
      )}
    </div>
  );
}