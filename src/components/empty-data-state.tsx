'use client';

import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORIES, type ChecklistCategory } from '@/components/documents/document-checklist';

interface EmptyDataDoc {
  id: string;
  filename: string;
  extraction_status: string;
  category?: string | null;
  categories?: string[] | null;
}

interface EmptyDataStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /**
   * Category IDs MUST be uploaded before the analysis can run.
   * These drive the progress counter and "Ready" state.
   */
  requiredCategories: string[];
  /**
   * Optional category IDs that strengthen the analysis but do not block it.
   * Missing ones become findings in the report itself.
   */
  recommendedCategories?: string[];
  /** Current company documents — used to flip items to "Received". */
  documents: EmptyDataDoc[];
  /**
   * When set, the Company Profile slot auto-satisfies from the website
   * (same behaviour as the action-panel checklist).
   */
  companyWebsite?: string | null;
  /**
   * Primary CTA rendered below the checklist — typically a "Generate Report"
   * dialog trigger so the user can proceed even without every doc uploaded.
   */
  cta?: React.ReactNode;
}

const HALO_GRADIENT =
  'radial-gradient(circle at center, color-mix(in oklch, var(--primary) 22%, transparent), transparent 65%)';

const RING_GRADIENT =
  'conic-gradient(from 0deg, color-mix(in oklch, var(--primary) 65%, transparent), transparent 25%, color-mix(in oklch, var(--primary) 85%, transparent) 50%, transparent 75%, color-mix(in oklch, var(--primary) 65%, transparent))';

const ICON_INNER_GRADIENT =
  'radial-gradient(circle at 30% 20%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 65%)';

type ResolvedItem = ChecklistCategory & {
  received: boolean;
  matched: EmptyDataDoc[];
  fromWebsite?: boolean;
};

export function EmptyDataState({
  icon: Icon,
  title,
  description,
  requiredCategories,
  recommendedCategories = [],
  documents,
  companyWebsite,
  cta,
}: EmptyDataStateProps) {
  const hasWebsiteProfile = !!companyWebsite && companyWebsite.trim().length > 0;
  const { requiredItems, recommendedItems } = useMemo(() => {
    const categoryById = new Map<string, ChecklistCategory>(CATEGORIES.map((c) => [c.id, c]));
    const resolve = (ids: string[]): ResolvedItem[] =>
      ids.map((id): ResolvedItem | null => {
        const meta = categoryById.get(id);
        if (!meta) return null;
        const matched = documents.filter((d) => {
          if (d.extraction_status !== 'completed') return false;
          if ((d.category || '').trim() === id) return true;
          if (Array.isArray(d.categories) && d.categories.includes(id)) return true;
          return false;
        });
        const autoFromWebsite = id === 'company_profile' && hasWebsiteProfile;
        return {
          ...meta,
          received: matched.length > 0 || autoFromWebsite,
          matched,
          fromWebsite: autoFromWebsite && matched.length === 0,
        };
      }).filter((x): x is ResolvedItem => x !== null);
    return {
      requiredItems: resolve(requiredCategories),
      recommendedItems: resolve(recommendedCategories),
    };
  }, [requiredCategories, recommendedCategories, documents, hasWebsiteProfile]);

  const receivedCount = requiredItems.filter((i) => i.received).length;
  const totalCount = requiredItems.length;
  const allReceived = totalCount > 0 && receivedCount === totalCount;

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
          className="absolute -inset-2 rounded-[32px] animate-spin-slow opacity-70 blur-[1px]"
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
        </div>
      </div>

      <h2 className="relative mb-3 text-center text-3xl font-semibold tracking-tight leading-tight">
        {title}
      </h2>

      {description && (
        <p className="relative mb-7 max-w-md text-center text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}

      {/* Primary CTA — sits above the checklist so the action is the focal point.
          The orbit ring is a thin conic gradient (one bright primary head)
          that circulates the button's perimeter to draw the eye. */}
      {cta && (
        <div className="relative mb-8 flex justify-center">
          <div className="relative inline-block">
            <span
              aria-hidden
              className="orbit-ring pointer-events-none absolute -inset-0.5 rounded-[10px] blur-[2px] opacity-90"
            />
            <div className="relative">{cta}</div>
          </div>
        </div>
      )}

      {/* Document checklist — suggested inputs that strengthen the analysis */}
      <div className="relative w-full max-w-md space-y-4">
        <ChecklistSection
          progress={`${receivedCount} / ${totalCount}`}
          items={requiredItems}
          tone="required"
          delayOffset={0}
        />
        {recommendedItems.length > 0 && (
          <ChecklistSection
            label="Recommended"
            caption="Strengthens the analysis — missing items become findings"
            items={recommendedItems}
            tone="recommended"
            delayOffset={requiredItems.length}
          />
        )}
      </div>

      {/* Status chip */}
      <div
        className={cn(
          'relative mt-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] transition-colors',
          allReceived
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-border/60 bg-muted/25 text-muted-foreground',
        )}
      >
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
              allReceived ? 'bg-emerald-400' : 'bg-primary',
            )}
          />
          <span
            className={cn(
              'relative inline-flex h-2 w-2 rounded-full',
              allReceived ? 'bg-emerald-400' : 'bg-primary',
            )}
          />
        </span>
        {allReceived
          ? 'Full context received — analysis will be most accurate'
          : `Uploading more context improves the analysis`}
      </div>
    </div>
  );
}

interface ChecklistSectionProps {
  label?: string;
  caption?: string;
  progress?: string;
  items: ResolvedItem[];
  tone: 'required' | 'recommended';
  delayOffset: number;
}

function ChecklistSection({ label, caption, progress, items, tone, delayOffset }: ChecklistSectionProps) {
  if (items.length === 0) return null;
  const isRecommended = tone === 'recommended';
  const showHeader = !!label || !!caption || !!progress;
  return (
    <div>
      {showHeader && (
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <div className="flex items-baseline gap-2 min-w-0">
            {label && (
              <p className={cn(
                'text-[10px] font-semibold uppercase tracking-[0.18em]',
                isRecommended ? 'text-muted-foreground/70' : 'text-muted-foreground',
              )}>
                {label}
              </p>
            )}
            {caption && (
              <p className="text-[10px] text-muted-foreground/50 truncate">{caption}</p>
            )}
          </div>
          {progress && (
            <p className="shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground">
              {progress}
            </p>
          )}
        </div>
      )}
      <ul className="space-y-1">
        {items.map((item, i) => {
          const ItemIcon = item.icon;
          return (
            <li
              key={item.id}
              className={cn(
                'flex items-center gap-2.5 rounded-md border px-3 py-2 transition-all',
                item.received
                  ? 'border-emerald-500/25 bg-emerald-500/[0.05]'
                  : isRecommended
                    ? 'border-dashed border-border/40 bg-transparent'
                    : 'border-border/50 bg-muted/20',
              )}
              style={{
                animation: `om-fade-up 500ms cubic-bezier(0.22,1,0.36,1) both`,
                animationDelay: `${200 + (delayOffset + i) * 70}ms`,
              }}
            >
              <div
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
                  item.received
                    ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30'
                    : 'bg-muted/40 text-muted-foreground/50 ring-border',
                )}
              >
                {item.received ? (
                  <Check className="h-3 w-3" strokeWidth={3.5} />
                ) : (
                  <Circle className="h-2 w-2" strokeWidth={3} />
                )}
              </div>
              <ItemIcon
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  item.received
                    ? 'text-emerald-400/80'
                    : isRecommended ? 'text-muted-foreground/50' : 'text-muted-foreground/60',
                )}
              />
              <p
                className={cn(
                  'flex-1 text-[12px] font-medium truncate',
                  item.received
                    ? 'text-foreground'
                    : isRecommended ? 'text-muted-foreground/80' : 'text-muted-foreground',
                )}
              >
                {item.label}
              </p>
              {item.received && item.matched.length > 0 && (
                <span className="shrink-0 truncate max-w-[130px] text-[10px] text-muted-foreground/70" title={item.matched[0].filename}>
                  {item.matched[0].filename}
                  {item.matched.length > 1 && (
                    <span className="ml-1 font-mono tabular-nums text-muted-foreground/50">
                      +{item.matched.length - 1}
                    </span>
                  )}
                </span>
              )}
              {item.fromWebsite && (
                <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-primary ring-1 ring-inset ring-primary/25">
                  Website
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
