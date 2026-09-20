import React from 'react';

/**
 * Base skeleton element with smooth pulse/shimmer animation
 * Supports light & dark modes with Tailwind classes
 */
export const Skeleton: React.FC<{
  className?: string;
  variant?: 'rectangular' | 'circular' | 'rounded' | 'pill';
  shimmer?: boolean;
  style?: React.CSSProperties;
}> = ({ className = '', variant = 'rounded', shimmer = false, style }) => {
  const variantClasses = {
    rectangular: 'rounded-none',
    circular: 'rounded-full',
    rounded: 'rounded-xl',
    pill: 'rounded-full',
  };

  return (
    <div
      className={`relative overflow-hidden bg-slate-200 dark:bg-slate-800/80 ${
        shimmer ? '' : 'animate-pulse'
      } ${variantClasses[variant]} ${className}`}
      style={style}
      aria-hidden="true"
    >
      {shimmer && (
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent" />
      )}
    </div>
  );
};

/**
 * Reusable Skeleton Text with configurable lines
 */
export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}> = ({ lines = 3, className = '', lastLineWidth = 'w-3/5' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3.5 ${
            i === lines - 1 ? lastLineWidth : i % 2 === 0 ? 'w-full' : 'w-11/12'
          } rounded`}
        />
      ))}
    </div>
  );
};

/**
 * Reusable Skeleton Avatar
 */
export const SkeletonAvatar: React.FC<{
  size?: 'sm' | 'md' | 'lg' | 'xl';
  withBadge?: boolean;
  className?: string;
}> = ({ size = 'md', withBadge = false, className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24 sm:w-28 sm:h-28',
  };

  return (
    <div className={`relative inline-block shrink-0 ${className}`}>
      <Skeleton className={`${sizeClasses[size]} rounded-full`} variant="circular" />
      {withBadge && (
        <Skeleton className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-900" />
      )}
    </div>
  );
};

/**
 * Reusable Skeleton Button
 */
export const SkeletonButton: React.FC<{
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-7 w-20',
    md: 'h-9 w-28',
    lg: 'h-11 w-36',
  };

  return <Skeleton className={`${sizeClasses[size]} rounded-xl ${className}`} />;
};

/* =========================================================================
   1. SKELETONS PARA PARTIDOS (GAMES, MATCHUPS, LIVE DASHBOARD)
   ========================================================================= */

/**
 * Skeleton for GameCard / Matches
 * Mirrors the exact layout of the real GameCard (status, stadium, away/home team, scores, inning, bases, actions)
 */
export const GameCardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3.5 shadow-sm dark:shadow-md ${className}`}
    >
      {/* Header: Status Pill and Stadium Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-12 rounded-md hidden sm:inline-block" />
        </div>
        <Skeleton className="h-3.5 w-32 rounded-md" />
      </div>

      {/* Teams and Scores */}
      <div className="space-y-2.5 py-1">
        {/* Away Team */}
        <div className="flex items-center justify-between gap-3 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
            <div className="space-y-1.5 min-w-0 flex-1">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-2.5 w-16 rounded" />
            </div>
          </div>
          <Skeleton className="h-7 w-9 rounded-lg shrink-0" />
        </div>

        {/* Home Team */}
        <div className="flex items-center justify-between gap-3 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
            <div className="space-y-1.5 min-w-0 flex-1">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-2.5 w-16 rounded" />
            </div>
          </div>
          <Skeleton className="h-7 w-9 rounded-lg shrink-0" />
        </div>
      </div>

      {/* Footer: Situation (Bases / Inning / Outs) and Actions */}
      <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Diamond bases placeholder */}
          <div className="w-5 h-5 relative flex items-center justify-center">
            <Skeleton className="w-2.5 h-2.5 rotate-45 rounded-xs" />
          </div>
          <Skeleton className="h-3.5 w-20 rounded" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-6 w-16 rounded-lg" />
          <Skeleton className="h-6 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

/**
 * Grid layout of GameCard skeletons
 */
export const GamesGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, idx) => (
        <GameCardSkeleton key={idx} />
      ))}
    </div>
  );
};

/**
 * Horizontal Ticker of Game Cards for Home View
 */
export const GamesTickerSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="min-w-[280px] sm:min-w-[320px] shrink-0">
          <GameCardSkeleton />
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton for individual compact game item inside LiveTicker
 */
export const LiveTickerItemSkeleton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shrink-0 shadow-xs space-y-2 ${
        compact
          ? 'min-w-[190px] p-2'
          : 'min-w-[220px] sm:min-w-[240px] p-2.5'
      }`}
    >
      <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-100 dark:border-slate-850">
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3.5 w-12 rounded-full" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded-md shrink-0" />
            <Skeleton className="h-3.5 w-20 rounded" />
          </div>
          <Skeleton className="h-4 w-5 rounded" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded-md shrink-0" />
            <Skeleton className="h-3.5 w-24 rounded" />
          </div>
          <Skeleton className="h-4 w-5 rounded" />
        </div>
      </div>
    </div>
  );
};

/**
 * Full LiveTicker horizontal bar skeleton with header controls and items
 */
export const LiveTickerSkeleton: React.FC<{ count?: number; compact?: boolean }> = ({
  count = 5,
  compact = false,
}) => {
  return (
    <div className="w-full border-b border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-950/90 py-2.5 px-4 sm:px-6 space-y-2">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-6 w-14 rounded-lg hidden sm:inline-block" />
          <Skeleton className="h-6 w-14 rounded-lg hidden sm:inline-block" />
          <Skeleton className="h-6 w-20 rounded-lg" />
        </div>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none items-stretch max-w-7xl mx-auto">
        {Array.from({ length: count }).map((_, idx) => (
          <LiveTickerItemSkeleton key={idx} compact={compact} />
        ))}
      </div>
    </div>
  );
};

/**
 * Matchup comparison skeleton (for GameMatchupModal)
 */
export const GameMatchupSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Top Banner: Dual Team Comparison Header */}
      <div className="relative rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-4 w-36 rounded" />
        </div>

        <div className="grid grid-cols-3 items-center gap-4 text-center">
          {/* Away Team */}
          <div className="flex flex-col items-center space-y-2">
            <Skeleton className="w-16 h-16 rounded-2xl" />
            <Skeleton className="h-5 w-28 rounded" />
            <Skeleton className="h-3.5 w-16 rounded" />
          </div>

          {/* VS Center */}
          <div className="flex flex-col items-center space-y-2">
            <Skeleton className="h-8 w-12 rounded-lg" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>

          {/* Home Team */}
          <div className="flex flex-col items-center space-y-2">
            <Skeleton className="w-16 h-16 rounded-2xl" />
            <Skeleton className="h-5 w-28 rounded" />
            <Skeleton className="h-3.5 w-16 rounded" />
          </div>
        </div>
      </div>

      {/* Comparison Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl border border-slate-800 bg-slate-900/90 space-y-3"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-3.5 w-12 rounded" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-full rounded-full" />
              <div className="flex justify-between text-xs">
                <Skeleton className="h-3 w-10 rounded" />
                <Skeleton className="h-3 w-10 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* =========================================================================
   2. SKELETONS PARA TABLAS DE ESTADÍSTICAS & POSICIONES
   ========================================================================= */

/**
 * Skeleton specifically styled for Statistics Table (Batting, Pitching, Advanced)
 */
export const StatisticsTableSkeleton: React.FC<{
  rows?: number;
  statType?: 'batting' | 'pitching' | 'advanced';
}> = ({ rows = 10, statType = 'batting' }) => {
  const columnCount = statType === 'pitching' ? 10 : 13;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xl overflow-hidden">
      {/* Table Toolbar Skeleton */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/60">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Skeleton className="h-9 w-60 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>

      {/* Table Header */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono text-left">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 uppercase font-sans text-[11px]">
              <th className="py-3 px-3 w-40">
                <Skeleton className="h-4 w-20 rounded" />
              </th>
              <th className="py-3 px-2 text-center w-12">
                <Skeleton className="h-4 w-8 mx-auto rounded" />
              </th>
              <th className="py-3 px-2 text-center w-12">
                <Skeleton className="h-4 w-8 mx-auto rounded" />
              </th>
              {Array.from({ length: columnCount }).map((_, i) => (
                <th key={i} className="py-3 px-2.5 text-right">
                  <Skeleton className="h-3.5 w-8 ml-auto rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                {/* Player info */}
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="w-7 h-7 rounded-full shrink-0" variant="circular" />
                    <div className="space-y-1 min-w-0 flex-1">
                      <Skeleton
                        className={`h-3.5 ${
                          rowIdx % 3 === 0 ? 'w-28' : rowIdx % 3 === 1 ? 'w-36' : 'w-24'
                        } rounded`}
                      />
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2 text-center">
                  <Skeleton className="h-4 w-7 mx-auto rounded" />
                </td>
                <td className="py-3 px-2 text-center">
                  <Skeleton className="h-4 w-6 mx-auto rounded" />
                </td>

                {/* Numeric Columns */}
                {Array.from({ length: columnCount }).map((_, colIdx) => (
                  <td key={colIdx} className="py-3 px-2.5 text-right">
                    <Skeleton
                      className={`h-4 ml-auto rounded ${
                        colIdx >= columnCount - 3 ? 'w-10' : 'w-7'
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-950/40">
        <Skeleton className="h-4 w-36 rounded" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-7 w-16 rounded-lg" />
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-7 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton specifically styled for Standings Table (with playoff line)
 */
export const StandingsTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 8 }) => {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono text-left">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 uppercase font-sans text-[11px]">
              <th className="py-3 px-3 text-center w-10">
                <Skeleton className="h-3.5 w-6 mx-auto rounded" />
              </th>
              <th className="py-3 px-4 min-w-[200px]">
                <Skeleton className="h-3.5 w-24 rounded" />
              </th>
              {['JJ', 'G', 'P', 'PCT', 'DIF', 'L10', 'RACHA', 'CASA', 'FUERA', 'CA', 'CP'].map(
                (col) => (
                  <th key={col} className="py-3 px-3 text-right">
                    <Skeleton className="h-3.5 w-7 ml-auto rounded" />
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
            {Array.from({ length: rows }).map((_, idx) => {
              const isPlayoffZone = idx < 4;
              return (
                <tr
                  key={idx}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                    isPlayoffZone
                      ? 'border-l-4 border-l-emerald-500/40'
                      : 'border-l-4 border-l-transparent'
                  }`}
                >
                  <td className="py-3 px-3 text-center">
                    <Skeleton className="h-4 w-5 mx-auto rounded" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
                      <Skeleton
                        className={`h-4 ${
                          idx % 2 === 0 ? 'w-32' : 'w-24'
                        } rounded`}
                      />
                    </div>
                  </td>
                  {Array.from({ length: 11 }).map((_, c) => (
                    <td key={c} className="py-3 px-3 text-right">
                      <Skeleton
                        className={`h-4 ml-auto rounded ${c === 3 ? 'w-10' : 'w-6'}`}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * General configurable Table Skeleton
 */
export const TableSkeleton: React.FC<{
  rows?: number;
  columns?: number;
  showSearchHeader?: boolean;
}> = ({ rows = 8, columns = 10, showSearchHeader = false }) => {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xl overflow-hidden space-y-0">
      {showSearchHeader && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-8 w-32 rounded-xl" />
        </div>
      )}

      {/* Table Header Skeleton */}
      <div className="bg-slate-100 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-36 rounded" />
        <div className="flex items-center gap-3">
          {Array.from({ length: Math.min(columns, 8) }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 w-8 rounded" />
          ))}
        </div>
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60 p-1">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-5 rounded" />
              <Skeleton className="h-7 w-7 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-3.5 w-32 rounded" />
                <Skeleton className="h-2.5 w-16 rounded" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {Array.from({ length: Math.min(columns, 8) }).map((_, colIdx) => (
                <Skeleton
                  key={colIdx}
                  className={`h-4 ${colIdx % 2 === 0 ? 'w-8' : 'w-10'} rounded`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* =========================================================================
   3. SKELETONS PARA PERFILES DE JUGADORES & DIRECTORIOS
   ========================================================================= */

/**
 * Skeleton for Player Card in Directory (PlayersView)
 */
export const PlayerCardSkeleton: React.FC = () => {
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
      <div className="relative shrink-0">
        <Skeleton className="w-14 h-14 rounded-full" variant="circular" />
        <Skeleton className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full" />
      </div>
      <div className="space-y-2 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-3.5 w-7 rounded" />
        </div>
        <Skeleton className="h-3 w-20 rounded" />
        <div className="flex items-center gap-2 pt-0.5">
          <Skeleton className="h-2.5 w-12 rounded" />
          <Skeleton className="h-2.5 w-2 rounded" />
          <Skeleton className="h-2.5 w-10 rounded" />
        </div>
      </div>
    </div>
  );
};

/**
 * Grid of Player Card Skeletons
 */
export const PlayersGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <PlayerCardSkeleton key={idx} />
      ))}
    </div>
  );
};

/**
 * Comprehensive Player Profile Skeleton (for PlayerProfileModal or Player Page)
 * Features Hero Avatar, Biometrics, Season Stat Cards, Trend Chart, and Narrative
 */
export const PlayerProfileSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* 1. Hero Header Banner */}
      <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div className="relative shrink-0">
          <Skeleton className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl" />
          <Skeleton className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-2 border-white dark:border-slate-900" />
        </div>

        <div className="space-y-2.5 flex-1 text-center sm:text-left min-w-0">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <Skeleton className="h-7 w-48 rounded-lg" />
            <Skeleton className="h-6 w-12 rounded-lg" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>

          <Skeleton className="h-4 w-36 rounded mx-auto sm:mx-0" />

          {/* Biometrics Bar */}
          <div className="flex flex-wrap gap-3 pt-2 justify-center sm:justify-start">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-3.5 w-20 rounded" />
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-3.5 w-32 rounded" />
          </div>
        </div>
      </div>

      {/* 2. Key Seasonal Statistics Cards */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-3.5 w-24 rounded" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 text-center shadow-xs"
            >
              <Skeleton className="h-2.5 w-12 mx-auto rounded" />
              <Skeleton className="h-7 w-16 mx-auto rounded-md" />
              <Skeleton className="h-2 w-10 mx-auto rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. Performance Trend Chart Skeleton */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-44 rounded" />
          <Skeleton className="h-3.5 w-28 rounded" />
        </div>
        <div className="h-44 w-full flex items-end justify-between gap-3 pt-4 px-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <Skeleton
                className="w-full rounded-t-lg"
                style={{ height: `${35 + ((i * 17) % 55)}%` }}
              />
              <Skeleton className="h-3 w-6 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 4. Bio / Trajectory Paragraphs */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
        <Skeleton className="h-4 w-32 rounded mb-1" />
        <Skeleton className="h-3.5 w-full rounded" />
        <Skeleton className="h-3.5 w-11/12 rounded" />
        <Skeleton className="h-3.5 w-4/5 rounded" />
      </div>
    </div>
  );
};

/**
 * Skeleton for Player vs Player Comparison View
 */
export const PlayerComparisonSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PlayerCardSkeleton />
        <PlayerCardSkeleton />
      </div>

      <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
        <Skeleton className="h-5 w-48 rounded" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <Skeleton className="h-3 w-12 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-3 w-12 rounded" />
              </div>
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   4. OTROS SKELETONS (LEADERS, TEAMS, BOX SCORE, CHARTS, NOTICIAS)
   ========================================================================= */

/**
 * Skeleton for Leaderboard Cards
 */
export const LeaderCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <Skeleton className="h-4 w-28 rounded" />
        <Skeleton className="h-4 w-10 rounded" />
      </div>

      {/* Top 1 Leader Hero */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
        <Skeleton className="w-12 h-12 rounded-full shrink-0" variant="circular" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
        <Skeleton className="h-6 w-12 rounded-lg" />
      </div>

      {/* Runner-ups */}
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
            <Skeleton className="h-3.5 w-8 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Responsive Grid of Leaderboard Cards (LeadersView)
 */
export const LeadersGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: Math.min(count, 4) }).map((_, idx) => (
          <LeaderCardSkeleton key={idx} />
        ))}
      </div>
      {count > 4 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: count - 4 }).map((_, idx) => (
            <LeaderCardSkeleton key={`row2-${idx}`} />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Skeleton for Team Card
 */
export const TeamCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-md flex flex-col justify-between space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-14 h-14 rounded-2xl shrink-0" />
        <div className="space-y-1.5 flex-1 min-w-0">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-3 w-10 rounded" />
        </div>
      </div>

      <div className="space-y-2 py-3 border-y border-slate-200 dark:border-slate-800/80">
        <Skeleton className="h-3 w-40 rounded" />
        <Skeleton className="h-3 w-28 rounded" />
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-10 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
    </div>
  );
};

/**
 * Responsive Grid of Team Cards
 */
export const TeamsGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, idx) => (
        <TeamCardSkeleton key={idx} />
      ))}
    </div>
  );
};

/**
 * Skeleton for My Teams / Favorite Teams section on the homepage
 */
export const MyTeamsSectionSkeleton: React.FC<{ count?: number }> = ({ count = 2 }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded-full" />
          <Skeleton className="h-4 w-36 rounded" />
        </div>
        <Skeleton className="h-3.5 w-24 rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-36 rounded" />
                  <Skeleton className="h-3.5 w-24 rounded" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-2">
              <div className="flex justify-between items-center">
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-4 w-12 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton for Team Roster Table
 */
export const RosterTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm overflow-hidden space-y-0">
      <div className="bg-slate-100 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between">
        <Skeleton className="h-4 w-28 rounded" />
        <Skeleton className="h-4 w-12 rounded" />
      </div>
      <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" variant="circular" />
              <div className="space-y-1">
                <Skeleton className="h-3.5 w-32 rounded" />
                <Skeleton className="h-2.5 w-16 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-3.5 w-8 rounded" />
              <Skeleton className="h-3.5 w-12 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton for Team Profile Modal
 */
export const TeamProfileSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-6">
        <Skeleton className="w-24 h-24 rounded-2xl shrink-0" />
        <div className="space-y-2 flex-1 text-center sm:text-left">
          <Skeleton className="h-7 w-48 rounded mx-auto sm:mx-0" />
          <Skeleton className="h-4 w-36 rounded mx-auto sm:mx-0" />
          <div className="flex flex-wrap gap-3 pt-2 justify-center sm:justify-start">
            <Skeleton className="h-3.5 w-40 rounded" />
            <Skeleton className="h-3.5 w-28 rounded" />
          </div>
        </div>
        <Skeleton className="h-16 w-28 rounded-xl" />
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3"
          >
            <Skeleton className="w-10 h-10 rounded-full shrink-0" variant="circular" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-2.5 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton for Box Score Modal
 */
export const BoxScoreSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <Skeleton className="h-4 w-36 rounded" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <Skeleton className="h-3.5 w-32 rounded" />
              <div className="flex gap-2">
                <Skeleton className="h-3.5 w-6 rounded" />
                <Skeleton className="h-3.5 w-6 rounded" />
                <Skeleton className="h-3.5 w-6 rounded" />
                <Skeleton className="h-3.5 w-6 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton for Chart visualizer cards
 */
export const ChartCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
        </div>
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>
      <div className="h-64 w-full flex items-end justify-between gap-3 pt-4 px-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <Skeleton
              className="w-full rounded-t-lg"
              style={{ height: `${30 + ((i * 19) % 65)}%` }}
            />
            <Skeleton className="h-3 w-8 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton for News Article Card
 */
export const NewsCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between">
      <Skeleton className="h-48 w-full rounded-none" variant="rectangular" />
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-3 w-12 rounded" />
        </div>
        <Skeleton className="h-5 w-4/5 rounded" />
        <Skeleton className="h-3.5 w-full rounded" />
        <Skeleton className="h-3.5 w-3/4 rounded" />
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton for News Article Modal
 */
export const ArticleModalSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Category & Date badges */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-4 w-28 rounded" />
        <Skeleton className="h-4 w-20 rounded" />
        <Skeleton className="h-4 w-32 rounded" />
      </div>

      {/* Title & Subtitle */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-11/12 rounded-lg" />
        <Skeleton className="h-8 w-3/4 rounded-lg" />
        <Skeleton className="h-5 w-4/5 rounded mt-3" />
      </div>

      {/* Featured Image */}
      <Skeleton className="h-64 sm:h-80 w-full rounded-2xl" variant="rectangular" />

      {/* Article Content Paragraphs */}
      <div className="space-y-3 pt-2">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-5/6 rounded" />
        <div className="h-2" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-11/12 rounded" />
        <Skeleton className="h-4 w-4/5 rounded" />
        <div className="h-2" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
      </div>

      {/* Tags & Related Entities */}
      <div className="pt-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton for Video Item Card
 */
export const VideoCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between">
      <Skeleton className="h-48 w-full rounded-none" variant="rectangular" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-4/5 rounded" />
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </div>
    </div>
  );
};

/**
 * Reusable Simulation Trigger Button
 * Allows user to trigger a realistic loading animation to test and view the skeletons
 */
export const SimulateLoadButton: React.FC<{
  onSimulate: () => void;
  isLoading: boolean;
  label?: string;
  className?: string;
}> = ({
  onSimulate,
  isLoading,
  label = 'Simular Carga',
  className = '',
}) => {
  return (
    <button
      onClick={onSimulate}
      disabled={isLoading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer select-none border ${
        isLoading
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 cursor-wait'
          : 'bg-slate-800/80 hover:bg-slate-750 text-slate-200 hover:text-white border-slate-700 hover:border-slate-600 shadow-xs'
      } ${className}`}
      title="Simular latencia de red para apreciar los componentes de LoadingSkeleton en acción"
    >
      <svg
        className={`w-3.5 h-3.5 text-amber-400 ${isLoading ? 'animate-spin' : ''}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
        />
      </svg>
      <span>{isLoading ? 'Cargando datos...' : label}</span>
    </button>
  );
};

/**
 * Centralized LoadingSkeleton Library
 * Exported both as a consolidated namespace object and individual named exports.
 */
export const LoadingSkeleton = {
  // Primitives
  Base: Skeleton,
  Text: SkeletonText,
  Avatar: SkeletonAvatar,
  Button: SkeletonButton,

  // Match Cards & Scoreboards
  GameCard: GameCardSkeleton,
  GamesGrid: GamesGridSkeleton,
  GamesTicker: GamesTickerSkeleton,
  LiveTickerItem: LiveTickerItemSkeleton,
  LiveTicker: LiveTickerSkeleton,
  GameMatchup: GameMatchupSkeleton,
  BoxScore: BoxScoreSkeleton,

  // Stat Tables & Standings
  StatisticsTable: StatisticsTableSkeleton,
  StandingsTable: StandingsTableSkeleton,
  Table: TableSkeleton,
  LeaderCard: LeaderCardSkeleton,
  LeadersGrid: LeadersGridSkeleton,

  // Player Profiles & Rosters
  PlayerCard: PlayerCardSkeleton,
  PlayersGrid: PlayersGridSkeleton,
  PlayerProfile: PlayerProfileSkeleton,
  PlayerComparison: PlayerComparisonSkeleton,
  RosterTable: RosterTableSkeleton,

  // Teams, News & Visuals
  TeamCard: TeamCardSkeleton,
  TeamsGrid: TeamsGridSkeleton,
  TeamProfile: TeamProfileSkeleton,
  MyTeamsSection: MyTeamsSectionSkeleton,
  NewsCard: NewsCardSkeleton,
  ArticleModal: ArticleModalSkeleton,
  VideoCard: VideoCardSkeleton,
  ChartCard: ChartCardSkeleton,

  // Interactive controls
  SimulateLoadButton: SimulateLoadButton,
};

export default LoadingSkeleton;

