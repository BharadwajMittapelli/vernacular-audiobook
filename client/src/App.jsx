import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { NavigateContext } from './context/NavigateContext.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MyBooks from './pages/MyBooks.jsx';
import PublicListener from './pages/PublicListener.jsx';
import Settings from './pages/Settings.jsx';
import UpdatePassword from './pages/UpdatePassword.jsx';
import AudioLibrary from './pages/AudioLibrary.jsx';
import LandingPage from './pages/LandingPage.jsx';

function App() {
  const { session, loading } = useAuth();
  const [path, setPath] = useState(window.location.pathname + window.location.search);

  const navigate = useCallback((newPath) => {
    window.history.pushState({}, '', newPath);
    setPath(newPath);
  }, []);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Redirect after auth state resolves:
  // - Authenticated user on /auth → /my-books
  // - Unauthenticated user on any non-auth page (excluding / landing) → /auth
  useEffect(() => {
    if (loading) return;
    if (path.startsWith('/listen/')) return; // public share links bypass auth
    const params = new URLSearchParams(window.location.search);
    const hasBookId = params.get('bookId') !== null;

    if (session && !hasBookId && path === '/auth') {
      navigate('/my-books');
    } else if (!session && path !== '/auth' && path !== '/') {
      navigate('/auth');
    }
  }, [session, loading, path, navigate]);

  // ponytail: handles OAuth callback landing on / — Supabase redirects to root by default
  useEffect(() => {
    if (loading || !session) return;
    if (path.startsWith('/listen/')) return;
    if (path === '/my-books') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('bookId')) return;
    if (path !== '/') return;
    navigate('/my-books');
  }, [session, loading, path, navigate]);

  // Public listener route: render before the auth spinner so logged-out
  // visitors with a share link reach the reader directly.
  if (path.startsWith('/listen/')) {
    const bookId = path.slice('/listen/'.length).split('/')[0];
    return (
      <NavigateContext.Provider value={navigate}>
        <PublicListener bookId={bookId} />
      </NavigateContext.Provider>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading…</span>
        </div>
      </div>
    );
  }

  switch (path) {
    case '/auth':
      return (
        <NavigateContext.Provider value={navigate}>
          <AuthPage />
        </NavigateContext.Provider>
      );
    case '/my-books':
      return (
        <NavigateContext.Provider value={navigate}>
          <MyBooks />
        </NavigateContext.Provider>
      );
    case '/update-password':
      return (
        <NavigateContext.Provider value={navigate}>
          <UpdatePassword />
        </NavigateContext.Provider>
      );
    case '/settings':
      return (
        <NavigateContext.Provider value={navigate}>
          <Settings />
        </NavigateContext.Provider>
      );
    case '/audio-library':
      return (
        <NavigateContext.Provider value={navigate}>
          <AudioLibrary />
        </NavigateContext.Provider>
      );
    case '/':
      return (
        <NavigateContext.Provider value={navigate}>
          <LandingPage />
        </NavigateContext.Provider>
      );
    default:
      return (
        <NavigateContext.Provider value={navigate}>
          <Dashboard />
        </NavigateContext.Provider>
      );
  }
}

export default App;
