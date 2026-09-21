export interface SeasonOption {
  id: string;
  shortLabel: string;
  fullLabel: string;
  badgeLabel: string;
  year: number;
  isCurrent?: boolean;
}

export const AVAILABLE_SEASONS: SeasonOption[] = [
  {
    id: 'snb-65',
    shortLabel: '65 SNB (26-27)',
    fullLabel: '65 Serie Nacional (2026-2027) Actual',
    badgeLabel: '65 Serie Nacional (2026-2027) • Actual',
    year: 2027,
    isCurrent: true,
  },
  {
    id: 'snb-64',
    shortLabel: '64 SNB (25-26)',
    fullLabel: '64 Serie Nacional (2025-2026)',
    badgeLabel: '64 Serie Nacional (2025-2026)',
    year: 2026,
    isCurrent: false,
  },
  {
    id: 'snb-56',
    shortLabel: '56 SNB (16-17)',
    fullLabel: '56 Serie Nacional (2016-2017) Histórica',
    badgeLabel: '56 Serie Nacional (2016-2017) • Histórica',
    year: 2017,
    isCurrent: false,
  },
];

export function getSeasonBadgeLabel(seasonId: string): string {
  const match = AVAILABLE_SEASONS.find((s) => s.id === seasonId);
  if (match) return match.badgeLabel;

  if (seasonId.includes('65') || seasonId === '2027') return '65 Serie Nacional (2026-2027) • Actual';
  if (seasonId.includes('64') || seasonId === '2026') return '64 Serie Nacional (2025-2026)';
  if (seasonId.includes('56') || seasonId === '2017') return '56 Serie Nacional (2016-2017) • Histórica';

  return seasonId;
}

export function getSeasonFullLabel(seasonId: string): string {
  const match = AVAILABLE_SEASONS.find((s) => s.id === seasonId);
  return match ? match.fullLabel : seasonId;
}
