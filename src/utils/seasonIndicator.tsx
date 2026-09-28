import React from 'react';

export type SeasonCategory = 'current' | 'recent' | 'historical' | 'elite' | 'playoff' | 'custom';

export interface SeasonBadgeInfo {
  edition: string; // e.g. "65 SNB", "64 SNB", "56 SNB", "3ra LEBC"
  fullTitle: string; // e.g. "65 Serie Nacional (2026-2027)"
  yearSpan: string; // e.g. "2026-27", "2025-26", "2016-17"
  statusTag: string; // e.g. "En Curso", "Anterior", "Histórica", "Liga Élite"
  category: SeasonCategory;
  isCurrent: boolean;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
  iconName: 'flame' | 'history' | 'calendar' | 'sparkles' | 'trophy';
}

/**
 * Resolves comprehensive metadata and visual styles for differentiating seasons in historical statistics
 */
export function getSeasonInfo(stat: {
  seasonYear?: number | string;
  seasonId?: string;
  id?: string;
  seasonName?: string;
  competitionId?: string;
}): SeasonBadgeInfo {
  const rawId = (stat.id || '').toLowerCase();
  const rawSeasonId = (stat.seasonId || '').toLowerCase().trim();
  const rawName = (stat.seasonName || '').toLowerCase().trim();
  const numYear = Number(stat.seasonYear) || (rawSeasonId ? Number(rawSeasonId.replace(/\D/g, '')) : 0);

  // 1. Check for Liga Élite / LEBC
  if (
    rawSeasonId.includes('lebc') ||
    rawSeasonId.includes('elite') ||
    rawName.includes('élite') ||
    rawName.includes('elite') ||
    stat.competitionId === 'lebc'
  ) {
    const eliteNum = rawSeasonId.includes('2') || rawName.includes('2da') ? '2da' : '3ra';
    return {
      edition: `${eliteNum} LEBC`,
      fullTitle: `${eliteNum} Liga Élite del Béisbol Cubano (${numYear || 2026})`,
      yearSpan: numYear ? String(numYear) : '2026',
      statusTag: 'Liga Élite',
      category: 'elite',
      isCurrent: false,
      bgClass: 'bg-purple-950/60',
      textClass: 'text-purple-300',
      borderClass: 'border-purple-500/40',
      dotClass: 'bg-purple-400',
      iconName: 'sparkles',
    };
  }

  // 2. Check for 64 Serie Nacional (Season 2025-2026 / Anterior)
  const is64 =
    rawSeasonId === 'snb-64' ||
    rawSeasonId.includes('64') ||
    rawId.includes('-64-') ||
    rawName.includes('64');

  if (is64) {
    return {
      edition: '64 SNB',
      fullTitle: '64 Serie Nacional de Béisbol (2025-2026)',
      yearSpan: '2025-26',
      statusTag: 'Temporada Anterior',
      category: 'recent',
      isCurrent: false,
      bgClass: 'bg-blue-950/60',
      textClass: 'text-blue-300',
      borderClass: 'border-blue-500/40',
      dotClass: 'bg-blue-400',
      iconName: 'history',
    };
  }

  // 3. Check for 56 Serie Nacional (Classic Record Season 2016-2017)
  const is56 =
    rawSeasonId === 'snb-56' ||
    rawSeasonId.includes('56') ||
    rawId.includes('-56-') ||
    numYear === 2017 ||
    rawName.includes('56');

  if (is56) {
    return {
      edition: '56 SNB',
      fullTitle: '56 Serie Nacional de Béisbol (2016-2017)',
      yearSpan: '2016-17',
      statusTag: 'Temporada Récord / Histórica',
      category: 'historical',
      isCurrent: false,
      bgClass: 'bg-amber-950/60',
      textClass: 'text-amber-300',
      borderClass: 'border-amber-500/40',
      dotClass: 'bg-amber-400',
      iconName: 'trophy',
    };
  }

  // 4. Check for 65 Serie Nacional (Current Active Season 2026-2027)
  const is65 =
    rawSeasonId === 'snb-65' ||
    rawSeasonId.includes('65') ||
    rawName.includes('65') ||
    numYear === 2027 ||
    (!is64 && !is56 && (numYear === 2026 || numYear === 2027) && !rawId.includes('-64-') && !rawId.includes('-56-'));

  if (is65) {
    return {
      edition: '65 SNB',
      fullTitle: '65 Serie Nacional de Béisbol (2026-2027)',
      yearSpan: '2026-27',
      statusTag: 'Temporada Actual (En Curso)',
      category: 'current',
      isCurrent: true,
      bgClass: 'bg-emerald-950/70',
      textClass: 'text-emerald-300',
      borderClass: 'border-emerald-500/50',
      dotClass: 'bg-emerald-400',
      iconName: 'flame',
    };
  }

  // 5. Arbitrary SNB Number pattern (e.g. snb-63, snb-62, snb-60, etc.)
  const snbMatch = rawSeasonId.match(/snb-(\d+)/) || rawName.match(/(\d+)\s*(?:serie|snb)/);
  if (snbMatch && snbMatch[1]) {
    const edNum = snbMatch[1];
    const inferredYear = numYear || (1961 + Number(edNum));
    return {
      edition: `${edNum} SNB`,
      fullTitle: `${edNum} Serie Nacional de Béisbol (${inferredYear})`,
      yearSpan: String(inferredYear),
      statusTag: 'Histórica SNB',
      category: 'historical',
      isCurrent: false,
      bgClass: 'bg-slate-900',
      textClass: 'text-amber-300',
      borderClass: 'border-amber-500/30',
      dotClass: 'bg-amber-400',
      iconName: 'calendar',
    };
  }

  // 6. Generic Year fallback
  if (numYear > 1950) {
    // Inferred SNB edition (1st edition was 1961-1962)
    const approxEd = Math.max(1, numYear - 1961);
    return {
      edition: `${approxEd} SNB`,
      fullTitle: `Serie Nacional ${numYear}`,
      yearSpan: String(numYear),
      statusTag: 'Histórica',
      category: 'historical',
      isCurrent: false,
      bgClass: 'bg-slate-900',
      textClass: 'text-slate-200',
      borderClass: 'border-slate-700',
      dotClass: 'bg-slate-400',
      iconName: 'calendar',
    };
  }

  // 7. Generic Fallback
  return {
    edition: stat.seasonId || String(stat.seasonYear) || 'SNB',
    fullTitle: `Temporada ${stat.seasonId || stat.seasonYear || ''}`,
    yearSpan: String(stat.seasonYear || ''),
    statusTag: 'Registro Oficial',
    category: 'custom',
    isCurrent: false,
    bgClass: 'bg-slate-900',
    textClass: 'text-slate-300',
    borderClass: 'border-slate-800',
    dotClass: 'bg-slate-500',
    iconName: 'calendar',
  };
}

interface SeasonBadgeProps {
  stat: {
    seasonYear?: number | string;
    seasonId?: string;
    id?: string;
    seasonName?: string;
    competitionId?: string;
  };
  showStatusTag?: boolean;
  showYearSpan?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

/**
 * Visual badge and chip to immediately differentiate seasons in tables, charts and administration views
 */
export const SeasonBadge: React.FC<SeasonBadgeProps> = ({
  stat,
  showStatusTag = true,
  showYearSpan = true,
  size = 'sm',
  className = '',
}) => {
  const info = getSeasonInfo(stat);

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-1',
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-2',
  }[size];

  return (
    <div
      className={`inline-flex items-center rounded-lg border font-mono font-bold shadow-sm transition-all select-none ${info.bgClass} ${info.textClass} ${info.borderClass} ${sizeClasses} ${className}`}
      title={info.fullTitle}
    >
      {/* Indicator Dot (Pulse for Current Season) */}
      <span className="relative flex h-2 w-2 shrink-0">
        {info.isCurrent && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${info.dotClass}`} />
      </span>

      {/* Season Edition Text */}
      <span className="font-sans font-black tracking-tight">{info.edition}</span>

      {/* Year Span in subtle font */}
      {showYearSpan && info.yearSpan && (
        <span className="text-[10px] opacity-75 font-mono">({info.yearSpan})</span>
      )}

      {/* Optional Status Tag Chip */}
      {showStatusTag && (
        <span
          className={`text-[9px] font-sans font-bold px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0 ${
            info.isCurrent
              ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
              : info.category === 'recent'
              ? 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
              : info.category === 'historical'
              ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
              : 'bg-slate-800 text-slate-300 border border-slate-700'
          }`}
        >
          {info.statusTag}
        </span>
      )}
    </div>
  );
};
