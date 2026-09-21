import React from 'react';
import { Header } from '../components/Header.tsx';
import { MobileNav } from '../components/MobileNav.tsx';
import { GlobalSearchModal } from '../components/GlobalSearchModal.tsx';
import { BoxScoreModal } from '../components/BoxScoreModal.tsx';
import { PlayerProfileModal } from '../components/PlayerProfileModal.tsx';
import { TeamProfileModal } from '../components/TeamProfileModal.tsx';
import { NewsArticleModal } from '../components/NewsArticleModal.tsx';
import { SettingsMenuModal } from '../components/SettingsMenuModal.tsx';
import { GameMatchupModal } from '../components/GameMatchupModal.tsx';
import { LiveTicker } from '../components/LiveTicker.tsx';
import { ScoreChangeToastContainer } from '../components/ScoreChangeToast.tsx';
import { PlayByPlayQuickViewModal } from '../components/PlayByPlayQuickViewModal.tsx';
import { useApp } from '../context/AppContext.tsx';
import { useScoreNotifications } from '../context/ScoreNotificationContext.tsx';
import { useAdminAuth } from '../context/AdminAuthContext.tsx';
import { Shield, Trophy, BarChart3, Sliders, Lock, ShieldCheck } from 'lucide-react';

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    activeTab,
    selectedGameId,
    setSelectedGameId,
    selectedComparisonGameId,
    setSelectedComparisonGameId,
    selectedPlayerId,
    setSelectedPlayerId,
    selectedTeamId,
    setSelectedTeamId,
    selectedNewsSlug,
    setSelectedNewsSlug,
    setActiveTab,
    setIsSettingsOpen,
    theme,
  } = useApp();
  const { isAdminAuthenticated } = useAdminAuth();

  const {
    toasts,
    dismissToast,
    clearAllToasts,
    soundEnabled,
    setSoundEnabled,
    activeQuickViewToast,
    setActiveQuickViewToast,
    simulateScoreChange,
  } = useScoreNotifications();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Main Navigation Header */}
      <Header />

      {/* Real-time Scores Live Ticker Bar */}
      <LiveTicker />

      {/* Main Page Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950 py-10 px-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Col 1: Brand & Philosophy */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white font-['Teko'] uppercase text-2xl leading-none">
                  BASEBALL<span className="text-emerald-400 ml-0.5">HUB</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  CORE
                </span>
              </div>
              <p className="text-slate-400 leading-relaxed text-xs">
                Plataforma web independiente y escalable diseñada para estadísticas, partidos en vivo, coberturas y gestión de datos de béisbol.
              </p>
            </div>

            {/* Col 2: Competitions & Matches */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Competiciones</h4>
              <ul className="space-y-1.5">
                <li>
                  <button onClick={() => setActiveTab('games')} className="hover:text-emerald-400 transition-colors">
                    Serie Nacional de Béisbol (SNB)
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab('games')} className="hover:text-emerald-400 transition-colors">
                    Liga Élite del Béisbol Cubano (LEBC)
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab('standings')} className="hover:text-emerald-400 transition-colors">
                    Tablas de Posiciones
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab('games')} className="hover:text-emerald-400 transition-colors">
                    Calendario &amp; Resultados
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 3: Statistics & Leaders */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Estadísticas</h4>
              <ul className="space-y-1.5">
                <li>
                  <button onClick={() => setActiveTab('statistics')} className="hover:text-emerald-400 transition-colors">
                    Estadísticas de Bateo
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab('statistics')} className="hover:text-emerald-400 transition-colors">
                    Estadísticas de Pitcheo
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab('leaders')} className="hover:text-emerald-400 transition-colors">
                    Líderes Individuales
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab('statistics')} className="hover:text-emerald-400 transition-colors">
                    Métricas Sabermétricas (WAR, OPS, wOBA)
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 4: Platform & Architecture */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Arquitectura</h4>
              <ul className="space-y-1.5">
                <li>
                  <button onClick={() => setIsSettingsOpen(true)} className="hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer">
                    <Sliders className="w-3 h-3 text-emerald-400" />
                    <span>Ajustes de Tema &amp; Interfaz</span>
                  </button>
                </li>
                <li>
                  <span className="text-slate-500">API RESTful / Swagger Ready</span>
                </li>
                <li>
                  <span className="text-slate-500">Normalizador de Campos (AVG, HR, CI)</span>
                </li>
                <li>
                  <span className="text-slate-500">PWA &amp; Mobile Ready</span>
                </li>
                <li className="pt-1 border-t border-slate-900">
                  <button
                    onClick={() => setActiveTab('admin')}
                    className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 text-slate-400 cursor-pointer text-xs"
                    title="Acceso exclusivo para administradores de la plataforma"
                  >
                    {isAdminAuthenticated ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Panel Admin (Activo)</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Consola Admin (/admin)</span>
                      </>
                    )}
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-[11px]">
            <p>© 2026 BASEBALL HUB. Plataforma deportiva independiente. Todos los derechos reservados.</p>
            <p>Diseño con Tailwind CSS. Conmutación global de colores claro y oscuro.</p>
          </div>
        </div>
      </footer>

      {/* Floating Mobile Bottom Navigation */}
      <MobileNav />

      {/* Global Interactive Modals */}
      <GlobalSearchModal />
      <SettingsMenuModal />
      <GameMatchupModal
        gameId={selectedComparisonGameId}
        onClose={() => setSelectedComparisonGameId(null)}
        onOpenBoxScore={(id) => {
          setSelectedComparisonGameId(null);
          setSelectedGameId(id);
        }}
      />
      <BoxScoreModal gameId={selectedGameId} onClose={() => setSelectedGameId(null)} />
      <PlayerProfileModal playerId={selectedPlayerId} onClose={() => setSelectedPlayerId(null)} />
      <TeamProfileModal teamId={selectedTeamId} onClose={() => setSelectedTeamId(null)} />
      {activeTab !== 'article' && (
        <NewsArticleModal slug={selectedNewsSlug} onClose={() => setSelectedNewsSlug(null)} />
      )}

      {/* Floating Real-Time Score Change Toasts */}
      <ScoreChangeToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
        onClearAll={clearAllToasts}
        onViewGame={(id) => setSelectedGameId(id)}
        onQuickView={(toast) => setActiveQuickViewToast(toast)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
      />

      {/* Play by Play Quick View Modal */}
      <PlayByPlayQuickViewModal
        toast={activeQuickViewToast}
        onClose={() => setActiveQuickViewToast(null)}
        onNavigateToBoxScore={(id) => {
          setActiveQuickViewToast(null);
          setSelectedGameId(id);
        }}
        onSimulateRun={(gameId, side) => simulateScoreChange(gameId, side)}
      />
    </div>
  );
};
