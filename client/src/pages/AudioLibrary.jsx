import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from '../context/NavigateContext.jsx';
import { getAllLibraryAudio, getDownloads, exportBookMp3, getChapterAudio } from '../services/api.js';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DownloadsView } from '../components/audioLibrary/DownloadsView.jsx';
import { LibraryTopBar } from '../components/audioLibrary/LibraryTopBar.jsx';
import { AudioTable } from '../components/audioLibrary/AudioTable.jsx';
import { PlayerPanel } from '../components/audioLibrary/PlayerPanel.jsx';
import { ContinueListening } from '../components/audioLibrary/ContinueListening.jsx';
import { DEFAULT_VOICE_BY_LANG } from '../components/audioLibrary/AudioRow.jsx';

export default function AudioLibrary() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [bookFilter, setBookFilter] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const audioRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    getAllLibraryAudio()
      .then((res) => {
        if (res.success) {
          setItems((res.items || []).map((item) => ({
            ...item,
            voiceName: DEFAULT_VOICE_BY_LANG[item.language] || 'Kaveri',
          })));
        } else setError(res.error || 'Failed to load');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const playChapter = (chapterId) => {
    if (activeChapterId === chapterId) {
      setIsPlaying(!isPlaying);
      isPlaying ? audioRef.current?.pause() : audioRef.current?.play();
      return;
    }
    setActiveChapterId(chapterId);
    setIsPlaying(true);
  };

  const activeChapter = items.find((i) => i.chapterId === activeChapterId);

  return (
    <AppLayout 
      activePath="/audio-library" 
      onNavClick={navigate}
      contextualSidebar={
        activeChapter && (
            <div className="p-4 border-t border-border">
                <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Now Playing</p>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-14 bg-muted rounded overflow-hidden">
                        {activeChapter.coverUrl && <img src={activeChapter.coverUrl} className="w-full h-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{activeChapter.bookTitle}</p>
                        <p className="text-xs text-muted-foreground truncate">{activeChapter.chapterTitle}</p>
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
            books={items}
            bookFilter={bookFilter}
            onBookFilterChange={setBookFilter}
          />
          <div className="flex-1 overflow-y-auto mt-6">
            {activeTab === 'all' ? (
                <>
                    <AudioTable items={items} activeChapterId={activeChapterId} isPlaying={isPlaying} onPlayPause={playChapter} searchQuery={searchQuery} />
                    <ContinueListening items={items} onPlay={playChapter} />
                </>
            ) : <div className="py-20 text-center text-muted-foreground">Coming soon...</div>}
          </div>
        </div>
        <div className="w-80 border-l border-border bg-card p-4 hidden lg:block overflow-y-auto">
            <PlayerPanel 
                activeChapter={activeChapter} 
                isPlaying={isPlaying} 
                onPlayPause={setIsPlaying}
                onOpenStudio={() => activeChapter && navigate(`/?bookId=${activeChapter.bookId}`)}
            />
        </div>
      </div>
    </AppLayout>
  );
}
