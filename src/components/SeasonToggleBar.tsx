import React from 'react';
import { History } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { AVAILABLE_SEASONS } from '../utils/season.ts';

interface SeasonToggleBarProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export const SeasonToggleBar: React.FC<SeasonToggleBarProps> = ({ className = '', variant = 'compact' }) => {
  const { activeSeasonId, setActiveSeasonId } = useApp();

  return (
    <div className={`flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 ${className}`}>
      <div className="hidden sm:flex items-center gap-1.5 px-2 text-slate-400 text-xs font-semibold">
        <History className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[11px] uppercase tracking-wider">Edición:</span>
      </div>
      {AVAILABLE_SEASONS.map((season) => {
        const isActive = activeSeasonId === season.id;
        return (
          <button
            key={season.id}
            id={`season-toggle-${season.id}`}
            onClick={() => setActiveSeasonId(season.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              isActive
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={season.fullLabel}
          >
            {variant === 'full' ? season.fullLabel : season.shortLabel}
          </button>
        );
      })}
    </div>
  );
};
