import React from 'react';
import { resolvePlayerPhoto, handlePlayerImgError, PlayerPhotoMeta } from '../utils/playerPhoto.ts';

interface PlayerAvatarProps {
  player?: PlayerPhotoMeta | null;
  alt?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'custom';
}

const sizeClasses = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
  '2xl': 'w-28 h-28',
  custom: '',
};

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  player,
  alt = 'Foto del jugador',
  className = '',
  size = 'md',
}) => {
  const photoSrc = resolvePlayerPhoto(player);
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    <img
      src={photoSrc}
      alt={alt}
      className={`rounded-full object-cover shrink-0 bg-slate-800 ${sizeClass} ${className}`}
      onError={(e) => handlePlayerImgError(e, player)}
      referrerPolicy="no-referrer"
      loading="lazy"
    />
  );
};
