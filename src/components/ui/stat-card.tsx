import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatTone = 'primary' | 'positive' | 'warn' | 'danger' | 'muted';

const TONE_STYLES: Record<StatTone, { rule: string; iconBg: string; iconRing: string; iconColor: string; valueColor?: string }> = {
  primary: {
    rule: 'via-primary/40',
    iconBg: 'bg-primary/10',
    iconRing: 'ring-primary/20',
    iconColor: 'text-primary',
  },
  positive: {
    rule: 'via-emerald-400/50',
    iconBg: 'bg-emerald-400/10',
    iconRing: 'ring-emerald-400/25',
    iconColor: 'text-emerald-400',
    valueColor: 'text-emerald-300',
  },
  warn: {
    rule: 'via-amber-400/50',
    iconBg: 'bg-amber-400/10',
    iconRing: 'ring-amber-400/25',
    iconColor: 'text-amber-400',
  },
  danger: {
    rule: 'via-rose-400/50',
    iconBg: 'bg-rose-400/10',
    iconRing: 'ring-rose-400/25',
    iconColor: 'text-rose-400',
    valueColor: 'text-rose-300',
  },
  muted: {
    rule: 'via-border/40',
    iconBg: 'bg-muted/40',
    iconRing: 'ring-border/40',
    iconColor: 'text-muted-foreground',
  },
};

export interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  caption?: React.ReactNode;
  /**
   * Visual accent for the top rule, icon, and (for positive/danger) value text.
   * Backwards compatible: `accent="warn"` is preserved as an alias for tone="warn".
   */
  tone?: StatTone;
  /** @deprecated use `tone` */
  accent?: 'warn';
}

export function StatCard({ label, value, icon: Icon, caption, tone, accent }: StatCardProps) {
  const resolved: StatTone = tone ?? (accent === 'warn' ? 'warn' : 'primary');
  const styles = TONE_STYLES[resolved];

  return (
    <article className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/30 p-5 ring-1 ring-foreground/[0.04] shadow-[0_1px_0_0_oklch(1_0_0/0.04)_inset,0_10px_30px_-15px_oklch(0_0_0/0.55)] transition-[box-shadow,ring] duration-200 hover:ring-foreground/10 hover:shadow-[0_1px_0_0_oklch(1_0_0/0.06)_inset,0_20px_40px_-15px_oklch(0_0_0/0.70)]">
      <div className={cn('absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent', styles.rule)} />
      <div className="relative flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-inset', styles.iconBg, styles.iconRing)}>
          <Icon className={cn('h-3.5 w-3.5', styles.iconColor)} strokeWidth={2} />
        </div>
      </div>
      <p className={cn('font-numeric relative mt-3 truncate text-xl font-semibold tracking-tight', styles.valueColor)}>
        {value}
      </p>
      {caption !== undefined && caption !== null && caption !== '' && (
        <div className="relative mt-1 truncate text-xs text-muted-foreground">
          {caption}
        </div>
      )}
    </article>
  );
}
