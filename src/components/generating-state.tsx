'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeneratingStateProps {
  icon: LucideIcon;
  title: string;
  /** The backend-reported progress line, e.g. "Pass 2/2: Batch 3/8 — Entity Structure [R1]". */
  progressMessage?: string | null;
  /** ISO timestamp the report was created. Used to show elapsed time. */
  startedAt?: string | null;
  /** Number of sections written so far (optional — shown when available). */
  sectionsGenerated?: number;
}

const HALO_GRADIENT =
  'radial-gradient(circle at center, color-mix(in oklch, var(--primary) 22%, transparent), transparent 65%)';

const RING_GRADIENT =
  'conic-gradient(from 0deg, color-mix(in oklch, var(--primary) 65%, transparent), transparent 25%, color-mix(in oklch, var(--primary) 85%, transparent) 50%, transparent 75%, color-mix(in oklch, var(--primary) 65%, transparent))';

const ICON_INNER_GRADIENT =
  'radial-gradient(circle at 30% 20%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 65%)';

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function GeneratingState({
  icon: Icon,
  title,
  progressMessage,
  startedAt,
  sectionsGenerated,
}: GeneratingStateProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const elapsed = startedAt ? now - new Date(startedAt).getTime() : null;

  return (
    <div className="relative flex min-h-[65vh] flex-col items-center justify-center overflow-hidden py-12">
      {/* Drifting grid */}
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

      {/* Pulsing halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[36%] left-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 animate-halo blur-2xl"
        style={{ background: HALO_GRADIENT }}
      />

      {/* Icon with rotating ring */}
      <div className="relative mb-8 animate-float">
        <div
          aria-hidden
          className="absolute -inset-2 rounded-[32px] animate-spin-slow opacity-90 blur-[1px]"
          style={{ background: RING_GRADIENT }}
        />
        <div aria-hidden className="absolute -inset-2 rounded-[32px] bg-background/80 m-[2px]" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-card ring-1 ring-foreground/15 shadow-[0_24px_60px_-24px_oklch(0_0_0/0.85),inset_0_1px_0_oklch(1_0_0/0.06)]">
          <div
            aria-hidden
            className="absolute inset-0 rounded-3xl"
            style={{ background: ICON_INNER_GRADIENT }}
          />
          <Icon className="relative h-8 w-8 text-primary" strokeWidth={1.5} />
          {/* Orbiting sparkle */}
          <Sparkles
            aria-hidden
            className="absolute -top-1 -right-1 h-3.5 w-3.5 text-primary animate-pulse"
            strokeWidth={2}
          />
        </div>
      </div>

      <h2 className="relative mb-3 text-center text-3xl font-semibold tracking-tight leading-tight">
        Generating {title}
      </h2>

      <p className="relative mb-7 max-w-md text-center text-sm leading-relaxed text-muted-foreground">
        Analyzing uploaded documents and drafting each section with the DeepSeek reasoning model. This usually takes 2–4 minutes.
      </p>

      {/* Progress card */}
      <div className="relative w-full max-w-md">
        <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" strokeWidth={2.25} />
            <p className="flex-1 min-w-0 text-[13px] font-medium text-foreground truncate">
              {progressMessage || 'Preparing generation pipeline…'}
            </p>
          </div>

          {/* Indeterminate shimmer bar */}
          <div className="relative h-1.5 overflow-hidden rounded-full bg-muted/40">
            <div
              className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent animate-shimmer-x"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-mono tabular-nums">
              {typeof sectionsGenerated === 'number' && sectionsGenerated > 0
                ? `${sectionsGenerated} section${sectionsGenerated === 1 ? '' : 's'} drafted`
                : 'Warming up…'}
            </span>
            {elapsed !== null && (
              <span className="font-mono tabular-nums text-muted-foreground/70">
                {formatElapsed(elapsed)} elapsed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status chip */}
      <div
        className={cn(
          'relative mt-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] transition-colors',
          'border-primary/30 bg-primary/10 text-primary',
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        Generation in progress — safe to navigate away
      </div>
    </div>
  );
}
