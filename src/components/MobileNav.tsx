import React, { useState } from 'react';
import {
  Home,
  Calendar,
  BarChart3,
  Shield,
  MoreHorizontal,
  Users,
  Trophy,
  Award,
  Newspaper,
  Video,
  Settings,
  X,
  Sun,
  Moon,
  Sliders,
} from 'lucide-react';
import { useApp, ActiveNavTab } from '../context/AppContext.tsx';

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab, t, theme, toggleTheme, setIsSettingsOpen } = useApp();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const mainTabs: { id: ActiveNavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: t('nav.home'), icon: <Home className="w-5 h-5" /> },
    { id: 'games', label: t('nav.games'), icon: <Calendar className="w-5 h-5" /> },
    { id: 'statistics', label: t('nav.statistics'), icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'teams', label: t('nav.teams'), icon: <Shield className="w-5 h-5" /> },
  ];

  const moreItems: { id: ActiveNavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'players', label: t('nav.players'), icon: <Users className="w-5 h-5 text-emerald-400" /> },
    { id: 'standings', label: t('nav.standings'), icon: <Trophy className="w-5 h-5 text-amber-400" /> },
    { id: 'leaders', label: t('nav.leaders'), icon: <Award className="w-5 h-5 text-sky-400" /> },
    { id: 'news', label: t('nav.news'), icon: <Newspaper className="w-5 h-5 text-purple-400" /> },
    { id: 'videos', label: t('nav.videos'), icon: <Video className="w-5 h-5 text-rose-400" /> },
  ];

  return (
    <>
      {/* "Más" Drawer Sheet */}
      {isMoreOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMoreOpen(false)}
        >
          <div
            className="w-full bg-slate-900 border-t border-slate-800 rounded-t-2xl p-4 shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <span className="font-bold text-slate-200 text-sm">{t('nav.more')} Secciones</span>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 py-2">
              {moreItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMoreOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                    activeTab === item.id
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {item.icon}
                  <span className="text-xs font-semibold mt-1.5">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Quick Theme & Settings Bar */}
            <div className="pt-3 mt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                id="mobile-theme-toggle"
                onClick={toggleTheme}
                className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-slate-200"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span>Modo Claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-400" />
                    <span>Modo Oscuro</span>
                  </>
                )}
              </button>

              <button
                id="mobile-settings-btn"
                onClick={() => {
                  setIsMoreOpen(false);
                  setIsSettingsOpen(true);
                }}
                className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-slate-200"
              >
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Ajustes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Fixed Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur px-2 py-1.5 flex items-center justify-around">
        {mainTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setIsMoreOpen(false);
              }}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
                isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.icon}
              <span className="text-[10px] mt-0.5">{tab.label}</span>
            </button>
          );
        })}

        {/* "Más" toggle */}
        <button
          onClick={() => setIsMoreOpen(!isMoreOpen)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            isMoreOpen ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">{t('nav.more')}</span>
        </button>
      </nav>
    </>
  );
};
