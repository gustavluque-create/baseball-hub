import React, { useState, useEffect } from 'react';
import {
  Search,
  Moon,
  Sun,
  Globe,
  Settings,
  ChevronDown,
  X,
} from 'lucide-react';
import { useApp, ActiveNavTab } from '../context/AppContext.tsx';
import { ApiClient } from '../services/api.ts';
import { Competition, Season } from '../types/index.ts';
import { NotificationCenterDropdown } from './NotificationCenterDropdown.tsx';
import { HeaderSearchBar } from './HeaderSearchBar.tsx';

export const Header: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    activeCompetitionId,
    setActiveCompetitionId,
    activeSeasonId,
    setActiveSeasonId,
    language,
    setLanguage,
    theme,
    toggleTheme,
    setIsSettingsOpen,
    t,
  } = useApp();

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState<boolean>(false);

  useEffect(() => {
    ApiClient.getCompetitions().then(setCompetitions).catch(console.error);
  }, []);

  useEffect(() => {
    ApiClient.getSeasons(activeCompetitionId).then((data) => {
      setSeasons(data);
      if (data.length > 0 && !data.some((s) => s.id === activeSeasonId)) {
        setActiveSeasonId(data[0].id);
      }
    }).catch(console.error);
  }, [activeCompetitionId]);

  const navItems: { id: ActiveNavTab; label: string }[] = [
    { id: 'home', label: t('nav.home') },
    { id: 'games', label: t('nav.games') },
    { id: 'standings', label: t('nav.standings') },
    { id: 'statistics', label: t('nav.statistics') },
    { id: 'leaders', label: t('nav.leaders') },
    { id: 'teams', label: t('nav.teams') },
    { id: 'players', label: t('nav.players') },
    { id: 'news', label: t('nav.news') },
    { id: 'videos', label: t('nav.videos') },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/80">
      {/* Top Bar: Selector & Utilities */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs border-b border-slate-900 overflow-x-hidden">
        {/* Global Competition & Season Selectors */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 text-slate-400 font-medium shrink-0">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="hidden sm:inline">{t('common.competition')}:</span>
          </div>

          {/* Competition dropdown */}
          <div className="relative inline-block max-w-[130px] sm:max-w-none">
            <select
              id="competition-selector"
              value={activeCompetitionId}
              onChange={(e) => {
                setActiveCompetitionId(e.target.value);
                const comp = competitions.find((c) => c.id === e.target.value);
                if (comp) setActiveSeasonId(comp.currentSeasonId);
              }}
              className="w-full truncate appearance-none bg-slate-900 hover:bg-slate-800 text-slate-100 font-semibold px-2 sm:px-3 py-1 pr-6 sm:pr-7 rounded-md border border-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500 text-[11px] sm:text-xs transition-colors"
            >
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName} ({c.country})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
          </div>

          {/* Season dropdown */}
          <div className="relative inline-block max-w-[110px] sm:max-w-none">
            <select
              id="season-selector"
              value={activeSeasonId}
              onChange={(e) => setActiveSeasonId(e.target.value)}
              className="w-full truncate appearance-none bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium px-2 sm:px-2.5 py-1 pr-5 sm:pr-6 rounded-md border border-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500 text-[11px] sm:text-xs transition-colors"
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || `${s.year} ${s.isCurrent ? '(Actual)' : ''}`}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1 sm:right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
          </div>
        </div>

        {/* Intelligent Real-time Search Bar (Desktop / Tablet) */}
        <div className="hidden md:flex flex-1 max-w-sm lg:max-w-md mx-2">
          <HeaderSearchBar />
        </div>

        {/* Quick controls: Mobile Search Trigger, Language, Theme, Notifications, Settings */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Mobile search toggle button */}
          <button
            id="mobile-search-toggle-btn"
            onClick={() => setIsMobileSearchExpanded((prev) => !prev)}
            className="md:hidden flex items-center justify-center p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
            title="Buscar equipos, jugadores o artículos"
            aria-label="Abrir buscador"
          >
            {isMobileSearchExpanded ? (
              <X className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Search className="w-3.5 h-3.5 text-slate-300" />
            )}
          </button>

          {/* Language Switcher */}
          <button
            id="language-switcher-btn"
            onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
            title="Cambiar idioma"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span className="uppercase font-semibold">{language}</span>
          </button>

          {/* Theme Quick Toggle */}
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer transition-colors"
            title={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
            aria-label="Cambiar tema"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
            )}
          </button>

          {/* Notification Center Dropdown */}
          <NotificationCenterDropdown />

          {/* Settings Menu Button */}
          <button
            id="nav-settings-btn"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer transition-colors"
            title="Configuración de la plataforma (Tema Claro/Oscuro, Idioma, Preferencias)"
            aria-label="Abrir menú de configuración"
          >
            <Settings className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline font-medium text-xs">
              {language === 'es' ? 'Ajustes' : 'Settings'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Search Bar Expansion (Visible when toggled on mobile) */}
      {isMobileSearchExpanded && (
        <div className="md:hidden px-4 py-2.5 bg-slate-950 border-b border-slate-800 animate-in slide-in-from-top-2 duration-150">
          <HeaderSearchBar />
        </div>
      )}

      {/* Main Header & Nav Tabs */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Brand Logo */}
        <div
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-bold shadow-lg shadow-emerald-950/40 group-hover:scale-105 transition-transform">
            <span className="text-xl">⚾</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white font-['Teko'] uppercase text-2xl leading-none">
                BASEBALL<span className="text-emerald-500 dark:text-emerald-400 ml-1">HUB</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-none">
              Plataforma Deportiva Modular
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Mobile Search Button (Quick toggle) */}
        <div className="flex lg:hidden items-center gap-2">
          <button
            onClick={() => setIsMobileSearchExpanded((prev) => !prev)}
            className="p-2 rounded-lg bg-slate-900 text-slate-300 border border-slate-800"
            title="Buscar"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
