import type { HTMLAttributes } from 'react';

import { cn } from '@/app/lib/cn';

interface AvatarSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  src: string;
  alt: string;
  sizeClassName?: string;
  imageClassName?: string;
  halo?: boolean;
}

export function AvatarSurface({
  src,
  alt,
  sizeClassName = 'h-16 w-16',
  imageClassName,
  halo = false,
  className,
  ...props
}: AvatarSurfaceProps) {
  return (
    <div className={cn('relative shrink-0', className)} {...props}>
      {halo ? (
        <div className="absolute inset-[-10px] rounded-full bg-[radial-gradient(circle,rgba(168,140,93,0.2),transparent_65%)]" />
      ) : null}
      <div
        className={cn(
          'relative overflow-hidden rounded-full border border-[var(--lobster-gold-border)] bg-[var(--lobster-card-elevated)] shadow-[var(--lobster-shadow-avatar)]',
          sizeClassName,
        )}
      >
        <img src={src} alt={alt} className={cn('h-full w-full object-cover', imageClassName)} />
      </div>
    </div>
  );
}
