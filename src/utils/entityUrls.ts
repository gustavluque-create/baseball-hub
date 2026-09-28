/**
 * Personalized URL & Slug Utilities for Teams and Players
 * 
 * Supports clean, memorable and shareable routes:
 *  - Team:   /matanzas  or  /equipos/matanzas
 *  - Player: /matanzas/jugador  or  /matanzas/erisbel-arruebarrena  or  /jugadores/erisbel-arruebarrena
 */

import { Team, Player } from '../types/index.ts';

// Canonical team ID to primary SEO slug
export const TEAM_ID_TO_SLUG: Record<string, string> = {
  mtz: 'matanzas',
  ind: 'industriales',
  ltu: 'las-tunas',
  pri: 'pinar-del-rio',
  gra: 'granma',
  scu: 'santiago-de-cuba',
  cav: 'ciego-de-avila',
  ssp: 'sancti-spiritus',
  vcl: 'villa-clara',
  cmg: 'camaguey',
  hol: 'holguin',
  cfg: 'cienfuegos',
  art: 'artemisa',
  may: 'mayabeque',
  ijv: 'isla-de-la-juventud',
  gtm: 'guantanamo',
};

// Aliases mapping back to canonical team ID
export const SLUG_TO_TEAM_ID: Record<string, string> = {
  // Direct IDs
  mtz: 'mtz',
  ind: 'ind',
  ltu: 'ltu',
  pri: 'pri',
  gra: 'gra',
  scu: 'scu',
  cav: 'cav',
  ssp: 'ssp',
  vcl: 'vcl',
  cmg: 'cmg',
  hol: 'hol',
  cfg: 'cfg',
  art: 'art',
  may: 'may',
  ijv: 'ijv',
  gtm: 'gtm',

  // Cities & Slugs
  matanzas: 'mtz',
  cocodrilos: 'mtz',
  industriales: 'ind',
  leones: 'ind',
  'la-habana': 'ind',
  habana: 'ind',
  'las-tunas': 'ltu',
  tunas: 'ltu',
  lenadores: 'ltu',
  'leñadores': 'ltu',
  'pinar-del-rio': 'pri',
  pinar: 'pri',
  vegueros: 'pri',
  granma: 'gra',
  alazanes: 'gra',
  bayamo: 'gra',
  'santiago-de-cuba': 'scu',
  santiago: 'scu',
  avispas: 'scu',
  'ciego-de-avila': 'cav',
  ciego: 'cav',
  tigres: 'cav',
  'sancti-spiritus': 'ssp',
  spiritus: 'ssp',
  gallos: 'ssp',
  'villa-clara': 'vcl',
  leopardos: 'vcl',
  'santa-clara': 'vcl',
  camaguey: 'cmg',
  'camagüey': 'cmg',
  toros: 'cmg',
  holguin: 'hol',
  'holguín': 'hol',
  cachorros: 'hol',
  cienfuegos: 'cfg',
  elefantes: 'cfg',
  artemisa: 'art',
  cazadores: 'art',
  mayabeque: 'may',
  huracanes: 'may',
  'isla-de-la-juventud': 'ijv',
  isla: 'ijv',
  piratas: 'ijv',
  guantanamo: 'gtm',
  'guantánamo': 'gtm',
  indios: 'gtm',
};

/**
 * Normalizes text into a clean URL-friendly slug
 */
export function slugify(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Resolves the canonical slug for a team
 * Example: 'mtz' or { shortName: 'MTZ', city: 'Matanzas' } -> 'matanzas'
 */
export function getTeamSlug(teamOrIdentifier: Team | string | null | undefined): string {
  if (!teamOrIdentifier) return 'equipo';

  if (typeof teamOrIdentifier === 'string') {
    const clean = slugify(teamOrIdentifier);
    if (TEAM_ID_TO_SLUG[clean]) return TEAM_ID_TO_SLUG[clean];
    if (SLUG_TO_TEAM_ID[clean]) {
      const canonicalId = SLUG_TO_TEAM_ID[clean];
      return TEAM_ID_TO_SLUG[canonicalId] || clean;
    }
    return clean;
  }

  const team = teamOrIdentifier;
  if ((team as any).slug) return slugify((team as any).slug);
  const byId = TEAM_ID_TO_SLUG[team.id.toLowerCase()];
  if (byId) return byId;
  const byShort = TEAM_ID_TO_SLUG[team.shortName.toLowerCase()];
  if (byShort) return byShort;

  if (team.city) return slugify(team.city);
  if (team.nickname) return slugify(team.nickname);
  return slugify(team.name) || team.id.toLowerCase();
}

/**
 * Resolves canonical Team ID from a slug, shortcode, or city name
 */
export function resolveTeamIdFromSlug(slugOrId: string | null | undefined): string | null {
  if (!slugOrId) return null;
  const clean = slugify(slugOrId);
  return SLUG_TO_TEAM_ID[clean] || (TEAM_ID_TO_SLUG[clean] ? clean : null);
}

/**
 * Checks if a string identifier matches a known team
 */
export function isKnownTeamIdentifier(identifier: string): boolean {
  if (!identifier) return false;
  const clean = slugify(identifier);
  return Boolean(SLUG_TO_TEAM_ID[clean] || TEAM_ID_TO_SLUG[clean]);
}

/**
 * Resolves the slug for a player
 * Example: 'p-mtz-1' or { fullName: 'Erisbel Arruebarrena', slug: 'erisbel-arruebarrena' } -> 'erisbel-arruebarrena'
 */
export function getPlayerSlug(playerOrIdentifier: Player | { id?: string; slug?: string; fullName?: string } | string | null | undefined): string {
  if (!playerOrIdentifier) return 'jugador';

  if (typeof playerOrIdentifier === 'string') {
    return slugify(playerOrIdentifier);
  }

  if (playerOrIdentifier.slug) {
    return slugify(playerOrIdentifier.slug);
  }

  if (playerOrIdentifier.fullName) {
    return slugify(playerOrIdentifier.fullName);
  }

  return slugify(playerOrIdentifier.id || 'jugador');
}

/**
 * Generates the personalized URL for a team
 * Example output: "/matanzas"
 */
export function getTeamCustomUrl(teamOrIdentifier: Team | string): string {
  const slug = getTeamSlug(teamOrIdentifier);
  return `/${slug}`;
}

/**
 * Generates the personalized URL for a player within their team
 * Example output: "/matanzas/erisbel-arruebarrena"
 */
export function getPlayerCustomUrl(
  player: Player | { id?: string; slug?: string; fullName?: string; teamId?: string; teamShort?: string },
  teamContext?: Team | string | null
): string {
  let teamSlug = 'equipo';

  if (teamContext) {
    teamSlug = getTeamSlug(teamContext);
  } else if ('teamShort' in player && player.teamShort) {
    teamSlug = getTeamSlug(player.teamShort);
  } else if ('teamId' in player && player.teamId) {
    teamSlug = getTeamSlug(player.teamId);
  } else if (player.id && player.id.startsWith('p-')) {
    // Extract team short code from id e.g. "p-mtz-1" -> "mtz"
    const parts = player.id.split('-');
    if (parts.length >= 2 && TEAM_ID_TO_SLUG[parts[1]]) {
      teamSlug = TEAM_ID_TO_SLUG[parts[1]];
    }
  }

  const playerSlug = getPlayerSlug(player);
  return `/${teamSlug}/${playerSlug}`;
}

/**
 * Returns full URL including window.location.origin
 */
export function getFullCustomUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${cleanPath}`;
  }
  return cleanPath;
}

/**
 * Copies a link or path to clipboard with safe fallback
 */
export async function copyCustomUrlToClipboard(pathOrUrl: string): Promise<boolean> {
  const fullUrl = pathOrUrl.startsWith('http') ? pathOrUrl : getFullCustomUrl(pathOrUrl);
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(fullUrl);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard API error, falling back:', err);
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = fullUrl;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (e) {
    console.error('Fallback clipboard copy failed:', e);
    return false;
  }
}

/**
 * Known core system paths that shouldn't be confused with teams or articles
 */
export const SYSTEM_NAV_PATHS = new Set([
  'admin',
  'api',
  'assets',
  'home',
  'games',
  'partidos',
  'standings',
  'posiciones',
  'statistics',
  'estadisticas',
  'leaders',
  'lideres',
  'teams',
  'equipos',
  'players',
  'jugadores',
  'news',
  'noticias',
  'videos',
  'settings',
]);

export interface CustomRouteMatch {
  type: 'team' | 'player' | 'article' | 'tab' | 'home';
  teamId?: string;
  teamSlug?: string;
  playerId?: string;
  playerSlug?: string;
  articleSlug?: string;
  tab?: string;
}

/**
 * Parses pathname and hash into a high-level entity route
 */
export function parseCustomRoute(pathname: string, hash: string = ''): CustomRouteMatch {
  const raw = (pathname && pathname !== '/' ? pathname : hash.replace(/^#\/?/, '')) || '';
  const clean = raw.replace(/^\/+|\/+$/g, '').trim();

  if (!clean) {
    return { type: 'home' };
  }

  const segments = clean.split('/').map(decodeURIComponent).filter(Boolean);

  // 1. Explicit admin route
  if (segments[0] === 'admin') {
    return { type: 'tab', tab: 'admin' };
  }

  // 2. Explicit /equipos/:teamSlug or /equipo/:teamSlug
  if ((segments[0] === 'equipos' || segments[0] === 'equipo') && segments[1]) {
    const teamSlug = segments[1];
    const teamId = resolveTeamIdFromSlug(teamSlug) || teamSlug;
    if (segments[2]) {
      // /equipos/:teamSlug/:playerSlug
      return {
        type: 'player',
        teamId,
        teamSlug,
        playerSlug: segments[2],
        playerId: segments[2],
      };
    }
    return {
      type: 'team',
      teamId,
      teamSlug,
    };
  }

  // 3. Explicit /jugadores/:playerSlug or /jugador/:playerSlug
  if ((segments[0] === 'jugadores' || segments[0] === 'jugador') && segments[1]) {
    return {
      type: 'player',
      playerSlug: segments[1],
      playerId: segments[1],
    };
  }

  // 4. Explicit /noticias/:slug or /articulo/:slug or /news/:slug
  if (['noticias', 'articulo', 'news'].includes(segments[0]) && segments[1]) {
    return {
      type: 'article',
      articleSlug: segments[1],
    };
  }

  // 5. Two segments: /:teamSlug/:playerSlug (e.g. /matanzas/jugador, /matanzas/erisbel-arruebarrena)
  if (segments.length === 2 && !SYSTEM_NAV_PATHS.has(segments[0])) {
    const potentialTeamSlug = segments[0];
    const potentialPlayerSlug = segments[1];
    const teamId = resolveTeamIdFromSlug(potentialTeamSlug) || potentialTeamSlug;

    return {
      type: 'player',
      teamId,
      teamSlug: potentialTeamSlug,
      playerSlug: potentialPlayerSlug,
      playerId: potentialPlayerSlug,
    };
  }

  // 6. Single segment check
  if (segments.length === 1) {
    const seg = segments[0];

    // Check if it's a known team (e.g. /matanzas, /industriales, /las-tunas, /mtz)
    if (isKnownTeamIdentifier(seg)) {
      const teamId = resolveTeamIdFromSlug(seg) || seg;
      return {
        type: 'team',
        teamId,
        teamSlug: seg,
      };
    }

    // Check if it's a standard nav tab
    const lower = seg.toLowerCase();
    if (lower === 'noticias') return { type: 'tab', tab: 'news' };
    if (lower === 'partidos') return { type: 'tab', tab: 'games' };
    if (lower === 'posiciones') return { type: 'tab', tab: 'standings' };
    if (lower === 'estadisticas') return { type: 'tab', tab: 'statistics' };
    if (lower === 'lideres') return { type: 'tab', tab: 'leaders' };
    if (lower === 'equipos') return { type: 'tab', tab: 'teams' };
    if (lower === 'jugadores') return { type: 'tab', tab: 'players' };
    if (SYSTEM_NAV_PATHS.has(lower)) {
      return { type: 'tab', tab: lower };
    }

    // Otherwise, treat as an article slug if valid
    return {
      type: 'article',
      articleSlug: seg,
    };
  }

  return { type: 'home' };
}
