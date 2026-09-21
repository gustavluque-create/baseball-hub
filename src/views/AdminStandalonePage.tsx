import React from 'react';
import {
  Shield,
  ShieldCheck,
  ArrowLeft,
  LogOut,
  Sun,
  Moon,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { useAdminAuth } from '../context/AdminAuthContext.tsx';
import { AdminLoginForm } from '../components/AdminLoginModal.tsx';
import { AdminView } from './AdminView.tsx';

export const AdminStandalonePage: React.FC = () => {
  const { setActiveTab, theme, toggleTheme } = useApp();
  const { isAdminAuthenticated, adminUser, logout } = useAdminAuth();

  const handleReturnToPublic = () => {
    setActiveTab('home');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Dedicated Independent Admin Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand & Route Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleReturnToPublic}
              className="flex items-center gap-2.5 group cursor-pointer text-left"
              title="Volver al Portal Deportivo Público"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-bold shadow-md shadow-emerald-950/50 group-hover:scale-105 transition-transform">
                <span className="text-lg">⚾</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black tracking-tight text-white font-['Teko'] uppercase text-xl sm:text-2xl leading-none">
                    BASEBALL<span className="text-emerald-400 ml-0.5">HUB</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    ADMIN
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 leading-none mt-0.5">
                  Consola de Administración Independiente (/admin)
                </p>
              </div>
            </button>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label="Alternar tema"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Link back to public site */}
            <button
              onClick={handleReturnToPublic}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition-all cursor-pointer shadow-sm"
              title="Ir a la vista pública de partidos y estadísticas"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Sitio Público</span>
              <span className="sm:hidden">Sitio</span>
            </button>

            {/* Logout button (if authenticated) */}
            {isAdminAuthenticated && (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm"
                title="Cerrar sesión administrativa"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Admin Content Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {isAdminAuthenticated ? (
          <AdminView />
        ) : (
          <div className="py-12 sm:py-20 flex flex-col items-center justify-center">
            {/* Security Introduction Header */}
            <div className="w-full max-w-md text-center mb-6 space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-medium">
                <Lock className="w-3.5 h-3.5" />
                <span>Ruta Restringida: /admin</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-['Teko'] uppercase">
                Portal de Administración
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Acceso exclusivo para personal técnico, anotadores oficiales de la Serie Nacional y administradores del sistema.
              </p>
            </div>

            {/* Standalone Login Card */}
            <div className="w-full max-w-md">
              <AdminLoginForm />
            </div>

            {/* Return link */}
            <div className="mt-8 text-center">
              <button
                onClick={handleReturnToPublic}
                className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer group"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>Volver a la cartelera pública de partidos</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Dedicated Admin Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950 py-4 px-4 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
          <p>© 2026 BASEBALL HUB • Consola de Gestión y Operaciones Oficiales</p>
          <p className="text-slate-600 font-mono">Acceso protegido mediante tokens de sesión y RBAC</p>
        </div>
      </footer>
    </div>
  );
};
