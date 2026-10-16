import { cn } from '@/lib/utils';
import { changeTone, fmtMoney, fmtPct } from '@/lib/valuation-format';

/** What a change does to the valuation, as the backend's model_io.impact_between returns it. */
export interface Impact {
  ev_before: number | null;
  ev_after: number | null;
  equity_before: number | null;
  equity_after: number | null;
  ev_change_pct: number | null;
  equity_change_pct: number | null;
  range_before?: [number | null, number | null];
  range_after?: [number | null, number | null];
  dcf_range_before?: [number | null, number | null];
  dcf_range_after?: [number | null, number | null];
  currency: string | null;
  unit: string | null;
}

function span(r?: [number | null, number | null]): string {
  return r && r[0] != null && r[1] != null ? `${fmtMoney(r[0])}–${fmtMoney(r[1])}` : '—';
}

function sameRange(a?: [number | null, number | null], b?: [number | null, number | null]): boolean {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}

/** EV and equity change, then the DCF and concluded valuation ranges before → after. */
export function ImpactSummary({ impact, className }: { impact: Impact; className?: string }) {
  const unit = [impact.currency, impact.unit].filter(Boolean).join(' ');
  return (
    <div className={cn('space-y-0.5 text-xs', className)}>
      <p>
        EV <span className={cn('font-mono', changeTone(impact.ev_change_pct))}>{fmtPct(impact.ev_change_pct, 1, true)}</span>
        <span className="text-muted-foreground"> ({fmtMoney(impact.ev_before)} → {fmtMoney(impact.ev_after, impact.currency, impact.unit)})</span>
        {' · '}Equity <span className={cn('font-mono', changeTone(impact.equity_change_pct))}>{fmtPct(impact.equity_change_pct, 1, true)}</span>
        <span className="text-muted-foreground"> ({fmtMoney(impact.equity_before)} → {fmtMoney(impact.equity_after)})</span>
      </p>
      {impact.dcf_range_before && (
        <p className="text-muted-foreground">
          DCF range {span(impact.dcf_range_before)} → <span className="font-mono text-foreground">{span(impact.dcf_range_after)}</span>
          {unit && ` ${unit}`}
          {impact.range_before && (
            <>
              {' · '}Concluded range{' '}
              {sameRange(impact.range_before, impact.range_after) ? (
                <>{span(impact.range_before)} unchanged (the selected band still brackets the EV)</>
              ) : (
                <>
                  {span(impact.range_before)} → <span className="font-mono text-foreground">{span(impact.range_after)}</span>
                </>
              )}
            </>
          )}
        </p>
      )}
    </div>
  );
}
