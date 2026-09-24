export const INDUSTRIALES_DEFAULT_PHOTO = '/images/industriales-player-default.svg';
export const INDUSTRIALES_DEFAULT_PHOTO_PNG = '/player-industriales.png';
export const GENERIC_DEFAULT_PHOTO = 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=256';

export interface PlayerPhotoMeta {
  photo?: string | null;
  teamId?: string | null;
  teamShort?: string | null;
  teamName?: string | null;
}

/**
 * Checks whether a given player or team metadata belongs to Industriales
 */
export function isIndustrialesTeam(
  teamId?: string | null,
  teamShort?: string | null,
  teamName?: string | null
): boolean {
  if (!teamId && !teamShort && !teamName) return false;
  const tid = (teamId || '').trim().toLowerCase();
  const tshort = (teamShort || '').trim().toLowerCase();
  const tname = (teamName || '').trim().toLowerCase();

  return (
    tid === 'ind' ||
    tshort === 'ind' ||
    tname.includes('industriales') ||
    tname.includes('leones de industriales')
  );
}

/**
 * Returns true if the player has an explicit custom personalized photo
 * (not empty, not generic placeholder, and not the default Industriales graphic)
 */
export function hasCustomPhoto(photo?: string | null): boolean {
  if (!photo || !photo.trim()) return false;
  const p = photo.trim();
  if (
    p === INDUSTRIALES_DEFAULT_PHOTO ||
    p === INDUSTRIALES_DEFAULT_PHOTO_PNG ||
    p === '/player industriales.png' ||
    p === 'player industriales.png' ||
    p.includes('industriales-player-default') ||
    p.includes('player-industriales')
  ) {
    return false;
  }
  return true;
}

/**
 * Resolves the player photo with the specific rule:
 * If an Industriales player has not been given a personalized photo,
 * use the Industriales default avatar image.
 */
export function resolvePlayerPhoto(player?: PlayerPhotoMeta | null): string {
  if (!player) return GENERIC_DEFAULT_PHOTO;

  const isInd = isIndustrialesTeam(player.teamId, player.teamShort, player.teamName);

  // If photo is present and non-empty
  if (player.photo && typeof player.photo === 'string' && player.photo.trim() !== '') {
    const trimmed = player.photo.trim();
    // Normalize any legacy relative references
    if (
      trimmed === 'player industriales.png' ||
      trimmed === '/player industriales.png' ||
      trimmed === '/images/industriales-player-default.png'
    ) {
      return INDUSTRIALES_DEFAULT_PHOTO;
    }
    return trimmed;
  }

  // If Industriales player and no custom photo has been set
  if (isInd) {
    return INDUSTRIALES_DEFAULT_PHOTO;
  }

  return GENERIC_DEFAULT_PHOTO;
}

/**
 * Image onError handler to ensure smooth fallback
 */
export function handlePlayerImgError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  player?: PlayerPhotoMeta | null
) {
  const img = e.currentTarget;
  const isInd = player ? isIndustrialesTeam(player.teamId, player.teamShort, player.teamName) : false;

  if (isInd) {
    if (img.src.includes(INDUSTRIALES_DEFAULT_PHOTO)) {
      img.src = INDUSTRIALES_DEFAULT_PHOTO_PNG;
    } else if (!img.src.includes(INDUSTRIALES_DEFAULT_PHOTO_PNG)) {
      img.src = INDUSTRIALES_DEFAULT_PHOTO;
    }
  } else {
    img.src = GENERIC_DEFAULT_PHOTO;
  }
}
