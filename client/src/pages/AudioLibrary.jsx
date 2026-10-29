import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Bell, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from '../context/NavigateContext.jsx';
import { getAllLibraryAudio, getDownloads, exportBookMp3, getChapterAudio } from '../services/api.js';
import { DownloadsView } from '../components/audioLibrary/DownloadsView.jsx';
import { AudioLibrarySidebar } from '../components/audioLibrary/AudioLibrarySidebar.jsx';
import { LibraryTopBar } from '../components/audioLibrary/LibraryTopBar.jsx';
import { AudioTable } from '../components/audioLibrary/AudioTable.jsx';
import { PlayerPanel } from '../components/audioLibrary/PlayerPanel.jsx';
import { ContinueListening } from '../components/audioLibrary/ContinueListening.jsx';
import { DEFAULT_VOICE_BY_LANG } from '../components/audioLibrary/AudioRow.jsx';

export default function AudioLibrary() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const user = session?.user;
  const fullName = user?.user_metadata?.full_name || user?.email || 'V';
  const initials = fullName
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
  const [downloads, setDownloads] = useState([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);
  const [downloadsError, setDownloadsError] = useState(null);
  const [selectedDownloadId, setSelectedDownloadId] = useState(null);

  const audioRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getAllLibraryAudio()
      .then((res) => {
        if (res.success) {
          setItems((res.items || []).map((item) => ({
            ...item,
            voiceName: DEFAULT_VOICE_BY_LANG[item.language] || 'Kaveri',
          })));
        } else {
          setError(res.error || 'Failed to load audio library');
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load audio library');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== 'downloads') return;
    setDownloadsLoading(true);
    setDownloadsError(null);
    getDownloads()
      .then((res) => {
        if (res.success) {
          setDownloads(res.downloads || []);
        } else {
          setDownloadsError(res.error || 'Failed to load downloads');
        }
      })
      .catch((err) => {
        setDownloadsError(err.message || 'Failed to load downloads');
      })
      .finally(() => setDownloadsLoading(false));
  }, [activeTab]);

  const handleDownloadAgain = useCallback(async (item) => {
    if (!item) return;
    try {
      if (item.exportType === 'chapter' && item.bookChapterId) {
        const audioData = await getChapterAudio(item.bookChapterId);
        if (!audioData?.audioUrl) throw new Error('No audio URL available');
        const res = await fetch(audioData.audioUrl);
        if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
        const blob = await res.blob();
        if (blob.type && !blob.type.startsWith('audio/')) {
          throw new Error('Unexpected content type');
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.fileName || 'chapter.mp3';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } else {
        const res = await exportBookMp3(item.bookId);
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        const contentDisp = res.headers['content-disposition'] || '';
        const match = contentDisp.match(/filename\*?=['"]?(?:UTF-8'')?([^"';\s]+)['"]?/);
        const filename = match ? decodeURIComponent(match[1]) : 'audiobook.mp3';
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    } catch (err) {
      console.error('[AudioLibrary] Download again failed:', err);
      throw err;
    }
  }, []);

  const playChapter = useCallback((chapterId) => {
    if (activeChapterId === chapterId) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play().catch(() => {});
        setIsPlaying(true);
      }
      return;
    }
    const item = items.find((i) => i.chapterId === chapterId);
    if (!item) return;
    setActiveChapterId(chapterId);
    setIsPlaying(true);
    setProgress({ currentTime: 0, duration: 0 });
  }, [activeChapterId, isPlaying, items]);

  const handleSeek = useCallback((currentTime, duration) => {
    setProgress({ currentTime, duration });
  }, []);

  const handleSkip = useCallback((seconds) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
  }, []);

  const handlePlaybackRateChange = useCallback((currentRate) => {
    const rates = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (rates.indexOf(currentRate) + 1) % rates.length;
    const newRate = rates[nextIdx];
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  }, []);

  const handleDownload = useCallback(async () => {
    const item = items.find((i) => i.chapterId === activeChapterId);
    if (!item || !item.audioUrl) return;
    try {
      const res = await fetch(item.audioUrl);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      if (blob.type && !blob.type.startsWith('audio/')) {
        throw new Error('Unexpected content type');
      }
      const ext = blob.type === 'audio/mpeg' || blob.type === 'audio/mp3' ? 'mp3' : 'wav';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.chapterTitle}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, [activeChapterId, items]);

  const handleOpenStudio = useCallback(() => {
    const item = items.find((i) => i.chapterId === activeChapterId);
    if (item) {
      navigate(`/?bookId=${item.bookId}`);
    }
  }, [activeChapterId, items, navigate]);

  const activeChapter = items.find((i) => i.chapterId === activeChapterId);

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading audio library…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-terracotta hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 1. Left Panel — Sidebar with nav + Recent Books */}
      <AudioLibrarySidebar
        items={items}
        activePath="/audio-library"
        onNavClick={navigate}
      />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* 2. Global Top Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0 bg-background">
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search audio, books, or chapters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-border"
            />
          </div>
          <div className="flex items-center gap-4 ml-4">
            <button
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
            </button>
            <div
              className="h-8 w-8 rounded-full bg-terracotta text-background flex items-center justify-center text-sm font-medium"
              title={fullName}
            >
              {initials}
            </div>
          </div>
        </header>

        {/* 3. Main Content Area */}
        <main className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden px-6 pt-8 pb-6">
            <LibraryTopBar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              books={items}
              bookFilter={bookFilter}
              onBookFilterChange={setBookFilter}
            />
            <div className="flex-1 overflow-y-auto mt-6 pr-4">
              {activeTab === 'all' ? (
                <>
                  <AudioTable
                    items={items}
                    activeChapterId={activeChapterId}
                    isPlaying={isPlaying}
                    onPlayPause={playChapter}
                    onClick={setActiveChapterId}
                    searchQuery={searchQuery}
                    bookFilter={bookFilter}
                  />
                  <ContinueListening items={items} onPlay={playChapter} />
                </>
              ) : activeTab === 'downloads' ? (
                <div className="flex-1 flex flex-col overflow-y-auto pr-4">
                  <DownloadsView onDownloadAgain={handleDownloadAgain} />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    {activeTab === 'by-book' ? 'By Book' : activeTab === 'favorites' ? 'Favorites' : 'Downloads'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    This feature is coming soon.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel — Player, hidden on mobile */}
          <div className="w-80 shrink-0 bg-muted/40 border-l border-border overflow-y-auto p-4 hidden lg:block">
            <PlayerPanel
              activeChapter={activeChapter || null}
              isPlaying={isPlaying}
              progress={progress}
              playbackRate={playbackRate}
              onPlayPause={(playing) => {
                if (activeChapterId) {
                  setIsPlaying(playing);
                  if (playing) {
                    audioRef.current?.play().catch(() => {});
                  } else {
                    audioRef.current?.pause();
                  }
                }
              }}
              onSeek={handleSeek}
              onSkip={handleSkip}
              onPlaybackRateChange={handlePlaybackRateChange}
              onDownload={handleDownload}
              onOpenStudio={handleOpenStudio}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
