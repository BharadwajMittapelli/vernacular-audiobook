import React from 'react';
import { BookOpen, Mic, Library, Settings, LogOut, Coins, Clock, Home, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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

export function AppSidebar({ activePath, onNavClick, credits, children, collapsed, onToggleCollapse }) {
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
    <aside className={`${collapsed ? 'w-16' : 'w-64'} flex flex-col bg-sidebar border-r border-border h-screen sticky top-0 shrink-0 transition-[width]`}>
      <div className={`flex items-center justify-between px-5 h-14 border-b border-border shrink-0`}>
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-terracotta shrink-0" />
          {!collapsed && <span className="text-base font-bold text-foreground">Ekithab AI</span>}
        </div>
        {!collapsed && (
          <button
            title="Collapse sidebar"
            onClick={onToggleCollapse}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
        {collapsed && (
          <button
            title="Expand sidebar"
            onClick={onToggleCollapse}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            title={item.label}
            onClick={item.label === 'Studio' ? handleStudioClick : () => onNavClick(item.route)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${collapsed ? 'justify-center px-0' : ''} ${activePath === item.route ? 'bg-terracotta/10 text-terracotta' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && item.label}
          </button>
        ))}
      </nav>

      {/* Contextual slot for Studio */}
      {children && <div className="border-t border-border">{children}</div>}

      <div className={`${collapsed ? 'px-2' : 'p-4'} border-t border-border space-y-4`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'px-1'}`} title={`Credits: ${credits ?? '—'}`}>
          <Coins className="h-5 w-5 text-terracotta shrink-0" />
          {!collapsed && (
            <div>
              <p className="text-xs font-bold text-foreground uppercase">Credits</p>
              <p className="text-sm font-medium">{credits ?? '—'}</p>
            </div>
          )}
        </div>
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          {avatarUrl ? <img src={avatarUrl} className="h-8 w-8 rounded-full shrink-0" /> : <div className="h-8 w-8 rounded-full bg-terracotta text-white flex items-center justify-center text-xs shrink-0">{initials}</div>}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{fullName}</p>
            </div>
          )}
          {!collapsed && <button onClick={handleLogout} disabled={loading}><LogOut className="h-4 w-4 text-muted-foreground" /></button>}
        </div>
        {collapsed && (
          <button onClick={handleLogout} disabled={loading} title="Log out" className="w-full flex justify-center py-1 rounded-lg hover:bg-muted transition-colors">
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </aside>
  );
}
