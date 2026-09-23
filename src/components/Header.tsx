import React, { useState } from 'react';
import {
  Search,
  Moon,
  Sun,
  Globe,
  Settings,
  X,
} from 'lucide-react';
import { useApp, ActiveNavTab } from '../context/AppContext.tsx';
import { NotificationCenterDropdown } from './NotificationCenterDropdown.tsx';
import { HeaderSearchBar } from './HeaderSearchBar.tsx';
import { GoogleUserAuthButton } from './GoogleUserAuthButton.tsx';

export const Header: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    language,
    setLanguage,
    theme,
    toggleTheme,
    setIsSettingsOpen,
    t,
  } = useApp();

  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState<boolean>(false);

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
      {/* Top Bar: Quick Search & Utilities */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs border-b border-slate-900 overflow-x-hidden">
        {/* Intelligent Real-time Search Bar (Desktop / Tablet) */}
        <div className="hidden md:flex flex-1 max-w-sm lg:max-w-md">
          <HeaderSearchBar />
        </div>

        {/* Quick controls: Mobile Search Trigger, Language, Theme, Notifications, Settings */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto">
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

          {/* Google User Auth */}
          <GoogleUserAuthButton />

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
