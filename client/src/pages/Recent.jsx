import React, { useEffect, useState } from 'react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { useNavigate } from '../context/NavigateContext.jsx';
import { getAllLibraryAudio } from '../services/api.js';
import { BookOpen, Play } from 'lucide-react';

export default function Recent() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllLibraryAudio()
      .then((res) => setItems(res.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout activePath="/recent" onNavClick={navigate}>
      <div className="max-w-7xl mx-auto px-8 py-8">
        <h1 className="text-3xl font-serif font-semibold text-foreground mb-2">Recent Activity</h1>
        <p className="text-sm text-muted-foreground mb-6">Recently generated audiobooks and chapters.</p>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading recent activity...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-semibold">No activity found</p>
            <p className="text-sm text-muted-foreground mt-1">Generated audio chapters will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.chapterId} className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="w-12 h-16 rounded overflow-hidden bg-muted flex items-center justify-center shrink-0">
                  {item.coverUrl ? <img src={item.coverUrl} className="w-full h-full object-cover" /> : <BookOpen className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm truncate">{item.bookTitle}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Chapter {item.sequenceNumber}: {item.chapterTitle}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">{new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => navigate(`/?bookId=${item.bookId}`)}
                  className="px-4 py-2 bg-terracotta text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
                >
                  <Play className="h-3.5 w-3.5" /> Studio
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
