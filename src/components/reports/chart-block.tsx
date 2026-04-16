'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import { useId } from 'react';

const COLORS = [
  'oklch(0.75 0.15 175)',
  'oklch(0.65 0.15 250)',
  'oklch(0.70 0.12 140)',
  'oklch(0.60 0.18 300)',
  'oklch(0.55 0.15 260)',
  'oklch(0.70 0.15 50)',
  'oklch(0.65 0.18 30)',
  'oklch(0.60 0.13 200)',
];

// Darker stop for the bottom of bar gradients — same hue, lower lightness/chroma.
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

export type ChartType = 'bar' | 'stacked-bar' | 'line' | 'pie' | 'horizontal-bar';

export interface ChartSpec {
  type: ChartType;
  title: string;
  x_label?: string;
  y_label?: string;
  y_unit?: string;
  data: Array<Record<string, string | number>>;
  series?: string[];
  annotations?: string[];
  source_note?: string;
}

function inferSeries(spec: ChartSpec): string[] {
  if (spec.series && spec.series.length > 0) return spec.series;
  // Infer from data: every key except 'x'
  const first = spec.data[0] || {};
  return Object.keys(first).filter((k) => k !== 'x' && typeof first[k] === 'number');
}

/** Strip markdown bold, <br>, footnote markers from a chart label/title. */
function cleanLabel(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .replace(/<br\s*\/?\s*>/gi, ' · ')
    .replace(/\*\*/g, '')
    .replace(/[*_`]/g, '')
    .replace(/\[\^\d+\]/g, '')
    .replace(/<cite[^>]*\/>/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Pre-clean every label-like string in a spec so charts never render raw markdown. */
function cleanSpec(spec: ChartSpec): ChartSpec {
  const series = (spec.series || []).map(cleanLabel);
  return {
    ...spec,
    title: cleanLabel(spec.title),
    x_label: spec.x_label ? cleanLabel(spec.x_label) : spec.x_label,
    y_label: spec.y_label ? cleanLabel(spec.y_label) : spec.y_label,
    series,
    data: spec.data.map((row) => {
      const out: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === 'x') {
          out[k] = cleanLabel(v);
        } else {
          // Rename keys to their cleaned form so they match cleaned series names.
          out[cleanLabel(k)] = typeof v === 'string' ? cleanLabel(v) : v;
        }
      }
      return out;
    }),
    annotations: spec.annotations?.map(cleanLabel),
    source_note: spec.source_note ? cleanLabel(spec.source_note) : spec.source_note,
  };
}

function fmt(v: unknown): string {
  if (typeof v !== 'number') return String(v ?? '');
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function ChartBlock({ spec: rawSpec }: { spec: ChartSpec }) {
  const gradId = useId().replace(/[:]/g, '');
  if (!rawSpec || !Array.isArray(rawSpec.data) || rawSpec.data.length === 0) {
    return (
      <div className="my-4 rounded border border-dashed border-muted-foreground/30 px-3 py-2 text-xs text-muted-foreground italic">
        Chart spec missing or empty.
      </div>
    );
  }
  const spec = cleanSpec(rawSpec);
  const series = inferSeries(spec);
  const unit = spec.y_unit ? ` (${spec.y_unit})` : '';

  return (
    <figure className="my-5 not-prose">
      <figcaption className="mb-2 text-sm font-semibold tracking-tight text-foreground">
        {spec.title}
      </figcaption>
      <div className="rounded-md border border-border/60 bg-muted/10 p-3">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart(spec, series, unit, gradId)}
          </ResponsiveContainer>
        </div>
        {spec.annotations && spec.annotations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {spec.annotations.map((a, i) => (
              <span key={i}>{a}</span>
            ))}
          </div>
        )}
      </div>
      {spec.source_note && (
        <div className="mt-1.5 text-[11px] italic text-muted-foreground">
          {spec.source_note}
        </div>
      )}
    </figure>
  );
}

function gradId(prefix: string, i: number) { return `${prefix}-g-${i}`; }

function GradientDefs({ prefix, count, vertical = true }: { prefix: string; count: number; vertical?: boolean }) {
  return (
    <defs>
      {Array.from({ length: count }).map((_, i) => (
        <linearGradient key={i} id={gradId(prefix, i)} x1="0" y1="0" x2={vertical ? 0 : 1} y2={vertical ? 1 : 0}>
          <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.95} />
          <stop offset="100%" stopColor={COLORS_DARK[i % COLORS_DARK.length]} stopOpacity={0.85} />
        </linearGradient>
      ))}
    </defs>
  );
}

function renderChart(spec: ChartSpec, series: string[], unit: string, prefix: string): React.ReactElement {
  const t = spec.type;

  if (t === 'pie') {
    const valueKey = series[0] || 'value';
    const data = spec.data.map((d) => ({ name: String(d.x ?? ''), value: Number(d[valueKey] ?? 0) }));
    const total = data.reduce((s, d) => s + (d.value || 0), 0);
    return (
      <PieChart>
        <GradientDefs prefix={prefix} count={data.length} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          outerRadius="78%"
          innerRadius="46%"
          stroke="oklch(0.16 0.01 260)"
          strokeWidth={2}
          paddingAngle={1}
          label={(p: { value?: number }) => total > 0 && p.value !== undefined ? `${Math.round((p.value / total) * 100)}%` : ''}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={`url(#${gradId(prefix, i)})`} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={TT}
          labelStyle={TT_LABEL}
          itemStyle={TT_ITEM}
          cursor={false}
          formatter={(v: unknown) => `${fmt(v)}${spec.y_unit || ''}`}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="square"
          iconSize={9}
          formatter={(value: string) => <span style={{ color: 'oklch(0.85 0.01 260)' }}>{value}</span>}
        />
      </PieChart>
    );
  }

  if (t === 'horizontal-bar') {
    return (
      <BarChart data={spec.data} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
        <GradientDefs prefix={prefix} count={series.length} vertical={false} />
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} label={spec.x_label ? { value: spec.x_label + unit, position: 'insideBottom', offset: -2, fill: 'oklch(0.65 0.01 260)', fontSize: 11 } : undefined} />
        <YAxis type="category" dataKey="x" tick={AXIS_TICK} width={75} />
        <Tooltip contentStyle={TT} labelStyle={TT_LABEL} itemStyle={TT_ITEM} cursor={false} formatter={(v: unknown) => `${fmt(v)}${spec.y_unit || ''}`} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s, i) => (
          <Bar key={s} dataKey={s} fill={`url(#${gradId(prefix, i)})`} radius={0} />
        ))}
      </BarChart>
    );
  }

  if (t === 'line') {
    return (
      <LineChart data={spec.data} margin={{ top: 5, right: 20, left: 5, bottom: 25 }}>
        <GradientDefs prefix={prefix} count={series.length} />
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="x" tick={AXIS_TICK} label={spec.x_label ? { value: spec.x_label, position: 'insideBottom', offset: -10, fill: 'oklch(0.65 0.01 260)', fontSize: 11 } : undefined} />
        <YAxis tick={AXIS_TICK} label={spec.y_label ? { value: spec.y_label + unit, angle: -90, position: 'insideLeft', fill: 'oklch(0.65 0.01 260)', fontSize: 11 } : undefined} />
        <Tooltip contentStyle={TT} labelStyle={TT_LABEL} itemStyle={TT_ITEM} cursor={{ stroke: 'oklch(0.40 0.01 260)', strokeDasharray: '3 3' }} formatter={(v: unknown) => `${fmt(v)}${spec.y_unit || ''}`} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s, i) => (
          <Line key={s} type="monotone" dataKey={s} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3, fill: COLORS[i % COLORS.length], stroke: 'none' }} />
        ))}
      </LineChart>
    );
  }

  // bar or stacked-bar
  const stacked = t === 'stacked-bar';
  return (
    <BarChart data={spec.data} margin={{ top: 5, right: 20, left: 5, bottom: 25 }}>
      <GradientDefs prefix={prefix} count={series.length} />
      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
      <XAxis dataKey="x" tick={AXIS_TICK} label={spec.x_label ? { value: spec.x_label, position: 'insideBottom', offset: -10, fill: 'oklch(0.65 0.01 260)', fontSize: 11 } : undefined} />
      <YAxis tick={AXIS_TICK} label={spec.y_label ? { value: spec.y_label + unit, angle: -90, position: 'insideLeft', fill: 'oklch(0.65 0.01 260)', fontSize: 11 } : undefined} />
      <Tooltip contentStyle={TT} labelStyle={TT_LABEL} itemStyle={TT_ITEM} cursor={false} formatter={(v: unknown) => `${fmt(v)}${spec.y_unit || ''}`} />
      {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
      {series.map((s, i) => (
        <Bar
          key={s}
          dataKey={s}
          fill={`url(#${gradId(prefix, i)})`}
          stackId={stacked ? 'a' : undefined}
          radius={0}
        />
      ))}
    </BarChart>
  );
}

/**
 * Parse a `chart` fenced-code-block payload. Returns null on malformed JSON.
 */
export function parseChartSpec(raw: string): ChartSpec | null {
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || !obj.type || !Array.isArray(obj.data)) return null;
    return obj as ChartSpec;
  } catch {
    return null;
  }
}
