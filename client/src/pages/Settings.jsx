import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from '../context/NavigateContext.jsx';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { SettingsNav } from '../components/settings/SettingsNav.jsx';
import { AccountTab } from '../components/settings/AccountTab.jsx';
import { PreferencesTab } from '../components/settings/PreferencesTab.jsx';
import { PlaybackTab } from '../components/settings/PlaybackTab.jsx';
import { CreditsTab } from '../components/settings/CreditsTab.jsx';
import { NotificationsTab } from '../components/settings/NotificationsTab.jsx';
import { AccountOverviewCard } from '../components/settings/AccountOverviewCard.jsx';
import { ConnectedDevicesCard } from '../components/settings/ConnectedDevicesCard.jsx';
import { DangerZoneCard } from '../components/settings/DangerZoneCard.jsx';

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('account');

  return (
    <AppLayout activePath="/settings" onNavClick={navigate}>
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-semibold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your account, preferences, and audio settings.</p>
        </div>

        <div className="flex gap-6">
          <SettingsNav activeTab={activeTab} onTabChange={setActiveTab} />
          
          <div className="flex-1 min-w-0">
            {activeTab === 'account' && <AccountTab />}
            {activeTab === 'preferences' && <PreferencesTab />}
            {activeTab === 'playback' && <PlaybackTab />}
            {activeTab === 'credits' && <CreditsTab />}
            {activeTab === 'notifications' && <NotificationsTab />}
          </div>

          <div className="w-72 shrink-0 space-y-4">
            <AccountOverviewCard />
            <ConnectedDevicesCard />
            <DangerZoneCard />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
