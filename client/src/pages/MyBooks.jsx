import React, { useEffect, useState, useCallback } from 'react';
import { BookOpen, Grid, List, Search, X, Upload, Loader2, AlertCircle, Download, Share2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from '../context/NavigateContext.jsx';
import { getBooks, deleteBook, createBook, exportBookMp3, logExport } from '../services/api.js';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { BookUploader } from '../components/studio/BookUploader.jsx';
import { ActionCard } from '../components/books/ActionCard.jsx';
import { BookCard } from '../components/books/BookCard.jsx';
import { BookEmptyState } from '../components/books/BookEmptyState.jsx';
import { FeatureCards } from '../components/books/FeatureCards.jsx';
import { ShareDialog } from '../components/books/ShareDialog.jsx';

// ... (keep constants and helper functions: TABS, BOOKSHELF_LIMIT, formatRelativeTime)
const TABS = ['bookshelf', 'recent', 'shared', 'favorites'];
const BOOKSHELF_LIMIT = 5;

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

function getStatusColor(status) {
  switch (status) {
    case 'completed': return 'bg-success/10 text-success';
    case 'processing': return 'bg-primary/10 text-primary';
    case 'failed': return 'bg-destructive/10 text-destructive';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'completed': return 'Done';
    case 'processing': return 'Processing';
    case 'failed': return 'Failed';
    default: return 'Pending';
  }
}

export default function MyBooks() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('bookshelf');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ekithab-mybooks-view');
      return saved === 'list' ? 'list' : 'grid';
    }
    return 'grid';
  });
  const [showUploader, setShowUploader] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [shareBook, setShareBook] = useState(null);
  const [deletingBookId, setDeletingBookId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [confirmDeleteBook, setConfirmDeleteBook] = useState(null);
  const [downloadingBookId, setDownloadingBookId] = useState(null);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getBooks();
      if (res.success) {
        setBooks(res.books || []);
      } else {
        setError(res.error || 'Failed to load books');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load books');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ekithab-mybooks-view', viewMode);
    }
  }, [viewMode]);

  const handleDelete = (bookId) => {
    const book = books.find((b) => b.id === bookId);
    if (book) {
      setConfirmDeleteBook(book);
    }
  };

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDeleteBook || deletingBookId) return;
    setDeletingBookId(confirmDeleteBook.id);
    setDeleteError(null);
    try {
      const res = await deleteBook(confirmDeleteBook.id);
      if (res?.success) {
        setBooks((prev) => prev.filter((b) => b.id !== confirmDeleteBook.id));
        setConfirmDeleteBook(null);
      } else {
        setDeleteError(res?.error || 'Failed to delete book');
      }
    } catch (err) {
      setDeleteError(err.response?.data?.error || err.message || 'Failed to delete book');
    } finally {
      setDeletingBookId(null);
    }
  }, [confirmDeleteBook, deletingBookId]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteBook(null);
    setDeleteError(null);
  }, []);

  const handleDownload = useCallback(async (book) => {
    if (!book || downloadingBookId) return;
    setDownloadingBookId(book.id);
    try {
      const res = await exportBookMp3(book.id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const contentDisp = res.headers['content-disposition'] || '';
      const match = contentDisp.match(/filename\*?=['"]?(?:UTF-8'')?([^"';\s]+)['"]?/);
      const filename = match ? decodeURIComponent(match[1]) : `${book.title || 'audiobook'}.mp3`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      const ext = res.data.type === 'audio/mpeg' || res.data.type === 'audio/mp3' ? 'mp3' : 'wav';
      logExport({
        bookId: book.id,
        bookTitle: book.title,
        bookCoverUrl: book.cover_url,
        fileName: filename,
        fileFormat: ext,
        fileSize: res.data.size,
      }).catch((err) => console.error('[MyBooks] Failed to log export:', err));
    } catch (err) {
      console.error('[MyBooks] Export failed:', err);
    } finally {
      setDownloadingBookId(null);
    }
  }, [downloadingBookId]);

  function DeleteConfirmDialog({ isOpen, onClose, bookTitle, onConfirm, deleting }) {
    if (!isOpen) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <div
          className="bg-background rounded-xl p-6 max-w-md w-full mx-4 relative shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
            disabled={deleting}
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold text-foreground">Delete book</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Are you sure you want to delete <strong>"{bookTitle}"</strong>? This action cannot be undone.
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-background hover:opacity-90 transition-colors disabled:opacity-50"
              disabled={deleting}
            >
              {deleting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </span>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleUpload = useCallback(() => {
    setShowUploader(true);
    setUploadError(null);
  }, []);

  const handleCloseUploader = useCallback(() => {
    setShowUploader(false);
    setUploadError(null);
  }, []);

  const handleDocumentLoaded = useCallback(
    async ({ title, chapters }) => {
      setUploadError(null);
      try {
        const res = await createBook({ title, chapters });
        if (!res || !res.success) throw new Error(res?.error || 'Failed to create book');
        setShowUploader(false);
        setBooks((prev) => [res.book, ...prev]);
        await new Promise((r) => setTimeout(r, 300));
        navigate(`/?bookId=${res.book.id}`);
      } catch (err) {
        setUploadError(err.response?.data?.error || err.message || 'Failed to create book');
      }
    },
    [navigate]
  );

  const filteredBooks = books.filter((book) =>
    (book.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedBooks = [...books].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const bookshelfIds = new Set(sortedBooks.slice(0, BOOKSHELF_LIMIT).map((b) => b.id));
  const bookshelfBooks = sortedBooks.filter((b) => bookshelfIds.has(b.id));
  const recentBooksFull = sortedBooks.filter((b) => !bookshelfIds.has(b.id));
  
  const displayBooks = activeTab === 'bookshelf' ? bookshelfBooks.filter(b => (b.title || '').toLowerCase().includes(searchQuery.toLowerCase())) :
                      activeTab === 'recent' ? recentBooksFull.filter(b => (b.title || '').toLowerCase().includes(searchQuery.toLowerCase())) :
                      filteredBooks;

  const tabsWithCounts = [
    { key: 'bookshelf', label: 'Bookshelf', count: bookshelfBooks.length },
    { key: 'recent', label: 'Recent', count: recentBooksFull.length },
    { key: 'shared', label: 'Shared' },
    { key: 'favorites', label: 'Favorites' },
  ];

  return (
    <AppLayout activePath="/my-books" onNavClick={navigate}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground">My Books</h1>
          <p className="text-muted-foreground mt-1">Manage your uploaded books.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <ActionCard
                icon={<BookOpen className="h-6 w-6" />}
                title="Create an Audiobook"
                description="Upload a document and generate audio."
                onClick={() => setShowUploader(true)}
            />
            <ActionCard
                icon={<Upload className="h-6 w-6" />}
                title="Publish"
                description="Share your audiobook."
                disabled={books.length === 0}
                onShare={() => setShareBook(books.find((b) => b.status === 'completed') || books[0])}
            />
        </div>

        <div className="flex items-center gap-6 border-b border-border mb-6">
          {tabsWithCounts.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === key ? 'border-terracotta text-terracotta' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{label}</span>
              {count !== undefined && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{count}</span>}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search books and series..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            />
          </div>
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${
                viewMode === 'grid' ? 'bg-terracotta/10 text-terracotta' : 'hover:bg-muted text-muted-foreground'
              }`}
              aria-label="Grid view"
              title="Grid view"
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors border-l border-border ${
                viewMode === 'list' ? 'bg-terracotta/10 text-terracotta' : 'hover:bg-muted text-muted-foreground'
              }`}
              aria-label="List view"
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? <div className="text-center py-20">Loading...</div> : displayBooks.length === 0 ? <BookEmptyState onUpload={() => setShowUploader(true)} /> : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {displayBooks.map(b => <BookCard key={b.id} book={b} onOpen={() => navigate(`/?bookId=${b.id}`)} onDelete={() => handleDelete(b.id)} onShare={() => setShareBook(b)} deleting={deletingBookId} />)}
            </div>
        ) : (
            <div className="space-y-3">
                {displayBooks.map(b => (
                  <div key={b.id} className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="w-12 h-16 shrink-0 rounded-lg overflow-hidden bg-terracotta/10 flex items-center justify-center text-terracotta font-bold text-sm">
                      {b.cover_url ? <img src={b.cover_url} alt={b.title} className="w-full h-full object-cover" /> : (b.title || '').slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">{b.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {b.total_chapters} chapter{b.total_chapters !== 1 ? 's' : ''} · {getStatusLabel(b.status)}
                      </p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${getStatusColor(b.status)}`}>
                        {getStatusLabel(b.status)}
                      </span>
                    </div>
                    <button onClick={() => navigate(`/?bookId=${b.id}`)} className="shrink-0 bg-foreground text-background text-xs font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">Open</button>
                    {b.status === 'completed' && (
                      <button onClick={() => handleDownload(b)} disabled={downloadingBookId === b.id} className="shrink-0 p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50" aria-label="Download MP3" title="Download MP3">
                        {downloadingBookId === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </button>
                    )}
                    <button onClick={() => setShareBook(b)} className="shrink-0 p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" aria-label="Share" title="Share">
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(b.id)} disabled={deletingBookId === b.id} className="shrink-0 p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50" aria-label="Delete book" title="Delete book">
                      {deletingBookId === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    </button>
                  </div>
                ))}
            </div>
        )}
      </div>

       {showUploader && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleCloseUploader}>
           <div className="bg-background rounded-xl p-8 max-w-xl w-full mx-4 relative shadow-xl" onClick={(e) => e.stopPropagation()}>
             <button onClick={handleCloseUploader} className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">
               <X className="h-5 w-5" />
             </button>
             {uploadError && (
               <div className="mb-4 rounded-lg p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                 {uploadError}
               </div>
             )}
             <BookUploader onDocumentLoaded={handleDocumentLoaded} />
           </div>
         </div>
       )}
       <ShareDialog isOpen={!!shareBook} bookId={shareBook?.id} bookTitle={shareBook?.title} onClose={() => setShareBook(null)} />
      <DeleteConfirmDialog
        isOpen={!!confirmDeleteBook}
        onClose={handleCancelDelete}
        bookTitle={confirmDeleteBook?.title || ''}
        onConfirm={handleConfirmDelete}
        deleting={!!deletingBookId}
      />
    </AppLayout>
  );
}
