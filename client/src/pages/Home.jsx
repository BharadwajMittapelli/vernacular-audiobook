import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from '../context/NavigateContext.jsx';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { Hero } from '../components/home/Hero.jsx';
import { FeatureCards } from '../components/home/FeatureCards.jsx';
import { ContinueListening } from '../components/home/ContinueListening.jsx';
import { QuickActions } from '../components/home/QuickActions.jsx';
import { getAllLibraryAudio, getBooks } from '../services/api.js';

export default function Home() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const user = session?.user;
  const fullName = user?.user_metadata?.full_name || user?.email || 'User';

  const [recentAudio, setRecentAudio] = useState([]);
  const [books, setBooks] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [audio, booksRes] = await Promise.all([
          getAllLibraryAudio().catch(() => ({ items: [] })),
          getBooks().catch(() => ({ books: [] })),
        ]);
        setRecentAudio(audio?.items ?? []);
        setBooks(booksRes?.books ?? []);
      } catch (err) {
        console.error('Home page data fetch error:', err);
        setError('Failed to load page data');
      }
    };

    fetchData();
  }, []);

  return (
    <AppLayout activePath="/home" onNavClick={navigate}>
      {error && (
        <div className="mx-6 mt-4 rounded-lg p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      <Hero userName={fullName} onUpload={() => navigate('/my-books')} />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <FeatureCards />
        <ContinueListening onViewAll={() => navigate('/my-books')} />
        <QuickActions onAction={(route) => navigate(route)} />
      </div>
    </AppLayout>
  );
}
