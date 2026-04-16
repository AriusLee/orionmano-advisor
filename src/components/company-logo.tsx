'use client';

import { useState, useMemo } from 'react';
import { uploadUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CompanyLogoProps {
  name: string;
  logoUrl?: string | null;
  /** Visual size. Defaults to md (36px). */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: { box: 'h-7 w-7 rounded-md',  text: 'text-[10px]' },
  md: { box: 'h-9 w-9 rounded-lg',  text: 'text-[11px]' },
  lg: { box: 'h-12 w-12 rounded-xl', text: 'text-sm' },
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '—';
}

export function CompanyLogo({ name, logoUrl, size = 'md', className }: CompanyLogoProps) {
  const [errored, setErrored] = useState(false);
  const src = useMemo(() => uploadUrl(logoUrl), [logoUrl]);
  const classes = SIZE_CLASSES[size];
  const showImage = !!src && !errored;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden',
        classes.box,
        showImage
          ? 'bg-transparent'
          : 'bg-primary/10 ring-1 ring-inset ring-primary/20',
        className,
      )}
    >
      {showImage ? (
        // Using <img> over next/image so onError fallback is trivial and we
        // don't need to whitelist arbitrary third-party domains from logo APIs.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${name} logo`}
          className="h-full w-full object-contain"
          onError={() => setErrored(true)}
          loading="lazy"
        />
      ) : (
        <span className={cn('font-mono font-semibold text-primary', classes.text)}>
          {initialsOf(name)}
        </span>
      )}
    </div>
  );
}
