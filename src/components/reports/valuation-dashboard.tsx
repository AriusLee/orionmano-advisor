'use client';

import { useId, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';
import {
  TrendingUp, DollarSign, Percent, Building2, Target, AlertTriangle,
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';

// ─── Chart styling — matches components/reports/chart-block.tsx ───
const COLORS = [
  'oklch(0.75 0.15 175)',  // teal
  'oklch(0.65 0.15 250)',  // blue
  'oklch(0.70 0.12 140)',  // green
  'oklch(0.60 0.18 300)',  // purple
  'oklch(0.55 0.15 260)',  // indigo
  'oklch(0.70 0.15 50)',   // amber
  'oklch(0.65 0.18 30)',   // orange
  'oklch(0.60 0.13 200)',  // cyan
];
const COLORS_DARK = [
  'oklch(0.55 0.14 175)',
  'oklch(0.45 0.14 250)',
  'oklch(0.50 0.11 140)',
  'oklch(0.42 0.16 300)',
  'oklch(0.38 0.14 260)',
  'oklch(0.50 0.14 50)',
  'oklch(0.46 0.16 30)',
  'oklch(0.42 0.12 200)',
];
const TT = {
  background: 'oklch(0.20 0.014 260)',
  border: '1px solid oklch(0.30 0.014 260)',
  borderRadius: 8,
  fontSize: 12,
  color: 'oklch(0.92 0.01 260)',
  padding: '8px 10px',
};
const TT_LABEL = { color: 'oklch(0.92 0.01 260)', fontWeight: 500, marginBottom: 2 };
const TT_ITEM = { color: 'oklch(0.85 0.01 260)' };
const AXIS_TICK = { fontSize: 11, fill: 'oklch(0.70 0.01 260)' };
const GRID_STROKE = 'oklch(0.30 0.014 260 / 0.5)';

// ─── Types matching backend compute.py output ───

interface WaccComponents {
  risk_free_rate: number;
  equity_risk_premium: number;
  country_risk_premium: number;
  size_premium: number;
  specific_risk_premium: number;
  pretax_cost_of_debt: number;
  debt_weight: number;
  equity_weight: number;
  unlevered_beta: number;
  target_d_to_e: number;
}

interface WaccScenario {
  effective_tax_rate: number;
  levered_beta: number;
  cost_of_equity: number;
  aftertax_cost_of_debt: number;
  wacc: number;
  components: WaccComponents;
}

interface DcfResult {
  sum_pv_explicit: number;
  pv_explicit_by_year?: number[];
  terminal_value: number;
  pv_terminal: number;
  ev: number;
}

interface BridgeResult {
  ev: number;
  surplus_assets: number;
  non_operating_assets: number;
  net_debt: number;
  minority_interests: number;
  equity_pre_discount: number;
  dlom_pct: number;
  after_dlom: number;
  dloc_pct: number;
  after_dloc: number;
  equity_interest_pct: number;
  client_value: number;
}

interface PerShare {
  basic: number | null;
  diluted: number | null;
}

interface FFBand {
  low: number;
  mid: number;
  high: number;
  weight?: number;
}

interface CocoStat {
  q1: number;
  median: number;
  q3: number;
  n: number;
}

export interface ValuationSummary {
  engagement: {
    company_name?: string;
    valuation_date?: string;
    country?: string;
    industry?: string;
    report_purpose?: string;
  };
  currency: { primary?: string; unit?: string };
  projections: {
    revenue: number[];
    ebitda: number[];
    fcff: number[];
    ebit: number[];
  };
  wacc: { per_management: WaccScenario; independent: WaccScenario };
  dcf: { per_management: DcfResult; independent: DcfResult };
  bridge: { per_management: BridgeResult; independent: BridgeResult };
  per_share: { per_management: PerShare; independent: PerShare };
  coco_stats: Record<string, CocoStat>;
  football_field: {
    dcf: FFBand;
    comps: FFBand;
    precedent: FFBand;
    weighted_mid: number;
    selected_low?: number | null;
    selected_mid?: number | null;
    selected_high?: number | null;
  };
  sensitivity: {
    wacc_axis: number[];
    terminal_g_axis: number[];
    grid: (number | null)[][];
    base_row: number;
    base_col: number;
  };
  terminal: { method: string; growth_rate: number };
}

// ─── Helpers ───

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', HKD: 'HK$', SGD: 'S$', MYR: 'RM', CNY: '¥', JPY: '¥',
  EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', INR: '₹', KRW: '₩',
  TWD: 'NT$', THB: '฿', VND: '₫', IDR: 'Rp', PHP: '₱',
};

function unitMultiplier(unit?: string): number {
  const u = (unit || '').replace(/^'|'$/g, '');
  if (u === '000') return 1_000;
  if (u === 'million' || u === 'mm' || u === 'm') return 1_000_000;
  return 1;
}

function currencySymbol(currency?: string): string {
  if (!currency) return '';
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency} `;
}

/**
 * Format a workbook value (stored in `unit` denomination) as a human-readable
 * string with K/M/B abbreviation. Collapses the unit so we never display
 * confusing double-thousands like "2K ('000)" — just "$2.0M".
 */
function formatCurrency(v: number, unit?: string, currency?: string): string {
  if (!isFinite(v)) return '–';
  const absolute = v * unitMultiplier(unit);
  const abs = Math.abs(absolute);
  let suffix = '';
  let value = absolute;
  if (abs >= 1_000_000_000) {
    value = absolute / 1_000_000_000;
    suffix = 'B';
  } else if (abs >= 1_000_000) {
    value = absolute / 1_000_000;
    suffix = 'M';
  } else if (abs >= 1_000) {
    value = absolute / 1_000;
    suffix = 'K';
  }
  const sign = value < 0 ? '−' : '';
  const sym = currencySymbol(currency);
  return `${sign}${sym}${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: Math.abs(value) >= 100 ? 0 : 1,
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 1,
  })}${suffix}`;
}

function formatPct(v: number, digits = 2): string {
  if (!isFinite(v)) return '–';
  return `${(v * 100).toFixed(digits)}%`;
}

function formatPerShare(v: number | null, currency?: string): string {
  if (v === null || !isFinite(v)) return '–';
  const sym = currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : '';
  return `${sym}${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

// Color ramp for sensitivity heatmap (red → amber → green based on EV vs base)
function heatColor(v: number | null, base: number): string {
  if (v === null || !isFinite(v) || base <= 0) return 'transparent';
  const ratio = v / base;
  if (ratio < 0.7) return 'oklch(0.55 0.18 25 / 0.55)';   // red
  if (ratio < 0.85) return 'oklch(0.58 0.16 35 / 0.45)';  // red-orange
  if (ratio < 0.95) return 'oklch(0.65 0.14 60 / 0.40)';  // orange
  if (ratio < 1.05) return 'oklch(0.70 0.12 90 / 0.40)';  // amber/neutral
  if (ratio < 1.20) return 'oklch(0.65 0.14 140 / 0.40)'; // light green
  if (ratio < 1.40) return 'oklch(0.62 0.16 150 / 0.50)'; // green
  return 'oklch(0.58 0.18 155 / 0.60)';                   // dark green
}

// ─── Component ───

export function ValuationDashboard({
  summary,
  generatedAt,
  xlsxUrl,
  warnings,
}: {
  summary: ValuationSummary;
  generatedAt?: string;
  xlsxUrl?: string | null;
  warnings?: string[];
}) {
  const gradPrefix = useId().replace(/[:]/g, '');
  const unit = summary.currency.unit;
  const currency = summary.currency.primary;
  const dcfPm = summary.dcf.per_management;
  const dcfIndep = summary.dcf.independent;
  const bridgePm = summary.bridge.per_management;
  const waccPm = summary.wacc.per_management;
  const waccIndep = summary.wacc.independent;
  const ppsPm = summary.per_share.per_management;
  const ppsIndep = summary.per_share.independent;
  const ff = summary.football_field;
  const sens = summary.sensitivity;

  const evRange = useMemo(() => {
    const lo = Math.min(dcfPm.ev, dcfIndep.ev);
    const hi = Math.max(dcfPm.ev, dcfIndep.ev);
    return { lo, hi };
  }, [dcfPm.ev, dcfIndep.ev]);

  const projectionData = useMemo(() => {
    const yrs = summary.projections.revenue.length - 1;
    return Array.from({ length: yrs + 1 }, (_, i) => ({
      year: i === 0 ? 'Y0' : `Y${i}`,
      Revenue: summary.projections.revenue[i] ?? 0,
      EBITDA: i === 0 ? 0 : (summary.projections.ebitda[i - 1] ?? 0),
      FCFF: i === 0 ? 0 : (summary.projections.fcff[i - 1] ?? 0),
    }));
  }, [summary.projections]);

  const ffData = useMemo(() => {
    const rows: { name: string; low: number; mid: number; high: number; weight?: number; range: number }[] = [];
    if (ff.dcf.high > 0) {
      rows.push({ name: 'DCF', low: ff.dcf.low, mid: ff.dcf.mid, high: ff.dcf.high, weight: ff.dcf.weight, range: ff.dcf.high - ff.dcf.low });
    }
    if (ff.comps.high > 0) {
      rows.push({ name: 'Comps (NTM)', low: ff.comps.low, mid: ff.comps.mid, high: ff.comps.high, weight: ff.comps.weight, range: ff.comps.high - ff.comps.low });
    }
    if (ff.precedent.high > 0) {
      rows.push({ name: 'Precedents', low: ff.precedent.low, mid: ff.precedent.mid, high: ff.precedent.high, weight: ff.precedent.weight, range: ff.precedent.high - ff.precedent.low });
    }
    return rows;
  }, [ff]);

  const ffMaxX = useMemo(() => {
    const candidates = ffData.flatMap(r => [r.high]).concat([ff.weighted_mid]);
    return Math.max(...candidates, 1) * 1.1;
  }, [ffData, ff.weighted_mid]);

  const waccBuildData = useMemo(() => {
    const c = waccPm.components;
    return [
      { component: 'Risk-free', value: c.risk_free_rate },
      { component: 'β × ERP', value: waccPm.levered_beta * c.equity_risk_premium },
      { component: 'Country', value: c.country_risk_premium },
      { component: 'Size', value: c.size_premium },
      { component: 'Specific', value: c.specific_risk_premium },
    ];
  }, [waccPm]);

  const headerLine = [
    summary.engagement.company_name,
    summary.engagement.valuation_date && `as of ${summary.engagement.valuation_date}`,
    summary.engagement.country,
    summary.engagement.industry,
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-6">
      {headerLine && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground truncate">{headerLine}</p>
          {generatedAt && (
            <p className="text-[11px] text-muted-foreground/70 tabular-nums shrink-0">
              Generated {new Date(generatedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Headline stats — primary outputs on row 1, drivers on row 2 */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatCard
            icon={Building2}
            label="Enterprise Value"
            tone="primary"
            value={formatCurrency(dcfPm.ev, unit, currency)}
            caption={
              <span className="tabular-nums">
                Range: {formatCurrency(evRange.lo, unit, currency)} – {formatCurrency(evRange.hi, unit, currency)}
              </span>
            }
          />
          <StatCard
            icon={DollarSign}
            label="Equity (after DLOM/DLOC)"
            tone="positive"
            value={formatCurrency(bridgePm.after_dloc, unit, currency)}
            caption={
              <span className="tabular-nums">
                {formatPct(bridgePm.dlom_pct, 0)} DLOM · {formatPct(bridgePm.dloc_pct, 0)} DLOC
              </span>
            }
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            icon={Target}
            label="Per share (basic)"
            tone="primary"
            value={formatPerShare(ppsPm.basic, currency)}
            caption={
              ppsIndep.basic !== null && ppsPm.basic !== null
                ? <span className="tabular-nums">Indep: {formatPerShare(ppsIndep.basic, currency)}</span>
                : undefined
            }
          />
          <StatCard
            icon={Percent}
            label="WACC"
            tone="warn"
            value={formatPct(waccPm.wacc)}
            caption={
              <span className="tabular-nums">
                Indep: {formatPct(waccIndep.wacc)} · β {waccPm.levered_beta.toFixed(2)}
              </span>
            }
          />
          <StatCard
            icon={TrendingUp}
            label="Terminal growth"
            tone="muted"
            value={formatPct(summary.terminal.growth_rate)}
            caption={
              <span className="capitalize">
                {summary.terminal.method.replace('_', ' ')}
              </span>
            }
          />
        </div>
      </div>

      {/* Football Field — full width */}
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="text-sm font-semibold tracking-tight">Football field</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enterprise value range by methodology · weighted mid {formatCurrency(ff.weighted_mid, unit, currency)}
        </p>
        <div className="mt-4 rounded-md border border-border/60 bg-muted/10 p-3">
          {ffData.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No methodology bands available
            </div>
          ) : (
            <FootballField rows={ffData} maxX={ffMaxX} weightedMid={ff.weighted_mid} unit={unit} currency={currency} />
          )}
        </div>
      </div>

      {/* EV → Equity bridge — full width */}
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="text-sm font-semibold tracking-tight">EV → Equity bridge</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Per-Management scenario</p>
        <div className="mt-4 rounded-md border border-border/60 bg-muted/10 p-3">
          <BridgeWaterfall bridge={bridgePm} unit={unit} currency={currency} />
        </div>
      </div>

      {/* Projections + Sensitivity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="text-sm font-semibold tracking-tight">Projections (5-year)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Revenue, EBITDA & FCFF cascade</p>
          <div className="mt-4 rounded-md border border-border/60 bg-muted/10 p-3">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projectionData} margin={{ top: 5, right: 12, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis dataKey="year" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatCurrency(v, unit, currency)} width={64} />
                  <Tooltip
                    contentStyle={TT}
                    labelStyle={TT_LABEL}
                    itemStyle={TT_ITEM}
                    cursor={{ stroke: 'oklch(0.40 0.01 260)', strokeDasharray: '3 3' }}
                    formatter={(v) => formatCurrency(Number(v), unit, currency)}
                  />
                  <Line type="monotone" dataKey="Revenue" stroke={COLORS[1]} strokeWidth={2} dot={{ r: 3, fill: COLORS[1] }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="EBITDA" stroke={COLORS[2]} strokeWidth={2} dot={{ r: 3, fill: COLORS[2] }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="FCFF" stroke={COLORS[6]} strokeWidth={2} dot={{ r: 3, fill: COLORS[6] }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
              <LegendDot color={COLORS[1]} label="Revenue" />
              <LegendDot color={COLORS[2]} label="EBITDA" />
              <LegendDot color={COLORS[6]} label="FCFF" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <h3 className="text-sm font-semibold tracking-tight">Sensitivity — EV (WACC × terminal g)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Per-Management base · darker green = higher EV</p>
          <div className="mt-4 rounded-md border border-border/60 bg-muted/10 p-3">
            <SensitivityGrid sens={sens} unit={unit} currency={currency} />
          </div>
        </div>
      </div>

      {/* WACC build + Comps multiples */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="text-sm font-semibold tracking-tight">Cost of Equity build</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Per-Management · Ke = {formatPct(waccPm.cost_of_equity)} · Kd<sub>at</sub> = {formatPct(waccPm.aftertax_cost_of_debt)}
          </p>
          <div className="mt-4 rounded-md border border-border/60 bg-muted/10 p-3">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waccBuildData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id={`${gradPrefix}-wacc`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={COLORS[3]} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={COLORS_DARK[3]} stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => `${(v * 100).toFixed(1)}%`} />
                  <YAxis type="category" dataKey="component" tick={AXIS_TICK} width={70} />
                  <Tooltip
                    contentStyle={TT}
                    labelStyle={TT_LABEL}
                    itemStyle={TT_ITEM}
                    cursor={{ fill: 'oklch(0.40 0.01 260 / 0.15)' }}
                    formatter={(v) => formatPct(Number(v), 2)}
                  />
                  <Bar dataKey="value" fill={`url(#${gradPrefix}-wacc)`} radius={[0, 0, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <h3 className="text-sm font-semibold tracking-tight">CoCo trading multiples (median)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Q1 / Median / Q3 across the comparable set
          </p>
          <div className="mt-4 rounded-md border border-border/60 bg-muted/10 p-3">
            <CocoStatsTable stats={summary.coco_stats} />
          </div>
        </div>
      </div>

      {warnings && warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            <h3 className="text-sm font-semibold">{warnings.length} validation warning{warnings.length === 1 ? '' : 's'}</h3>
          </div>
          <ul className="mt-2 space-y-1 text-[11px] font-mono text-foreground/70">
            {warnings.slice(0, 5).map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
            {warnings.length > 5 && (
              <li className="text-muted-foreground">…and {warnings.length - 5} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function FootballField({
  rows,
  maxX,
  weightedMid,
  unit,
  currency,
}: {
  rows: { name: string; low: number; mid: number; high: number; weight?: number; range: number }[];
  maxX: number;
  weightedMid: number;
  unit?: string;
  currency?: string;
}) {
  const ROW_H = 36;
  const W = 600;
  const PAD_L = 110;
  const PAD_R = 90;
  const CHART_W = W - PAD_L - PAD_R;
  const xScale = (v: number) => PAD_L + (v / maxX) * CHART_W;
  const H = rows.length * ROW_H + 40;

  // Per-row hue: rotate through palette so DCF / Comps / Precedents read distinctly
  const rowColor = (i: number) => COLORS[i % COLORS.length];
  const rowColorDark = (i: number) => COLORS_DARK[i % COLORS_DARK.length];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Vertical grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <line
          key={p}
          x1={xScale(p * maxX)}
          x2={xScale(p * maxX)}
          y1={0}
          y2={rows.length * ROW_H}
          stroke={GRID_STROKE}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      ))}
      {/* Bars */}
      {rows.map((r, i) => {
        const y = i * ROW_H + 8;
        const barH = 20;
        const x1 = xScale(r.low);
        const x2 = xScale(r.high);
        const xMid = xScale(r.mid);
        const fill = rowColor(i);
        const stroke = rowColorDark(i);
        return (
          <g key={r.name}>
            <text
              x={PAD_L - 8}
              y={y + barH / 2}
              dominantBaseline="middle"
              textAnchor="end"
              fill="oklch(0.92 0.01 260)"
              fontSize={11}
              fontWeight={500}
            >
              {r.name}
            </text>
            <rect
              x={x1}
              y={y}
              width={Math.max(2, x2 - x1)}
              height={barH}
              rx={3}
              fill={fill}
              fillOpacity={0.30}
              stroke={stroke}
              strokeWidth={1}
            />
            <line
              x1={xMid}
              x2={xMid}
              y1={y - 2}
              y2={y + barH + 2}
              stroke={fill}
              strokeWidth={2.5}
            />
            <text
              x={W - PAD_R + 6}
              y={y + barH / 2}
              dominantBaseline="middle"
              fill="oklch(0.70 0.01 260)"
              fontSize={10}
            >
              {r.weight ? `w=${(r.weight * 100).toFixed(0)}%` : ''}
            </text>
          </g>
        );
      })}
      {/* Weighted mid line */}
      {weightedMid > 0 && (
        <g>
          <line
            x1={xScale(weightedMid)}
            x2={xScale(weightedMid)}
            y1={0}
            y2={rows.length * ROW_H}
            stroke={COLORS[6]}
            strokeWidth={2}
            strokeDasharray="5 4"
          />
          <text
            x={xScale(weightedMid)}
            y={rows.length * ROW_H + 16}
            textAnchor="middle"
            fill={COLORS[6]}
            fontSize={10}
            fontWeight={600}
          >
            Weighted: {formatCurrency(weightedMid, unit, currency)}
          </text>
        </g>
      )}
      {/* X-axis labels */}
      {[0, 0.5, 1].map((p) => (
        <text
          key={p}
          x={xScale(p * maxX)}
          y={rows.length * ROW_H + 30}
          textAnchor="middle"
          fill="oklch(0.70 0.01 260)"
          fontSize={10}
        >
          {formatCurrency(p * maxX, unit, currency)}
        </text>
      ))}
    </svg>
  );
}

function BridgeWaterfall({ bridge, unit, currency }: { bridge: BridgeResult; unit?: string; currency?: string }) {
  const steps: { label: string; value: number; sign: 'pos' | 'neg' | 'total' }[] = [
    { label: 'Enterprise Value', value: bridge.ev, sign: 'total' },
    { label: '+ Surplus assets', value: bridge.surplus_assets, sign: 'pos' },
    { label: '+ Non-op assets', value: bridge.non_operating_assets, sign: 'pos' },
    { label: '− Net debt', value: -bridge.net_debt, sign: 'neg' },
    { label: '− Minority', value: -bridge.minority_interests, sign: 'neg' },
    { label: 'Equity (pre)', value: bridge.equity_pre_discount, sign: 'total' },
    { label: '− DLOM', value: bridge.after_dlom - bridge.equity_pre_discount, sign: 'neg' },
    { label: '− DLOC', value: bridge.after_dloc - bridge.after_dlom, sign: 'neg' },
    { label: 'Final Equity', value: bridge.after_dloc, sign: 'total' },
  ];
  const maxAbs = Math.max(...steps.map(s => Math.abs(s.value)));
  return (
    <div className="space-y-1">
      {steps.map((s, i) => {
        const width = maxAbs > 0 ? Math.max(4, (Math.abs(s.value) / maxAbs) * 100) : 0;
        const isTotal = s.sign === 'total';
        const isNeg = s.sign === 'neg';
        return (
          <div key={i} className={cn(
            'grid grid-cols-[10rem_1fr_8rem] items-center gap-3 text-[11px] tabular-nums py-1',
            isTotal && 'font-semibold border-t border-border/60 pt-2 mt-1'
          )}>
            <span className={cn('truncate', isTotal ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</span>
            <div className="relative h-4 bg-muted/30 overflow-hidden">
              <div
                className={cn(
                  'absolute top-0 h-full',
                  isTotal && 'bg-primary/60',
                  s.sign === 'pos' && 'bg-emerald-500/50',
                  isNeg && 'bg-rose-500/50',
                )}
                style={{ width: `${width}%`, [isNeg || isTotal ? 'right' : 'left']: 0 }}
              />
            </div>
            <span className={cn(
              'text-right font-mono',
              isTotal ? 'text-foreground' : isNeg ? 'text-rose-400' : 'text-emerald-400',
            )}>
              {formatCurrency(s.value, unit, currency)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SensitivityGrid({
  sens,
  unit,
  currency,
}: {
  sens: ValuationSummary['sensitivity'];
  unit?: string;
  currency?: string;
}) {
  const base = sens.grid[sens.base_row]?.[sens.base_col] ?? 0;
  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] tabular-nums w-full">
        <thead>
          <tr className="text-muted-foreground">
            <th className="px-1 py-1 text-left font-medium">WACC ↓ / g →</th>
            {sens.terminal_g_axis.map((g, i) => (
              <th
                key={i}
                className={cn('px-1 py-1 font-medium', i === sens.base_col && 'text-primary font-semibold')}
              >
                {(g * 100).toFixed(1)}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sens.grid.map((row, ri) => (
            <tr key={ri}>
              <td className={cn('px-1 py-0.5 text-muted-foreground', ri === sens.base_row && 'text-primary font-semibold')}>
                {(sens.wacc_axis[ri] * 100).toFixed(1)}%
              </td>
              {row.map((cell, ci) => {
                const isBase = ri === sens.base_row && ci === sens.base_col;
                return (
                  <td
                    key={ci}
                    className={cn(
                      'px-1 py-0.5 text-center transition-colors border border-border/30',
                      isBase && 'ring-2 ring-primary/60 font-semibold',
                    )}
                    style={{ backgroundColor: heatColor(cell, base) }}
                  >
                    {cell === null
                      ? '—'
                      : formatCurrency(cell, unit, currency)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CocoStatsTable({ stats }: { stats: Record<string, CocoStat> }) {
  const rows: { key: string; label: string; fmt: 'mult' | 'pct' }[] = [
    { key: 'ev_sales_ntm', label: 'EV / Sales NTM', fmt: 'mult' },
    { key: 'ev_sales_ltm', label: 'EV / Sales LTM', fmt: 'mult' },
    { key: 'ev_ebitda_ntm', label: 'EV / EBITDA NTM', fmt: 'mult' },
    { key: 'ev_ebitda_ltm', label: 'EV / EBITDA LTM', fmt: 'mult' },
    { key: 'pe_ntm', label: 'P / E NTM', fmt: 'mult' },
    { key: 'pe_ltm', label: 'P / E LTM', fmt: 'mult' },
  ];
  const fmt = (v: number) => `${v.toFixed(1)}×`;
  return (
    <div>
      <table className="w-full text-[11px] tabular-nums">
        <thead>
          <tr className="text-muted-foreground border-b border-border/60">
            <th className="text-left py-1.5 font-medium">Multiple</th>
            <th className="text-right py-1.5 font-medium">Q1</th>
            <th className="text-right py-1.5 font-medium text-foreground">Median</th>
            <th className="text-right py-1.5 font-medium">Q3</th>
            <th className="text-right py-1.5 font-medium">n</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = stats[r.key];
            if (!s || s.n === 0) {
              return (
                <tr key={r.key} className="border-b border-border/30">
                  <td className="py-1.5 text-foreground">{r.label}</td>
                  <td className="text-right text-muted-foreground/40">—</td>
                  <td className="text-right text-muted-foreground/40">—</td>
                  <td className="text-right text-muted-foreground/40">—</td>
                  <td className="text-right text-muted-foreground/40">0</td>
                </tr>
              );
            }
            return (
              <tr key={r.key} className="border-b border-border/30">
                <td className="py-1.5 text-foreground">{r.label}</td>
                <td className="text-right text-muted-foreground">{fmt(s.q1)}</td>
                <td className="text-right text-foreground font-semibold">{fmt(s.median)}</td>
                <td className="text-right text-muted-foreground">{fmt(s.q3)}</td>
                <td className="text-right text-muted-foreground">{Math.round(s.n)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
