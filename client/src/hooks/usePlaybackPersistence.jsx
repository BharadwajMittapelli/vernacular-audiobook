import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export function usePlaybackPersistence(chapterId, currentTime, seek) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const lastSavedRef = useRef(0);

  useEffect(() => {
    if (!userId || !chapterId) return;
    const key = `ekithab-progress:${userId}:${chapterId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const time = parseFloat(saved);
      if (!isNaN(time) && time > 0) {
        seek(time);
      }
    }
  }, [chapterId, userId]);

  useEffect(() => {
    if (!userId || !chapterId) return;
    // Save every 5 seconds or on significant changes
    if (Math.abs(currentTime - lastSavedRef.current) > 5) {
      localStorage.setItem(`ekithab-progress:${userId}:${chapterId}`, currentTime.toString());
      lastSavedRef.current = currentTime;
    }
  }, [currentTime, chapterId, userId]);
}
