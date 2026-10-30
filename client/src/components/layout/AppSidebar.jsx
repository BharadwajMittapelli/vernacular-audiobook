import React from 'react';
import { BookOpen, Mic, Library, Settings, LogOut, Coins, Clock, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getLastOpenedBook } from '../../services/api.js';

const NAV_ITEMS = [
  { label: 'Home', icon: Home, route: '/home' },
  { label: 'My Books', icon: BookOpen, route: '/my-books' },
  { label: 'Recent', icon: Clock, route: '/recent' },
  { label: 'Studio', icon: Mic, route: '/studio' },
  { label: 'Audio Library', icon: Library, route: '/audio-library' },
  { label: 'Settings', icon: Settings, route: '/settings' },
];

export function AppSidebar({ activePath, onNavClick, credits, children }) {
  const { session, signOut, loading } = useAuth();
  const user = session?.user;
  const fullName = user?.user_metadata?.full_name || user?.email || 'User';
  const email = user?.email || '';
  const initials = fullName.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  const avatarUrl = user?.user_metadata?.avatar_url;

  const handleLogout = async () => {
    try {
      await signOut();
      onNavClick('/');
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  const handleStudioClick = async () => {
    try {
      const lastBook = await getLastOpenedBook();
      if (lastBook?.id) {
        onNavClick(`/?bookId=${lastBook.id}`);
      } else {
        onNavClick('/my-books');
      }
    } catch (e) {
      console.error('Failed to get last opened book:', e);
      onNavClick('/my-books');
    }
  };

  return (
    <aside className="w-64 flex flex-col bg-sidebar border-r border-border h-screen sticky top-0 shrink-0">
      <div className="flex items-center gap-3 px-5 h-14 border-b border-border shrink-0">
        <BookOpen className="h-6 w-6 text-terracotta" />
        <span className="text-base font-bold text-foreground">Ekithab AI</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={item.label === 'Studio' ? handleStudioClick : () => onNavClick(item.route)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activePath === item.route ? 'bg-terracotta/10 text-terracotta' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Contextual slot for Studio */}
      {children && <div className="border-t border-border">{children}</div>}

      <div className="p-4 border-t border-border space-y-4">
        <div className="flex items-center gap-3 px-1">
          <Coins className="h-5 w-5 text-terracotta" />
          <div>
            <p className="text-xs font-bold text-foreground uppercase">Credits</p>
            <p className="text-sm font-medium">{credits ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {avatarUrl ? <img src={avatarUrl} className="h-8 w-8 rounded-full" /> : <div className="h-8 w-8 rounded-full bg-terracotta text-white flex items-center justify-center text-xs">{initials}</div>}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{fullName}</p>
          </div>
          <button onClick={handleLogout} disabled={loading}><LogOut className="h-4 w-4 text-muted-foreground" /></button>
        </div>
      </div>
    </aside>
  );
}
