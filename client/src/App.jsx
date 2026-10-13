import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';

function App() {
  const { session, loading } = useAuth();
  const [path, setPath] = useState(window.location.pathname);
  // ref, not state — avoids render-phase state update
  const redirectingRef = useRef(false);

  const navigate = (newPath) => {
    window.history.pushState({}, '', newPath);
    setPath(newPath);
  };

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Redirect AFTER render completes — never during render.
  useEffect(() => {
    if (loading) return;
    const currentPath = window.location.pathname;
    if (!session && currentPath !== '/login' && currentPath !== '/register' && !redirectingRef.current) {
      redirectingRef.current = true;
      navigate('/login');
    } else if (session && (currentPath === '/login' || currentPath === '/register') && !redirectingRef.current) {
      redirectingRef.current = true;
      navigate('/');
    } else {
      redirectingRef.current = false;
    }
  }, [session, loading]);

  // Reset the redirect guard when the user manually navigates to auth pages,
  // so future redirects (e.g., after logout) can still fire.
  useEffect(() => {
    if (path === '/login' || path === '/register') {
      redirectingRef.current = false;
    }
  }, [path]);

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
    default:
      return <Dashboard />;
  }
}

export default App;
