import React, { useState, useEffect } from 'react';

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
    trimmed.startsWith('data:image%2F') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    /\.(svg|png|jpg|jpeg|webp|gif|bmp|avif)(\?.*)?$/i.test(trimmed)
  );
};

export const TeamLogo: React.FC<TeamLogoProps> = ({
  logo,
  name = 'Equipo',
  className = '',
  size = 'md',
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [logo]);

  if (!logo) {
    return <span className={`select-none leading-none inline-flex items-center justify-center ${className}`}>⚾</span>;
  }

  const isImg = isImageLogo(logo);

  if (isImg && !hasError) {
    return (
      <img
        src={logo}
        alt={`Logo ${name}`}
        onError={() => setHasError(true)}
        className={`w-full h-full object-contain select-none rounded-md ${className}`}
        referrerPolicy="no-referrer"
        loading="lazy"
      />
    );
  }

  // Safety: If it's a long string (e.g. data URI or URL that failed to load or wasn't caught),
  // NEVER render raw base64 or long URLs into the DOM text!
  const isSafeShortText = logo.trim().length <= 6 && !logo.includes('/') && !logo.includes(':') && !logo.includes(';');
  const displayContent = (!hasError && isSafeShortText) ? logo.trim() : '⚾';

  return (
    <span
      className={`select-none leading-none inline-flex items-center justify-center font-normal ${className}`}
      title={name}
    >
      {displayContent}
    </span>
  );
};
