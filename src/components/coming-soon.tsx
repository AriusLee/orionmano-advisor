'use client';

import type { LucideIcon } from 'lucide-react';
import { Sparkles } from 'lucide-react';

interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  tagline?: string;
  description?: string;
  features?: string[];
  status?: string;
}

const HALO_GRADIENT =
  'radial-gradient(circle at center, color-mix(in oklch, var(--primary) 22%, transparent), transparent 65%)';

const RING_GRADIENT =
  'conic-gradient(from 0deg, color-mix(in oklch, var(--primary) 65%, transparent), transparent 25%, color-mix(in oklch, var(--primary) 85%, transparent) 50%, transparent 75%, color-mix(in oklch, var(--primary) 65%, transparent))';

const ICON_INNER_GRADIENT =
  'radial-gradient(circle at 30% 20%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 65%)';

export function ComingSoon({
  icon: Icon,
  title,
  tagline = 'Coming Soon',
  description,
  features,
  status = 'In active development',
}: ComingSoonProps) {
  return (
    <div className="relative flex min-h-[65vh] flex-col items-center justify-center overflow-hidden py-16">
      {/* Drifting grid — adds subtle kinetic texture without pulling focus */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-grid-drift opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 35%, transparent 75%)',
        }}
      />

      {/* Pulsing cyan halo behind the icon */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[40%] left-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 animate-halo blur-2xl"
        style={{ background: HALO_GRADIENT }}
      />

      {/* Icon block — floats while a conic ring spins behind it */}
      <div className="relative mb-9 animate-float">
        <div
          aria-hidden
          className="absolute -inset-2 rounded-[32px] animate-spin-slow opacity-70 blur-[1px]"
          style={{ background: RING_GRADIENT }}
        />
        <div
          aria-hidden
          className="absolute -inset-2 rounded-[32px] bg-background/80 m-[2px]"
        />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-card ring-1 ring-foreground/15 shadow-[0_24px_60px_-24px_oklch(0_0_0/0.85),inset_0_1px_0_oklch(1_0_0/0.06)]">
          <div
            aria-hidden
            className="absolute inset-0 rounded-3xl"
            style={{ background: ICON_INNER_GRADIENT }}
          />
          <Icon className="relative h-9 w-9 text-primary" strokeWidth={1.5} />
        </div>
      </div>

      {/* Tagline */}
      <div className="relative mb-3 flex items-center gap-2">
        <Sparkles className="h-3 w-3 text-primary/70" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-primary/80">
          {tagline}
        </p>
        <Sparkles className="h-3 w-3 text-primary/70" />
      </div>

      {/* Title */}
      <h2 className="relative mb-3 text-center text-3xl font-semibold tracking-tight leading-tight">
        {title}
      </h2>

      {/* Description */}
      {description && (
        <p className="relative max-w-md text-center text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}

      {/* Feature list */}
      {features && features.length > 0 && (
        <ul className="relative mt-8 grid w-full max-w-md gap-2 text-[12px] text-muted-foreground">
          {features.map((f, i) => (
            <li
              key={f}
              className="flex items-start gap-2.5 rounded-md border border-border/40 bg-muted/20 px-3 py-2 transition-colors hover:border-border/70 hover:bg-muted/35"
              style={{ animation: `om-fade-up 500ms cubic-bezier(0.22,1,0.36,1) both`, animationDelay: `${200 + i * 80}ms` }}
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
              <span className="leading-relaxed">{f}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Live-status chip */}
      <div className="relative mt-9 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/25 px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        {status}
      </div>
    </div>
  );
}
