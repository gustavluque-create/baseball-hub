import React, { useState } from 'react';
import { useFirebaseAuth } from '../context/FirebaseAuthContext.tsx';
import { LogIn, LogOut, User } from 'lucide-react';

export const GoogleUserAuthButton: React.FC = () => {
  const { user, loading, signInWithGoogle, signOutUser } = useFirebaseAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (loading) {
    return (
      <div className="h-6 w-16 bg-slate-800 animate-pulse rounded text-xs"></div>
    );
  }

  if (!user) {
    return (
      <button
        onClick={() => signInWithGoogle().catch(() => {})}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-600 transition-colors text-xs font-medium cursor-pointer"
        title="Iniciar sesión con Google"
        aria-label="Acceder con Google"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span className="hidden sm:inline">Google</span>
        <span className="sm:hidden">Entrar</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 cursor-pointer text-xs"
        title={user.email || 'Usuario Google'}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'Avatar'}
            className="w-4 h-4 rounded-full object-cover"
          />
        ) : (
          <User className="w-3.5 h-3.5 text-emerald-400" />
        )}
        <span className="max-w-[70px] sm:max-w-[100px] truncate font-medium">
          {user.displayName?.split(' ')[0] || 'Cuenta'}
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1 w-44 rounded-lg bg-slate-900 border border-slate-800 shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] text-slate-400 truncate">
            {user.email}
          </div>
          <button
            onClick={() => {
              signOutUser().catch(() => {});
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-slate-800 transition-colors cursor-pointer text-left"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
};
