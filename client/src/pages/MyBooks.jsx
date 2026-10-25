import React, { useEffect, useState, useCallback } from 'react';
import { BookOpen, Grid, List, Search, X, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from '../context/NavigateContext.jsx';
import { getBooks, deleteBook, createBook } from '../services/api.js';
import { BookUploader } from '../components/studio/BookUploader.jsx';
import { MyBooksSidebar } from '../components/books/MyBooksSidebar.jsx';
import { MyBooksTopBar } from '../components/books/MyBooksTopBar.jsx';
import { ActionCard } from '../components/books/ActionCard.jsx';
import { BookCard } from '../components/books/BookCard.jsx';
import { RecentlyOpenedCard } from '../components/books/RecentlyOpenedCard.jsx';
import { BookEmptyState } from '../components/books/BookEmptyState.jsx';
import { FeatureCards } from '../components/books/FeatureCards.jsx';

const TABS = ['bookshelf', 'recent', 'shared', 'favorites'];

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

export default function MyBooks() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('bookshelf');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [showUploader, setShowUploader] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);

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

  const handleDelete = async (bookId) => {
    try {
      await deleteBook(bookId);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
    } catch (err) {
      console.error('Failed to delete book:', err);
    }
  };

  const handleUpload = useCallback(() => {
    setShowUploader(true);
    setUploadResult(null);
  }, []);

  const handleCloseUploader = useCallback(() => {
    setShowUploader(false);
    setUploadResult(null);
    setUploadError(null);
  }, []);

  const handleDocumentLoaded = useCallback(
    async ({ title, chapters }) => {
      setUploadError(null);
      try {
        const res = await createBook({ title, chapters });
        if (!res || !res.success) {
          throw new Error(res?.error || 'Failed to create book');
        }
        setShowUploader(false);
        setUploadResult(null);
        setBooks((prev) => [res.book, ...prev]);
        navigate(`/?bookId=${res.book.id}`);
      } catch (err) {
        // In development, show the actual error for debugging
        const devDebug = err.response?.data?.debug;
        const errorMsg = devDebug?.message || err.response?.data?.error || err.message || 'Failed to create book';
        setUploadError(errorMsg);
        if (devDebug) console.error('[MyBooks] Upload error details:', devDebug);
      }
    },
    [navigate]
  );

  const filteredBooks = books.filter((book) =>
    book.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const recentBooks = activeTab === 'recent' ? filteredBooks : [];
  const sharedBooks = activeTab === 'shared' ? [] : filteredBooks;
  const favoritesBooks = activeTab === 'favorites' ? [] : filteredBooks;

  const displayBooks =
    activeTab === 'bookshelf' ? filteredBooks :
    activeTab === 'recent' ? recentBooks :
    activeTab === 'shared' ? sharedBooks :
    favoritesBooks;

  const tabsWithCounts = [
    { key: 'bookshelf', label: 'Bookshelf' },
    { key: 'recent', label: 'Recent', count: books.length },
    { key: 'shared', label: 'Shared', badge: 'Coming soon' },
    { key: 'favorites', label: 'Favorites', badge: 'Coming soon' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <MyBooksSidebar activeItem="my-books" onNavClick={navigate} activePath={window.location.pathname} />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <MyBooksTopBar onUploadBook={handleUpload} onLogout={() => signOut()} />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Page heading */}
            <div className="mb-8">
              <h1 className="text-3xl font-semibold text-foreground">My Books</h1>
              <p className="text-muted-foreground mt-1">
                Manage your uploaded books and continue listening.
              </p>
            </div>

            {/* Action cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <ActionCard
                icon={<BookOpen className="h-6 w-6" />}
                title="Create an Audiobook"
                description="Upload a document and generate natural-sounding audio in your language."
                onClick={handleUpload}
              />
              <ActionCard
                icon={<Upload className="h-6 w-6" />}
                title="Publish to Ekithab Reader"
                description="Share your audiobook with listeners and make it accessible everywhere."
                disabled
              />
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-6 border-b border-border mb-6">
              {tabsWithCounts.map(({ key, label, count, badge }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === key
                      ? 'border-terracotta text-terracotta'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{label}</span>
                  {count !== undefined && (
                    <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                      {count}
                    </span>
                  )}
                  {badge && (
                    <span className="text-[10px] bg-terracotta/10 text-terracotta px-1.5 py-0.5 rounded-full">
                      {badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search and filters row */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
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
              <select className="px-3 py-2 rounded-lg border border-border bg-background text-sm text-muted-foreground cursor-not-allowed opacity-60" disabled>
                <option>All books</option>
              </select>
              <select className="px-3 py-2 rounded-lg border border-border bg-background text-sm text-muted-foreground cursor-not-allowed opacity-60" disabled>
                <option>All languages</option>
              </select>
              <select className="px-3 py-2 rounded-lg border border-border bg-background text-sm text-muted-foreground cursor-not-allowed opacity-60" disabled>
                <option>Last updated</option>
              </select>
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-terracotta/10 text-terracotta'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                  aria-label="Grid view"
                  title="Grid view"
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 transition-colors border-l border-border ${
                    viewMode === 'list'
                      ? 'bg-terracotta/10 text-terracotta'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                  aria-label="List view"
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-4 rounded-lg p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Content area */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading books…</span>
                </div>
              </div>
            ) : displayBooks.length === 0 && activeTab !== 'shared' && activeTab !== 'favorites' ? (
              <BookEmptyState onUpload={handleUpload} />
            ) : activeTab === 'shared' || activeTab === 'favorites' ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {activeTab === 'shared' ? 'Shared books' : 'Favorite books'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This feature is coming soon.
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
                {displayBooks.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onOpen={() => navigate(`/?bookId=${book.id}`)}
                    onDelete={() => handleDelete(book.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3 mb-8">
                {displayBooks.map((book) => (
                  <div
                    key={book.id}
                    className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="w-12 h-16 shrink-0 rounded-lg overflow-hidden bg-terracotta/10 flex items-center justify-center text-terracotta font-bold text-sm">
                      {book.cover_url ? (
                        <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                      ) : (
                        (book.title || '').slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">{book.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {book.total_chapters} chapter{book.total_chapters !== 1 ? 's' : ''}
                        {book.status && ` · ${book.status}`}
                      </p>
                    </div>
                    <button
                      onClick={() => console.log('[MyBooks] Open book:', book.id)}
                      className="shrink-0 bg-foreground text-background text-xs font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => handleDelete(book.id)}
                      className="shrink-0 p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Delete book"
                      title="Delete book"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Feature cards — always visible */}
            <FeatureCards />

            {/* Recently opened — only when books exist and on bookshelf/recent tabs */}
            {(activeTab === 'bookshelf' || activeTab === 'recent') && books.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">Recently opened</h2>
                  <button className="text-sm text-terracotta font-medium hover:underline">
                    View all →
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {books.slice(0, 4).map((book) => (
                    <RecentlyOpenedCard
                      key={book.id}
                      book={{
                        ...book,
                        lastOpened: book.created_at,
                      }}
                      onOpen={() => navigate(`/?bookId=${book.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Upload modal */}
      {showUploader && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleCloseUploader}
        >
          <div
            className="bg-background rounded-xl p-8 max-w-xl w-full mx-4 relative shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseUploader}
              className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
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
    </div>
  );
}
