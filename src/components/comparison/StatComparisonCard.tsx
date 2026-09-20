import React from 'react';

export interface StatComparisonCardProps {
  title: string;
  icon?: React.ReactNode;
  subtitle?: string;
  badge?: string;
  teamAName?: string;
  teamBName?: string;
  teamAColor?: string;
  teamBColor?: string;
  children: React.ReactNode;
}

export const StatComparisonCard: React.FC<StatComparisonCardProps> = ({
  title,
  icon,
  subtitle,
  badge,
  teamAName,
  teamBName,
  teamAColor,
  teamBColor,
  children,
}) => {
  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {icon && <div className="text-emerald-400 shrink-0">{icon}</div>}
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>{title}</span>
              {badge && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                  {badge}
                </span>
              )}
            </h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {/* Team Legend Pills (if provided) */}
        {(teamAName || teamBName) && (
          <div className="flex items-center gap-3 text-xs font-semibold">
            {teamAName && (
              <span className="flex items-center gap-1 text-slate-300">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: teamAColor || '#3b82f6' }}
                />
                {teamAName}
              </span>
            )}
            <span className="text-slate-600">vs</span>
            {teamBName && (
              <span className="flex items-center gap-1 text-slate-300">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: teamBColor || '#10b981' }}
                />
                {teamBName}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-2.5 flex-1">{children}</div>
    </div>
  );
};
