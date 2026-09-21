import React, { useState } from 'react';

interface TeamLogoProps {
  logo?: string;
  name?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const isImageLogo = (logo?: string): boolean => {
  if (!logo) return false;
  const trimmed = logo.trim();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/') ||
    /\.(svg|png|jpg|jpeg|webp|gif|bmp)(\?.*)?$/i.test(trimmed)
  );
};

export const TeamLogo: React.FC<TeamLogoProps> = ({
  logo,
  name = 'Equipo',
  className = '',
  size = 'md',
}) => {
  const [hasError, setHasError] = useState(false);

  if (!logo) {
    return <span className={`select-none leading-none ${className}`}>⚾</span>;
  }

  const isImg = isImageLogo(logo);

  if (isImg && !hasError) {
    return (
      <img
        src={logo}
        alt={`Logo ${name}`}
        onError={() => setHasError(true)}
        className={`w-full h-full object-contain select-none rounded-lg ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // If it had an error or is an emoji/text character
  const displayContent = hasError ? '⚾' : logo;

  return (
    <span
      className={`select-none leading-none inline-flex items-center justify-center font-normal ${className}`}
      title={name}
    >
      {displayContent}
    </span>
  );
};
