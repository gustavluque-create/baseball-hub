import React, { createContext, useContext, useState, useEffect } from 'react';
import esTranslations from '../locales/es.json';
import enTranslations from '../locales/en.json';
import { isPotentialArticleSlug } from '../utils/slug.ts';

export type ActiveNavTab =
  | 'home'
  | 'games'
  | 'standings'
  | 'statistics'
  | 'leaders'
  | 'teams'
  | 'players'
  | 'news'
  | 'videos'
  | 'admin'
  | 'article';

export type ThemeMode = 'dark' | 'light' | 'system';
export type TableDensity = 'comfortable' | 'compact';

interface AppContextType {
  activeTab: ActiveNavTab;
  setActiveTab: (tab: ActiveNavTab) => void;
  activeCompetitionId: string;
  setActiveCompetitionId: (id: string) => void;
  activeSeasonId: string;
  setActiveSeasonId: (id: string) => void;
  selectedGameId: string | null;
  setSelectedGameId: (id: string | null) => void;
  selectedComparisonGameId: string | null;
  setSelectedComparisonGameId: (id: string | null) => void;
  openGameComparison: (id: string) => void;
  selectedTeamId: string | null;
  setSelectedTeamId: (id: string | null) => void;
  selectedPlayerId: string | null;
  setSelectedPlayerId: (id: string | null) => void;
  selectedNewsSlug: string | null;
  setSelectedNewsSlug: (slug: string | null) => void;
  language: 'es' | 'en';
  setLanguage: (lang: 'es' | 'en') => void;
  theme: 'dark' | 'light';
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  density: TableDensity;
  setDensity: (density: TableDensity) => void;
  favoriteTeamIds: string[];
  toggleFavoriteTeam: (teamId: string) => void;
  isFavoriteTeam: (teamId: string) => boolean;
  setFavoriteTeams: (teamIds: string[]) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  t: (path: string) => string;
  navigateToGame: (id: string) => void;
  navigateToTeam: (id: string) => void;
  navigateToPlayer: (id: string) => void;
  navigateToNews: (slug: string) => void;
  dataVersion: number;
  triggerDataRefresh: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const getInitialRoute = (): { tab: ActiveNavTab; slug: string | null } => {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    const hash = window.location.hash;

    // 1. Admin route
    if (
      path === '/admin' ||
      path.startsWith('/admin/') ||
      hash === '#/admin' ||
      hash === '#admin'
    ) {
      return { tab: 'admin', slug: null };
    }

    // 2. Explicit article prefix: /noticias/:slug, /articulo/:slug, /news/:slug
    const matchArticlePrefix = path.match(/^\/(?:noticias|articulo|news)\/([^/]+)/i);
    if (matchArticlePrefix && matchArticlePrefix[1]) {
      return { tab: 'article', slug: decodeURIComponent(matchArticlePrefix[1]) };
    }

    // 3. Hash article: #/articulo/:slug or #/:slug
    const hashArticleMatch = hash.match(/^#\/?(?:noticias|articulo|news)?\/?([^/]+)/i);
    if (hashArticleMatch && hashArticleMatch[1] && isPotentialArticleSlug(hashArticleMatch[1])) {
      return { tab: 'article', slug: decodeURIComponent(hashArticleMatch[1]) };
    }

    // 4. Clean root path: /cocodrilos-matanzas-liderato-ofensiva-implacable
    const singleSegment = path.replace(/^\/+|\/+$/g, '');
    if (singleSegment && isPotentialArticleSlug(singleSegment)) {
      return { tab: 'article', slug: decodeURIComponent(singleSegment) };
    }

    // 5. Standard tab routes
    const cleanHash = hash.replace(/^#\/?/, '').toLowerCase();
    const cleanPath = singleSegment.toLowerCase();
    const target = cleanHash || cleanPath;

    if (target === 'noticias') return { tab: 'news', slug: null };
    if (target === 'partidos') return { tab: 'games', slug: null };
    if (target === 'posiciones') return { tab: 'standings', slug: null };
    if (target === 'estadisticas') return { tab: 'statistics', slug: null };
    if (target === 'lideres') return { tab: 'leaders', slug: null };
    if (target === 'equipos') return { tab: 'teams', slug: null };
    if (target === 'jugadores') return { tab: 'players', slug: null };

    if (
      [
        'games',
        'standings',
        'statistics',
        'leaders',
        'teams',
        'players',
        'news',
        'videos',
      ].includes(target)
    ) {
      return { tab: target as ActiveNavTab, slug: null };
    }
  }
  return { tab: 'home', slug: null };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialRoute = getInitialRoute();
  const [activeTab, setActiveTabState] = useState<ActiveNavTab>(initialRoute.tab);
  const [selectedNewsSlug, setSelectedNewsSlug] = useState<string | null>(initialRoute.slug);

  const setActiveTab = (tab: ActiveNavTab) => {
    setActiveTabState(tab);
    if (tab !== 'article') {
      setSelectedNewsSlug(null);
    }
    if (typeof window !== 'undefined') {
      try {
        if (tab === 'admin') {
          if (window.location.pathname !== '/admin') {
            window.history.pushState(null, '', '/admin');
          }
        } else if (tab === 'home') {
          if (window.location.pathname !== '/') {
            window.history.pushState(null, '', '/');
          }
        } else if (tab === 'news') {
          if (window.location.pathname !== '/noticias') {
            window.history.pushState(null, '', '/noticias');
          }
        } else if (tab === 'article') {
          // Handled via navigateToNews
        } else {
          if (window.location.pathname !== `/${tab}`) {
            window.history.pushState(null, '', `/${tab}`);
          }
        }
      } catch (e) {
        console.warn('History pushState error:', e);
      }
    }
  };

  // Synchronize browser history and hash navigation
  useEffect(() => {
    const handleUrlNavigation = () => {
      if (typeof window === 'undefined') return;
      const route = getInitialRoute();
      setActiveTabState(route.tab);
      setSelectedNewsSlug(route.slug);
    };

    window.addEventListener('popstate', handleUrlNavigation);
    window.addEventListener('hashchange', handleUrlNavigation);
    return () => {
      window.removeEventListener('popstate', handleUrlNavigation);
      window.removeEventListener('hashchange', handleUrlNavigation);
    };
  }, []);
  const [activeCompetitionId, setActiveCompetitionId] = useState<string>('snb');
  const [activeSeasonId, setActiveSeasonId] = useState<string>('snb-65');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedComparisonGameId, setSelectedComparisonGameId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [language, setLanguage] = useState<'es' | 'en'>('es');

  // Initialize theme mode from localStorage
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('baseball_hub_theme_mode') as ThemeMode | null;
      if (saved && ['dark', 'light', 'system'].includes(saved)) {
        return saved;
      }
    }
    return 'dark';
  });

  const [density, setDensityState] = useState<TableDensity>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('baseball_hub_density') as TableDensity | null;
      if (saved && ['comfortable', 'compact'].includes(saved)) {
        return saved;
      }
    }
    return 'comfortable';
  });

  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Favorite Teams state with localStorage persistence
  const [favoriteTeamIds, setFavoriteTeamIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('baseball_hub_favorite_teams');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (err) {
        console.warn('Error reading favorite teams from localStorage', err);
      }
    }
    // Default initial favorites for immediate discovery
    return ['ind', 'ltu'];
  });

  const toggleFavoriteTeam = (teamId: string) => {
    setFavoriteTeamIds((prev) => {
      const next = prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('baseball_hub_favorite_teams', JSON.stringify(next));
        } catch (e) {
          console.warn('Error saving favorites', e);
        }
      }
      return next;
    });
  };

  const isFavoriteTeam = (teamId: string) => favoriteTeamIds.includes(teamId);

  const setFavoriteTeams = (teamIds: string[]) => {
    setFavoriteTeamIds(teamIds);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('baseball_hub_favorite_teams', JSON.stringify(teamIds));
      } catch (e) {
        console.warn('Error saving favorites', e);
      }
    }
  };

  // Compute resolved theme from themeMode
  useEffect(() => {
    const getSystemTheme = (): 'dark' | 'light' => {
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    };

    const resolved = themeMode === 'system' ? getSystemTheme() : themeMode;
    setThemeState(resolved);

    // Apply classes to root <html> tag for global Tailwind CSS theme resolution
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    root.setAttribute('data-theme', resolved);
    root.style.colorScheme = resolved;

    // Listen for OS changes if in 'system' mode
    if (themeMode === 'system' && typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? 'dark' : 'light';
        setThemeState(newTheme);
        if (newTheme === 'dark') {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.remove('dark');
          root.classList.add('light');
        }
        root.setAttribute('data-theme', newTheme);
        root.style.colorScheme = newTheme;
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('baseball_hub_theme_mode', mode);
    }
  };

  const setTheme = (newTheme: 'dark' | 'light') => {
    setThemeMode(newTheme);
  };

  const toggleTheme = () => {
    setThemeMode(theme === 'dark' ? 'light' : 'dark');
  };

  const setDensity = (newDensity: TableDensity) => {
    setDensityState(newDensity);
    if (typeof window !== 'undefined') {
      localStorage.setItem('baseball_hub_density', newDensity);
    }
  };

  // Keyboard shortcut '/' or 'Cmd+K' for global search, and 'Cmd+,' for settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !isInput)) {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if ((e.key === ',' && (e.metaKey || e.ctrlKey)) || (e.key === 's' && !isInput && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setIsSettingsOpen(true);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const t = (path: string): string => {
    const dict = language === 'es' ? esTranslations : enTranslations;
    const parts = path.split('.');
    let current: any = dict;
    for (const p of parts) {
      if (current && typeof current === 'object' && p in current) {
        current = current[p];
      } else {
        return path;
      }
    }
    return typeof current === 'string' ? current : path;
  };

  const navigateToGame = (id: string) => {
    setSelectedGameId(id);
    setActiveTab('games');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openGameComparison = (id: string) => {
    setSelectedComparisonGameId(id);
  };

  const navigateToTeam = (id: string) => {
    setSelectedTeamId(id);
    setActiveTab('teams');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToPlayer = (id: string) => {
    setSelectedPlayerId(id);
    setActiveTab('players');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [dataVersion, setDataVersion] = useState<number>(1);
  const triggerDataRefresh = () => {
    setDataVersion((v) => {
      const nextVersion = v + 1;
      console.log(
        `%c[STATE HOOK: useApp]%c triggerDataRefresh() dispatched -> dataVersion: ${v} -> ${nextVersion}. Re-evaluating queries.`,
        'color: #0284c7; font-weight: bold;',
        'color: inherit;'
      );
      return nextVersion;
    });
  };

  const navigateToNews = (slug: string) => {
    const cleanSlug = (slug || '').trim();
    setSelectedNewsSlug(cleanSlug);
    setActiveTabState('article');
    if (typeof window !== 'undefined') {
      try {
        if (window.location.pathname !== `/${cleanSlug}`) {
          window.history.pushState(null, '', `/${cleanSlug}`);
        }
      } catch (e) {
        console.warn('History pushState error:', e);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        activeCompetitionId,
        setActiveCompetitionId,
        activeSeasonId,
        setActiveSeasonId,
        selectedGameId,
        setSelectedGameId,
        selectedComparisonGameId,
        setSelectedComparisonGameId,
        openGameComparison,
        selectedTeamId,
        setSelectedTeamId,
        selectedPlayerId,
        setSelectedPlayerId,
        selectedNewsSlug,
        setSelectedNewsSlug,
        language,
        setLanguage,
        theme,
        themeMode,
        setThemeMode,
        setTheme,
        toggleTheme,
        density,
        setDensity,
        favoriteTeamIds,
        toggleFavoriteTeam,
        isFavoriteTeam,
        setFavoriteTeams,
        isSearchOpen,
        setIsSearchOpen,
        isSettingsOpen,
        setIsSettingsOpen,
        t,
        navigateToGame,
        navigateToTeam,
        navigateToPlayer,
        navigateToNews,
        dataVersion,
        triggerDataRefresh,
      }}
    >
      <div className={theme === 'dark' ? 'dark' : 'light'}>{children}</div>
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
