/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { ScoreNotificationProvider } from './context/ScoreNotificationContext.tsx';
import { AdminAuthProvider } from './context/AdminAuthContext.tsx';
import { FirebaseAuthProvider } from './context/FirebaseAuthContext.tsx';
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
import { Helmet } from './components/Helmet.tsx';
import { ApiClient } from './services/api.ts';

const KNOWN_TEAMS: Record<string, { city: string; name: string }> = {
  mtz: { city: 'Matanzas', name: 'Cocodrilos de Matanzas' },
  ind: { city: 'Industriales', name: 'Leones de Industriales' },
  ltu: { city: 'Las Tunas', name: 'Leñadores de Las Tunas' },
  pri: { city: 'Pinar del Río', name: 'Vegueros de Pinar del Río' },
  gra: { city: 'Granma', name: 'Alazanes de Granma' },
  scu: { city: 'Santiago de Cuba', name: 'Avispas de Santiago de Cuba' },
  cav: { city: 'Ciego de Ávila', name: 'Tigres de Ciego de Ávila' },
  ssp: { city: 'Sancti Spíritus', name: 'Gallos de Sancti Spíritus' },
  vcl: { city: 'Villa Clara', name: 'Leopardos de Villa Clara' },
  cmg: { city: 'Camagüey', name: 'Toros de Camagüey' },
  hol: { city: 'Holguín', name: 'Cachorros de Holguín' },
  cfg: { city: 'Cienfuegos', name: 'Elefantes de Cienfuegos' },
  art: { city: 'Artemisa', name: 'Cazadores de Artemisa' },
  may: { city: 'Mayabeque', name: 'Huracanes de Mayabeque' },
  ijv: { city: 'Isla de la Juventud', name: 'Piratas de la Isla' },
  gtm: { city: 'Guantánamo', name: 'Indios de Guantánamo' },
};

const AppContent: React.FC = () => {
  const {
    activeTab,
    selectedNewsSlug,
    selectedTeamId,
    selectedPlayerId,
    selectedGameId,
    setActiveTab,
  } = useApp();

  const [activeEntityName, setActiveEntityName] = useState<{
    teamName?: string;
    playerName?: string;
    articleTitle?: string;
    articleSummary?: string;
  }>({});

  // Sync team details when selectedTeamId changes
  useEffect(() => {
    if (!selectedTeamId) {
      setActiveEntityName((prev) => ({ ...prev, teamName: undefined }));
      return;
    }
    const known = KNOWN_TEAMS[selectedTeamId.toLowerCase()];
    if (known) {
      setActiveEntityName((prev) => ({ ...prev, teamName: known.city }));
    }
    ApiClient.getTeamDetail(selectedTeamId)
      .then((data) => {
        if (data?.team) {
          setActiveEntityName((prev) => ({
            ...prev,
            teamName: data.team.city || data.team.nickname || data.team.name,
          }));
        }
      })
      .catch(() => {});
  }, [selectedTeamId]);

  // Sync player details when selectedPlayerId changes
  useEffect(() => {
    if (!selectedPlayerId) {
      setActiveEntityName((prev) => ({ ...prev, playerName: undefined }));
      return;
    }
    ApiClient.getPlayerDetail(selectedPlayerId)
      .then((data) => {
        if (data?.player) {
          setActiveEntityName((prev) => ({ ...prev, playerName: data.player.fullName }));
        }
      })
      .catch(() => {});
  }, [selectedPlayerId]);

  // Sync article details when in article view
  useEffect(() => {
    const targetSlug =
      selectedNewsSlug ||
      (activeTab === 'article' && typeof window !== 'undefined'
        ? window.location.pathname.replace(/^\/(?:noticias|articulo|news)\//i, '')
        : null);

    if (!targetSlug || activeTab !== 'article') {
      setActiveEntityName((prev) => ({
        ...prev,
        articleTitle: undefined,
        articleSummary: undefined,
      }));
      return;
    }

    ApiClient.getNewsArticle(targetSlug)
      .then((article) => {
        if (article) {
          setActiveEntityName((prev) => ({
            ...prev,
            articleTitle: article.title,
            articleSummary: article.excerpt,
          }));
        }
      })
      .catch(() => {});
  }, [selectedNewsSlug, activeTab]);

  // Compute dynamic SEO metadata based on currently active view and selection
  const getSeoMetadata = () => {
    // 1. Team page or modal selection (e.g. 'Baseball Hub - Matanzas')
    if (selectedTeamId) {
      const teamCity =
        activeEntityName.teamName ||
        KNOWN_TEAMS[selectedTeamId.toLowerCase()]?.city ||
        selectedTeamId;
      return {
        title: `Baseball Hub - ${teamCity}`,
        description: `Perfil oficial, roster de jugadores, calendario y estadísticas de ${teamCity} en la Serie Nacional de Béisbol.`,
        ogType: 'website' as const,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'SportsTeam',
          name: teamCity,
          sport: 'Baseball',
        },
      };
    }

    // 2. Player modal selection
    if (selectedPlayerId) {
      const pName = activeEntityName.playerName || 'Jugador';
      return {
        title: `Baseball Hub - ${pName}`,
        description: `Ficha deportiva, estadísticas avanzadas de bateo y pitcheo, métricas y trayectoria de ${pName} en la Serie Nacional.`,
        ogType: 'profile' as const,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: pName,
          jobTitle: 'Pelotero de Béisbol',
        },
      };
    }

    // 3. Game boxscore modal selection
    if (selectedGameId) {
      return {
        title: 'Baseball Hub - Marcador y Boxscore en Vivo',
        description: 'Detalles jugada por jugada, alineaciones, estadísticas individuales y anotaciones en tiempo real de la Serie Nacional.',
        ogType: 'sports_event' as const,
      };
    }

    // 4. Standalone article view
    if (activeTab === 'article') {
      const artTitle = activeEntityName.articleTitle || 'Crónica y Noticia de Béisbol';
      return {
        title: `Baseball Hub - ${artTitle}`,
        description:
          activeEntityName.articleSummary ||
          'Análisis exhaustivo, resumen de jugadas y actualidad del béisbol cubano.',
        ogType: 'article' as const,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          headline: artTitle,
          description: activeEntityName.articleSummary,
        },
      };
    }

    // 5. General active tab views
    switch (activeTab) {
      case 'teams':
        return {
          title: 'Baseball Hub - Equipos y Franquicias',
          description:
            'Directorio de equipos y franquicias de la Serie Nacional de Béisbol y Liga Élite. Consulta sus rosters, estadios y palmarés.',
          ogType: 'website' as const,
        };
      case 'games':
        return {
          title: 'Baseball Hub - Calendario y Resultados en Vivo',
          description:
            'Calendario oficial de partidos, marcadores en tiempo real, boxscores y resultados de la jornada de béisbol.',
          ogType: 'sports_event' as const,
        };
      case 'standings':
        return {
          title: 'Baseball Hub - Tabla de Posiciones y Clasificación',
          description:
            'Tabla de posiciones oficial de la Serie Nacional de Béisbol. Clasificación general y por divisiones rumbo a playoffs.',
          ogType: 'website' as const,
        };
      case 'statistics':
        return {
          title: 'Baseball Hub - Estadísticas Completas y Sabermetría',
          description:
            'Tablas estadísticas detalladas de bateo y pitcheo con filtros interactivos, métricas tradicionales y sabermetría avanzada.',
          ogType: 'website' as const,
        };
      case 'leaders':
        return {
          title: 'Baseball Hub - Líderes Individuales de Bateo y Pitcheo',
          description:
            'Líderes de la temporada en promedio (AVG), cuadrangulares (HR), impulsadas (CI), efectividad (PCL), ponches y salvados.',
          ogType: 'website' as const,
        };
      case 'players':
        return {
          title: 'Baseball Hub - Jugadores y Rosters',
          description:
            'Directorio completo de peloteros de la Serie Nacional de Béisbol, con fichas individuales y métricas de rendimiento.',
          ogType: 'website' as const,
        };
      case 'news':
        return {
          title: 'Baseball Hub - Noticias y Crónicas del Béisbol',
          description:
            'Últimas noticias, crónicas de partidos, análisis y reportajes sobre la Serie Nacional de Béisbol de Cuba.',
          ogType: 'website' as const,
        };
      case 'videos':
        return {
          title: 'Baseball Hub - Videos y Jugadas Destacadas',
          description:
            'Resúmenes en video, jugadas defensivas espectaculares y cuadrangulares de la Serie Nacional.',
          ogType: 'website' as const,
        };
      case 'admin':
        return {
          title: 'Baseball Hub - Panel de Administración',
          description: 'Gestión y administración del sistema de datos de béisbol.',
          ogType: 'website' as const,
        };
      case 'home':
      default:
        return {
          title: 'Baseball Hub — Plataforma Profesional de Béisbol',
          description:
            'Centro integral de estadísticas de béisbol de Cuba, marcadores en vivo de la Serie Nacional, líderes ofensivos y de pitcheo.',
          ogType: 'website' as const,
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Baseball Hub',
            applicationCategory: 'SportsApplication',
            operatingSystem: 'All',
            description:
              'Plataforma profesional de béisbol con resultados en vivo, estadísticas avanzadas, líderes y posiciones.',
          },
        };
    }
  };

  const seo = getSeoMetadata();

  // Standalone dedicated page for /admin - completely isolated from public MainLayout
  if (activeTab === 'admin') {
    return (
      <>
        <Helmet
          title={seo.title}
          description={seo.description}
          ogType={seo.ogType}
          jsonLd={seo.jsonLd}
        />
        <AdminStandalonePage />
      </>
    );
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

  return (
    <>
      <Helmet
        title={seo.title}
        description={seo.description}
        ogType={seo.ogType}
        jsonLd={seo.jsonLd}
      />
      <MainLayout>{renderActiveView()}</MainLayout>
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <ScoreNotificationProvider>
        <AdminAuthProvider>
          <FirebaseAuthProvider>
            <AppContent />
          </FirebaseAuthProvider>
        </AdminAuthProvider>
      </ScoreNotificationProvider>
    </AppProvider>
  );
}
