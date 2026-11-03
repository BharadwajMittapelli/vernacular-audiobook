import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from '../context/NavigateContext.jsx';
import { getAllLibraryAudio, getFavorites, addFavorite, removeFavorite, getDownloads, exportBookMp3, getChapterAudio } from '../services/api.js';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DownloadsView } from '../components/audioLibrary/DownloadsView.jsx';
import { ByBookView } from '../components/audioLibrary/ByBookView.jsx';
import { FavoritesView } from '../components/audioLibrary/FavoritesView.jsx';
import { LibraryTopBar } from '../components/audioLibrary/LibraryTopBar.jsx';
import { AudioTable } from '../components/audioLibrary/AudioTable.jsx';
import { PlayerPanel } from '../components/audioLibrary/PlayerPanel.jsx';
import { DEFAULT_VOICE_BY_LANG, LANGUAGE_FLAG, LANGUAGE_NAME } from '../components/audioLibrary/AudioRow.jsx';
import { useAudio } from '../context/AudioContext.jsx';

export default function AudioLibrary() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { activeChapter: globalActiveChapter, isPlaying, currentTime, duration, playbackRate, play, pause, seek, setPlaybackRate } = useAudio();

  const [items, setItems] = useState([]);
  const [byBookData, setByBookData] = useState([]);
  const [favorites, setFavorites] = useState(new Set());
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [byBookLoading, setByBookLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [bookFilter, setBookFilter] = useState(null);
  const audioUrlCache = useRef(new Map());

  const loadAllAudio = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAllLibraryAudio();
      if (res.success) {
        setItems((res.items || []).map((item) => ({
          ...item,
          voiceName: DEFAULT_VOICE_BY_LANG[item.language] || 'Kaveri',
          flag: LANGUAGE_FLAG[item.language] || '🇮🇳',
          langName: LANGUAGE_NAME[item.language] || 'English',
        })));
      } else {
        setError(res.error || 'Failed to load audio library');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadByBook = useCallback(async () => {
    setByBookLoading(true);
    try {
      const bookMap = new Map();
      for (const item of items || []) {
        const bookId = item.bookId;
        if (!bookMap.has(bookId)) {
          bookMap.set(bookId, {
            bookId,
            bookTitle: item.bookTitle,
            coverUrl: item.coverUrl,
            lastPlayedAt: item.createdAt,
            playedChaptersCount: 0,
            totalChapters: item.totalChapters ?? 0,
            chapters: [],
          });
        }
        const bookEntry = bookMap.get(bookId);
        bookEntry.playedChaptersCount += 1;
        bookEntry.chapters.push({
          chapterId: item.chapterId,
          chapterTitle: item.chapterTitle,
          sequenceNumber: item.sequenceNumber,
          lastPlayedAt: item.createdAt,
          durationSeconds: item.durationSeconds,
          language: item.language,
        });
      }
      setByBookData(
        Array.from(bookMap.values())
          .sort((a, b) => new Date(b.lastPlayedAt) - new Date(a.lastPlayedAt))
          .map((book) => ({
            ...book,
            chapters: book.chapters.sort((a, b) => a.sequenceNumber - b.sequenceNumber),
          }))
      );
    } catch (err) {
      console.error('Failed to build by-book data:', err);
    } finally {
      setByBookLoading(false);
    }
  }, [items]);

  const loadFavorites = useCallback(async () => {
    try {
      const res = await getFavorites();
      if (res.success) {
        const favSet = new Set((res.favorites || []).map((f) => f.chapterId));
        setFavorites(favSet);
      }
    } catch (err) {
      console.error('Failed to load favorites:', err);
    } finally {
      setFavoritesLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadAllAudio();
    loadFavorites();
  }, [loadAllAudio, loadFavorites]);

  useEffect(() => {
    if (activeTab === 'by-book') {
      loadByBook();
    }
  }, [activeTab, loadByBook]);

  const playChapter = useCallback(async (chapterId) => {
    const chapter = items.find((i) => i.chapterId === chapterId);
    if (!chapter) return;

    setSelectedChapterId(chapterId);

    // Prefer the resolved audioUrl from items (fresh signed URL from /all-audio)
    let audioUrl = chapter.audioUrl;

    // Fall back to cache
    if (!audioUrl) {
      audioUrl = audioUrlCache.current.get(chapterId);
    }

    // Final fallback: fetch fresh URL via getChapterAudio
    if (!audioUrl) {
      try {
        const res = await getChapterAudio(chapterId);
        audioUrl = res?.audioUrl;
        if (audioUrl) {
          audioUrlCache.current.set(chapterId, audioUrl);
        }
      } catch (err) {
        console.error('Failed to fetch audio URL:', err);
        return;
      }
    }

    if (!audioUrl) return;

    const chapterData = {
      chapterId: chapter.chapterId,
      bookId: chapter.bookId,
      title: chapter.chapterTitle,
      coverUrl: chapter.coverUrl,
      audioUrl,
      alignment: null,
    };

    await play(chapterData);
  }, [items, play, setSelectedChapterId]);

  const handleSelectChapter = useCallback((chapterId) => {
    setSelectedChapterId(chapterId);
  }, []);

  const handlePlayPause = useCallback((playing) => {
    if (playing) {
      const chapter = items.find((i) => i.chapterId === selectedChapterId);
      if (chapter && globalActiveChapter?.chapterId === chapter.chapterId) {
        play(globalActiveChapter);
      }
    } else {
      pause();
    }
  }, [selectedChapterId, items, globalActiveChapter, play, pause]);

  const handleSeek = useCallback((time) => {
    seek(time);
  }, [seek]);

  const handleSkip = useCallback((seconds) => {
    seek(currentTime + seconds);
  }, [currentTime, seek]);

  const handlePlaybackRateChange = useCallback(() => {
    const next = playbackRate >= 2 ? 0.75 : playbackRate < 1.5 ? 1.5 : 2;
    setPlaybackRate(next);
  }, [playbackRate, setPlaybackRate]);

  const handleDownload = useCallback(() => {
    const chapter = items.find((i) => i.chapterId === selectedChapterId);
    if (chapter) exportBookMp3(chapter.bookId);
  }, [selectedChapterId, items]);

  const handleOpenStudio = useCallback(() => {
    const chapter = items.find((i) => i.chapterId === selectedChapterId);
    if (chapter && chapter.bookId) {
      navigate(`/?bookId=${chapter.bookId}`);
    }
  }, [selectedChapterId, items, navigate]);

  const toggleFavorite = useCallback(async (chapterId, bookId) => {
    const isFav = favorites.has(chapterId);
    const newFavorites = new Set(favorites);
    
    if (isFav) {
      newFavorites.delete(chapterId);
    } else {
      newFavorites.add(chapterId);
    }
    setFavorites(newFavorites);

    try {
      if (isFav) {
        await removeFavorite(chapterId);
      } else {
        await addFavorite({ bookId, chapterId });
      }
    } catch (err) {
      setFavorites(favorites);
      console.error('Failed to toggle favorite:', err);
    }
  }, [favorites]);

  const selectedChapter = items.find((i) => i.chapterId === selectedChapterId);
  const displayChapter = selectedChapter || globalActiveChapter;

  const uniqueBooks = [...new Map(items.map((b) => [b.bookId, b])).values()];

  const favoriteItems = items.filter((item) => favorites.has(item.chapterId));

  return (
    <AppLayout
      activePath="/audio-library"
      onNavClick={navigate}
      contextualSidebar={
        displayChapter && (
          <div className="p-4 border-t border-border">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Now Playing</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-14 bg-muted rounded overflow-hidden">
                {displayChapter.coverUrl && <img src={displayChapter.coverUrl} className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{displayChapter.bookTitle}</p>
                <p className="text-xs text-muted-foreground truncate">{displayChapter.chapterTitle}</p>
              </div>
            </div>
          </div>
        )
      }
    >
      <div className="flex h-full overflow-hidden">
        <div className="flex-1 flex flex-col px-8 py-8 overflow-hidden">
          <LibraryTopBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            books={activeTab === 'all' ? items : uniqueBooks}
            bookFilter={bookFilter}
            onBookFilterChange={setBookFilter}
          />
          <div className="flex-1 overflow-y-auto mt-6">
            {activeTab === 'all' ? (
              <>
                <AudioTable
                  items={items}
                  activeChapterId={globalActiveChapter?.chapterId || selectedChapterId}
                  isPlaying={isPlaying}
                  onPlay={playChapter}
                  onSelect={handleSelectChapter}
                  searchQuery={searchQuery}
                  bookFilter={bookFilter}
                  loading={loading}
                  error={error}
                  onRetry={loadAllAudio}
                  isFavorite={(id) => favorites.has(id)}
                  onFavoriteToggle={toggleFavorite}
                  selectedChapterId={selectedChapterId}
                  onChapterUpdate={(updatedChapter) => {
                    setItems((prev) => prev.map((item) =>
                      item.chapterId === updatedChapter.id
                        ? { ...item, chapterTitle: updatedChapter.title }
                        : item
                    ));
                  }}
                />
              </>
            ) : activeTab === 'by-book' ? (
              <>
                <ByBookView
                  books={byBookData}
                  activeChapterId={globalActiveChapter?.chapterId || selectedChapterId}
                  isPlaying={isPlaying}
                  onPlay={playChapter}
                  onSelect={handleSelectChapter}
                  onFavoriteToggle={toggleFavorite}
                  loading={byBookLoading}
                  onChapterUpdate={(updatedChapter) => {
                    setByBookData((prev) => prev.map((book) => ({
                      ...book,
                      chapters: book.chapters.map((ch) =>
                        ch.chapterId === updatedChapter.id
                          ? { ...ch, chapterTitle: updatedChapter.title }
                          : ch
                      ),
                    })));
                    // Also update items to keep All Audio in sync
                    setItems((prev) => prev.map((item) =>
                      item.chapterId === updatedChapter.id
                        ? { ...item, chapterTitle: updatedChapter.title }
                        : item
                    ));
                  }}
                />
              </>
            ) : activeTab === 'favorites' ? (
              <FavoritesView
                items={favoriteItems}
                activeChapterId={globalActiveChapter?.chapterId || selectedChapterId}
                isPlaying={isPlaying}
                onPlay={playChapter}
                onSelect={handleSelectChapter}
                onFavoriteToggle={toggleFavorite}
                loading={!favoritesLoaded}
                selectedChapterId={selectedChapterId}
              />
            ) : activeTab === 'downloads' ? (
              <DownloadsView onDownloadAgain={exportBookMp3} />
            ) : (
              <div className="py-20 text-center text-muted-foreground">Coming soon...</div>
            )}
          </div>
        </div>
        <div className="w-80 border-l border-border bg-card p-4 hidden lg:block overflow-y-auto">
          <PlayerPanel
            activeChapter={displayChapter}
            isPlaying={isPlaying}
            progress={{ currentTime, duration }}
            playbackRate={playbackRate}
            isFavorite={displayChapter ? favorites.has(displayChapter.chapterId) : false}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onSkip={handleSkip}
            onPlaybackRateChange={handlePlaybackRateChange}
            onFavoriteToggle={displayChapter ? () => toggleFavorite(displayChapter.chapterId, displayChapter.bookId) : undefined}
            onDownload={handleDownload}
            onOpenStudio={handleOpenStudio}
            onArtworkUpdate={(coverUrl) => {
              if (displayChapter) {
                setItems((prev) => prev.map((item) =>
                  item.bookId === displayChapter.bookId ? { ...item, coverUrl } : item
                ));
              }
            }}
          />
        </div>
      </div>
    </AppLayout>
  );
}