import React, { createContext, useContext, useState, useEffect } from 'react';
import esTranslations from '../locales/es.json';
import enTranslations from '../locales/en.json';

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
  | 'admin';

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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('home');
  const [activeCompetitionId, setActiveCompetitionId] = useState<string>('snb');
  const [activeSeasonId, setActiveSeasonId] = useState<string>('snb-2026');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedComparisonGameId, setSelectedComparisonGameId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedNewsSlug, setSelectedNewsSlug] = useState<string | null>(null);
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

  const navigateToNews = (slug: string) => {
    setSelectedNewsSlug(slug);
    setActiveTab('news');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
