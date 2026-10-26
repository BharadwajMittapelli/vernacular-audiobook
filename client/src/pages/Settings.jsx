import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from '../context/NavigateContext.jsx';
import { BookOpen, Mic, Library, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { SettingsTopBar } from '../components/settings/SettingsTopBar.jsx';
import { SettingsNav } from '../components/settings/SettingsNav.jsx';
import { AccountTab } from '../components/settings/AccountTab.jsx';
import { PreferencesTab } from '../components/settings/PreferencesTab.jsx';
import { PlaybackTab } from '../components/settings/PlaybackTab.jsx';
import { CreditsTab } from '../components/settings/CreditsTab.jsx';
import { NotificationsTab } from '../components/settings/NotificationsTab.jsx';
import { AccountOverviewCard } from '../components/settings/AccountOverviewCard.jsx';
import { ConnectedDevicesCard } from '../components/settings/ConnectedDevicesCard.jsx';
import { DangerZoneCard } from '../components/settings/DangerZoneCard.jsx';

const NAV_ITEMS = [
  { label: 'Studio', icon: Mic, route: '/' },
  { label: 'My Books', icon: BookOpen, route: '/my-books' },
  { label: 'Audio Library', icon: Library, route: '#' },
  { label: 'Settings', icon: SettingsIcon, route: '/settings' },
];

export default function Settings() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [activePath] = useState(window.location.pathname);
  const [activeTab, setActiveTab] = useState('account');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const user = session?.user;
  const fullName = user?.user_metadata?.full_name || user?.email || 'User';
  const email = user?.email || '';
  const initials = fullName
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const avatarUrl = user?.user_metadata?.avatar_url;

  const handleNavClick = (route) => {
    if (route === '/settings') {
      navigate('/settings');
      return;
    }
    if (route === '/') {
      const remembered = sessionStorage.getItem('lastBookId');
      if (remembered) {
        navigate(`/?bookId=${remembered}`);
      } else {
        navigate('/my-books');
      }
      return;
    }
    navigate(route);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Global Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 flex flex-col
          bg-sidebar border-r border-border
          transition-transform duration-200 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-0
        `}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-14 border-b border-border shrink-0">
          <BookOpen className="h-6 w-6 text-terracotta" />
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight text-foreground">Ekithab AI</span>
            <span className="text-sm text-muted-foreground font-medium">Audiobook</span>
          </div>
          <button
            className="ml-auto lg:hidden p-1 rounded-md hover:bg-elevated"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isRoute = item.route && item.route !== '#';
            const isActive = isRoute && activePath === item.route;
            return (
              <button
                key={item.label}
                onClick={() => {
                  if (!isRoute) return;
                  handleNavClick(item.route);
                }}
                disabled={!isRoute}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                  transition-colors
                  ${isActive
                    ? 'bg-terracotta/10 text-terracotta font-medium'
                    : isRoute
                      ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      : 'text-muted-foreground opacity-50 cursor-not-allowed'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <div className="w-2 h-2 rounded-full bg-success shrink-0" />
            <span>Studio Online</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-muted-foreground/80">Ready to create</span>
          </div>
          {user ? (
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName} className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-terracotta/10 text-terracotta flex items-center justify-center text-xs font-semibold">
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              </div>
              <button
                onClick={async () => { await signOut(); window.location.href = '/'; }}
                className="shrink-0 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-success shrink-0" />
              <span>Studio Online</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <SettingsTopBar />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-8 py-8">
            {/* Page heading */}
            <div className="mb-8">
              <h1 className="text-3xl font-serif font-semibold text-foreground">Settings</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Manage your account, preferences, and audio settings.
              </p>
            </div>

            {/* Three-column layout */}
            <div className="flex gap-6">
              {/* Column 1: Settings navigation */}
              <SettingsNav activeTab={activeTab} onTabChange={setActiveTab} />

              {/* Column 2: Main content */}
              <div className="flex-1 min-w-0">
                {activeTab === 'account' && <AccountTab />}
                {activeTab === 'preferences' && <PreferencesTab />}
                {activeTab === 'playback' && <PlaybackTab />}
                {activeTab === 'credits' && <CreditsTab />}
                {activeTab === 'notifications' && <NotificationsTab />}
              </div>

              {/* Column 3: Right panel cards */}
              <div className="w-72 shrink-0 space-y-4">
                <AccountOverviewCard />
                <ConnectedDevicesCard />
                <DangerZoneCard />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
