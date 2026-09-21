/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { ScoreNotificationProvider } from './context/ScoreNotificationContext.tsx';
import { AdminAuthProvider } from './context/AdminAuthContext.tsx';
import { MainLayout } from './layouts/MainLayout.tsx';
import { HomeView } from './views/HomeView.tsx';
import { GamesView } from './views/GamesView.tsx';
import { StandingsView } from './views/StandingsView.tsx';
import { StatisticsView } from './views/StatisticsView.tsx';
import { LeadersView } from './views/LeadersView.tsx';
import { TeamsView } from './views/TeamsView.tsx';
import { PlayersView } from './views/PlayersView.tsx';
import { NewsView } from './views/NewsView.tsx';
import { VideosView } from './views/VideosView.tsx';
import { ArticlePostView } from './views/ArticlePostView.tsx';
import { AdminStandalonePage } from './views/AdminStandalonePage.tsx';

const AppContent: React.FC = () => {
  const { activeTab, selectedNewsSlug, setActiveTab } = useApp();

  // Standalone dedicated page for /admin - completely isolated from public MainLayout
  if (activeTab === 'admin') {
    return <AdminStandalonePage />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'home':
        return <HomeView />;
      case 'games':
        return <GamesView />;
      case 'standings':
        return <StandingsView />;
      case 'statistics':
        return <StatisticsView />;
      case 'leaders':
        return <LeadersView />;
      case 'teams':
        return <TeamsView />;
      case 'players':
        return <PlayersView />;
      case 'news':
        return <NewsView />;
      case 'article':
        return (
          <ArticlePostView
            slug={selectedNewsSlug || ''}
            onBack={() => setActiveTab('news')}
          />
        );
      case 'videos':
        return <VideosView />;
      default:
        return <HomeView />;
    }
  };

  return <MainLayout>{renderActiveView()}</MainLayout>;
};

export default function App() {
  return (
    <AppProvider>
      <ScoreNotificationProvider>
        <AdminAuthProvider>
          <AppContent />
        </AdminAuthProvider>
      </ScoreNotificationProvider>
    </AppProvider>
  );
}
