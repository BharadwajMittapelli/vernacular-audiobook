import React, { useState } from 'react';
import { AppSidebar } from './AppSidebar.jsx';
import { AppTopBar } from './AppTopBar.jsx';
import { getSettingsStats } from '../../services/api.js';

const COLLAPSE_KEY = 'ekithab-sidebar-collapsed';

export function AppLayout({ children, activePath, onNavClick, contextualSidebar }) {
  const [credits, setCredits] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');

  React.useEffect(() => {
    getSettingsStats().then(s => setCredits(s.credits)).catch(() => {});
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSE_KEY, prev ? '0' : '1');
      return !prev;
    });
  };

  return (
    <div className="flex h-screen bg-background">
      <div className={`${mobileOpen ? 'fixed inset-0 z-50' : 'hidden'} lg:block`}>
        <AppSidebar activePath={activePath} onNavClick={onNavClick} credits={credits} collapsed={collapsed} onToggleCollapse={toggleCollapsed}>
          {collapsed ? null : contextualSidebar}
        </AppSidebar>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppTopBar onMenuClick={() => setMobileOpen(!mobileOpen)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
