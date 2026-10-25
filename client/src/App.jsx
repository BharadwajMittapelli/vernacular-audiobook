import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { NavigateContext } from './context/NavigateContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MyBooks from './pages/MyBooks.jsx';

function App() {
  const { session, loading } = useAuth();
  const [path, setPath] = useState(window.location.pathname);

  const navigate = useCallback((newPath) => {
    window.history.pushState({}, '', newPath);
    setPath(newPath);
  }, []);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Redirect after auth state resolves:
  // - Authenticated user on / without bookId → /my-books
  // - Authenticated user on /login or /register → /my-books
  // - Unauthenticated user on any non-auth page → /login
  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    const hasBookId = params.get('bookId') !== null;

    if (session && !hasBookId && (path === '/' || path === '/login' || path === '/register')) {
      navigate('/my-books');
    } else if (!session && path !== '/login' && path !== '/register') {
      navigate('/login');
    }
  }, [session, loading, path, navigate]);

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
    case '/login':
      return <Login />;
    case '/register':
      return <Register />;
    case '/my-books':
      return (
        <NavigateContext.Provider value={navigate}>
          <MyBooks />
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
