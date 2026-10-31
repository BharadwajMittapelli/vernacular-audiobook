import React from 'react';
import { AudioRow } from './AudioRow.jsx';
import { Loader2, Heart } from 'lucide-react';

export function FavoritesView({
  items,
  activeChapterId,
  isPlaying,
  onPlay,
  onSelect,
  onFavoriteToggle,
  loading = false,
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-3" />
        <p className="text-sm text-muted-foreground">Loading favorites…</p>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Heart className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground">No favorites yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Tap the heart icon on any chapter to save it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <AudioRow
          key={item.chapterId}
          item={item}
          isActive={activeChapterId === item.chapterId}
          isPlaying={isPlaying}
          isFavorite={true}
          onPlay={onPlay}
          onSelect={onSelect}
          onFavoriteToggle={onFavoriteToggle}
        />
      ))}
    </div>
  );
}
