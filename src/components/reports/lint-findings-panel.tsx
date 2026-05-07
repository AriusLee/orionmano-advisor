'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LintFinding {
  severity?: 'critical' | 'high' | 'medium' | 'low' | string;
  kind?: string;
  section_a?: string;
  section_b?: string;
  claim_a?: string;
  claim_b?: string;
  issue?: string;
  suggested_fix?: string;
}

const SEVERITY_STYLE: Record<string, { dot: string; ring: string; tag: string; label: string }> = {
  critical: { dot: 'bg-red-500',    ring: 'ring-red-500/30',    tag: 'bg-red-500/15 text-red-400',       label: 'Critical' },
  high:     { dot: 'bg-orange-500', ring: 'ring-orange-500/30', tag: 'bg-orange-500/15 text-orange-400', label: 'High' },
  medium:   { dot: 'bg-amber-400',  ring: 'ring-amber-400/30',  tag: 'bg-amber-400/15 text-amber-400',   label: 'Medium' },
  low:      { dot: 'bg-sky-400',    ring: 'ring-sky-400/30',    tag: 'bg-sky-400/15 text-sky-400',       label: 'Low' },
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

function styleFor(sev: string | undefined) {
  return SEVERITY_STYLE[sev ?? 'low'] ?? SEVERITY_STYLE.low;
}

export function LintFindingsPanel({ findings }: { findings: LintFinding[] | null | undefined }) {
  const [open, setOpen] = useState(false);

  if (!findings || findings.length === 0) return null;

  // Sort by severity then kind so the worst issues surface first
  const sorted = [...findings].sort((a, b) => {
    const sa = SEVERITY_ORDER.indexOf((a.severity ?? 'low').toLowerCase());
    const sb = SEVERITY_ORDER.indexOf((b.severity ?? 'low').toLowerCase());
    return (sa === -1 ? 99 : sa) - (sb === -1 ? 99 : sb);
  });

  // Count by severity for the header chip
  const counts = sorted.reduce<Record<string, number>>((acc, f) => {
    const k = (f.severity ?? 'low').toLowerCase();
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const topSeverity = SEVERITY_ORDER.find((s) => counts[s] > 0) ?? 'low';
  const top = styleFor(topSeverity);

  return (
    <div
      className={cn(
        'mb-4 rounded-lg border bg-background/60 ring-1 ring-inset',
        top.ring,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-foreground/70" />
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-foreground">
            Editorial review — {sorted.length} contradiction{sorted.length === 1 ? '' : 's'} found
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {SEVERITY_ORDER
              .filter((s) => counts[s])
              .map((s) => `${counts[s]} ${SEVERITY_STYLE[s].label.toLowerCase()}`)
              .join(' · ')}
          </p>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <ul className="space-y-2 border-t border-border/40 px-3 py-3">
          {sorted.map((f, i) => {
            const s = styleFor(f.severity);
            return (
              <li
                key={i}
                className="rounded-md border border-border/40 bg-background/80 p-2.5 text-[12px]"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={cn('inline-block h-1.5 w-1.5 rounded-full', s.dot)} />
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-px text-[9px] font-medium uppercase tracking-wider',
                      s.tag,
                    )}
                  >
                    {s.label}
                  </span>
                  {f.kind && (
                    <span className="text-[10px] text-muted-foreground/80">{f.kind}</span>
                  )}
                </div>

                {f.issue && (
                  <p className="mb-2 text-[12px] leading-snug text-foreground">{f.issue}</p>
                )}

                {(f.section_a || f.claim_a) && (
                  <div className="mb-1 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                    {f.section_a && (
                      <div>
                        <p className="font-medium text-foreground/80">{f.section_a}</p>
                        {f.claim_a && (
                          <p className="mt-0.5 text-[11px] italic text-muted-foreground/90 line-clamp-3">
                            “{f.claim_a}”
                          </p>
                        )}
                      </div>
                    )}
                    {f.section_b && (
                      <div>
                        <p className="font-medium text-foreground/80">{f.section_b}</p>
                        {f.claim_b && (
                          <p className="mt-0.5 text-[11px] italic text-muted-foreground/90 line-clamp-3">
                            “{f.claim_b}”
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {f.suggested_fix && (
                  <p className="mt-2 rounded bg-primary/5 px-2 py-1 text-[11px] text-foreground/85">
                    <span className="font-medium text-primary">Fix: </span>
                    {f.suggested_fix}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
