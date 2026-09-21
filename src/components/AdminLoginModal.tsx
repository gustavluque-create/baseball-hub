import React, { useState } from 'react';
import {
  Lock,
  KeyRound,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  X,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext.tsx';
import { useApp } from '../context/AppContext.tsx';

interface AdminLoginProps {
  isModal?: boolean;
  onSuccess?: () => void;
  onClose?: () => void;
}

export const AdminLoginForm: React.FC<AdminLoginProps> = ({ isModal = false, onSuccess, onClose }) => {
  const { login } = useAdminAuth();
  const { setActiveTab } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Por favor complete tanto el usuario como la contraseña.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await login(username, password);
    setIsSubmitting(false);

    if (result.success) {
      setActiveTab('admin');
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } else {
      setError(result.error || 'Credenciales no autorizadas.');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
        {/* Header Icon & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-1 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-100 tracking-tight">
            Acceso Administrativo
          </h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Área de gestión exclusiva. Ingrese con sus credenciales autorizadas de comisario o administrador.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 text-xs text-red-300 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Usuario o ID de Operador
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                id="admin-username-input"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingrese su usuario"
                disabled={isSubmitting}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Contraseña de Seguridad
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                id="admin-password-input"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={isSubmitting}
                className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="admin-login-submit-btn"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40 cursor-pointer disabled:opacity-50 mt-2"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Verificando Credenciales...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Ingresar al Panel de Control</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </span>
            )}
          </button>
        </form>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-mono pt-2">
          <ShieldAlert className="w-3 h-3 text-emerald-500" />
          <span>Acceso cifrado con token de sesión de 24 horas</span>
        </div>
      </div>
    </div>
  );
};

export const AdminLoginModal: React.FC = () => {
  const { isLoginModalOpen, closeLoginModal } = useAdminAuth();

  if (!isLoginModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md">
        <button
          onClick={closeLoginModal}
          className="absolute -top-3 -right-3 z-10 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 shadow-lg cursor-pointer transition-colors"
          title="Cerrar ventana"
        >
          <X className="w-4 h-4" />
        </button>
        <AdminLoginForm isModal onClose={closeLoginModal} />
      </div>
    </div>
  );
};
