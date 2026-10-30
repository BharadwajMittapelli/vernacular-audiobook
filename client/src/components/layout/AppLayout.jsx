import React, { useState } from 'react';
import { AppSidebar } from './AppSidebar.jsx';
import { AppTopBar } from './AppTopBar.jsx';
import { GlobalPlayer } from './GlobalPlayer.jsx';
import { getSettingsStats } from '../../services/api.js';

export function AppLayout({ children, activePath, onNavClick, contextualSidebar }) {
  const [credits, setCredits] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  React.useEffect(() => {
    getSettingsStats().then(s => setCredits(s.credits)).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <div className={`${mobileOpen ? 'fixed inset-0 z-50' : 'hidden'} lg:block`}>
        <AppSidebar activePath={activePath} onNavClick={onNavClick} credits={credits}>
          {contextualSidebar}
        </AppSidebar>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppTopBar onMenuClick={() => setMobileOpen(!mobileOpen)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
        <GlobalPlayer />
      </div>
    </div>
  );
}
