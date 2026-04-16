'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, Check, Globe, Image as ImageIcon } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CompanyLogo } from '@/components/company-logo';

interface CompanyShape {
  id: string;
  name: string;
  website: string | null;
  logo_url?: string | null;
}

interface Props {
  companyId: string;
  initialName: string;
  hadWebsite: boolean;
  onComplete: () => void;
}

type StepState = 'pending' | 'running' | 'done';

const HALO_GRADIENT =
  'radial-gradient(circle at center, color-mix(in oklch, var(--primary) 22%, transparent), transparent 65%)';

const RING_GRADIENT =
  'conic-gradient(from 0deg, color-mix(in oklch, var(--primary) 65%, transparent), transparent 25%, color-mix(in oklch, var(--primary) 85%, transparent) 50%, transparent 75%, color-mix(in oklch, var(--primary) 65%, transparent))';

const TIMEOUT_MS = 12_000;
const POLL_MS = 800;
const EXIT_DELAY_MS = 650;

export function CompanyCreationOverlay({
  companyId,
  initialName,
  hadWebsite,
  onComplete,
}: Props) {
  const [company, setCompany] = useState<CompanyShape | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const c = await apiJson<CompanyShape>(`/companies/${companyId}`);
        if (!cancelled) setCompany(c);
      } catch {
        /* ignore transient errors */
      }
    };
    tick();
    const poll = setInterval(tick, POLL_MS);
    const clock = setInterval(() => setElapsed((t) => t + 100), 100);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [companyId]);

  const hasWebsiteNow = !!company?.website;
  const hasLogo = !!company?.logo_url;

  const steps: Array<{
    id: string;
    label: string;
    icon: typeof Sparkles;
    state: StepState;
  }> = [
    {
      id: 'create',
      label: 'Company profile created',
      icon: Sparkles,
      state: 'done',
    },
    ...(!hadWebsite
      ? [
          {
            id: 'website',
            label: hasWebsiteNow ? `Found ${company?.website}` : 'Looking up website',
            icon: Globe,
            state: (hasWebsiteNow ? 'done' : 'running') as StepState,
          },
        ]
      : []),
    {
      id: 'logo',
      label: hasLogo ? 'Logo acquired' : 'Fetching company logo',
      icon: ImageIcon,
      state: (hasLogo
        ? 'done'
        : hadWebsite || hasWebsiteNow
          ? 'running'
          : 'pending') as StepState,
    },
  ];

  const allDone = steps.every((s) => s.state === 'done');
  const timedOut = elapsed >= TIMEOUT_MS;

  useEffect(() => {
    if (!allDone && !timedOut) return;
    const t = setTimeout(onComplete, EXIT_DELAY_MS);
    return () => clearTimeout(t);
  }, [allDone, timedOut, onComplete]);

  return (
    <div className="animate-fade-in fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-background/95 backdrop-blur-xl">
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
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 animate-halo blur-3xl"
        style={{ background: HALO_GRADIENT }}
      />

      <div className="relative flex flex-col items-center px-6">
        {/* Floating logo block with rotating conic ring */}
        <div className="relative mb-9 animate-float">
          <div
            aria-hidden
            className="absolute -inset-2 animate-spin-slow rounded-[28px] opacity-70 blur-[1px]"
            style={{ background: RING_GRADIENT }}
          />
          <div
            aria-hidden
            className="absolute -inset-2 m-[2px] rounded-[28px] bg-background/80"
          />
          <div className="relative">
            <CompanyLogo name={initialName} logoUrl={company?.logo_url} size="lg" />
          </div>
        </div>

        {/* Tagline */}
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-primary/70" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-primary/80">
            Setting Up
          </p>
          <Sparkles className="h-3 w-3 text-primary/70" />
        </div>

        <h2 className="mb-1 text-center text-2xl font-semibold tracking-tight">
          {initialName}
        </h2>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          AI is preparing your engagement workspace
        </p>

        {/* Step list */}
        <ul className="w-[22rem] max-w-full space-y-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li
                key={s.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                  s.state === 'done'
                    ? 'border-primary/25 bg-primary/5'
                    : s.state === 'running'
                      ? 'border-border/60 bg-muted/20'
                      : 'border-border/30 bg-muted/10 opacity-60',
                )}
                style={{
                  animation: 'om-fade-up 400ms cubic-bezier(0.22,1,0.36,1) both',
                  animationDelay: `${120 + i * 90}ms`,
                }}
              >
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
                    s.state === 'done'
                      ? 'bg-primary/15 ring-primary/30'
                      : 'bg-muted/40 ring-border/40',
                  )}
                >
                  {s.state === 'done' ? (
                    <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} />
                  ) : s.state === 'running' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  ) : (
                    <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                  )}
                </div>
                <span
                  className={cn(
                    'flex-1 truncate text-sm',
                    s.state === 'done' ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {s.label}
                </span>
                {s.state === 'done' && (
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-primary/80">
                    Done
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-7 text-[11px] text-muted-foreground/60">
          {timedOut && !allDone
            ? 'Taking longer than expected — opening workspace anyway'
            : allDone
              ? 'Opening engagement workspace…'
              : 'This usually takes a few seconds'}
        </p>
      </div>
    </div>
  );
}
