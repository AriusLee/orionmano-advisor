'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { apiJson } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatCard, type StatTone } from '@/components/ui/stat-card';
import { SectionLabel } from '@/components/ui/section-label';
import {
  Loader2, TrendingUp, Target, Globe2, Compass, Users, Sparkles, MapPin,
  FileText, BarChart3, Activity, Zap, Layers,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, LabelList, Cell,
} from 'recharts';
import { useId } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { ChartBlock, parseChartSpec, type ChartSpec } from './chart-block';
import { MARKDOWN_COMPONENTS } from './section-preview';

const COLORS = [
  'oklch(0.75 0.15 175)',
  'oklch(0.65 0.15 250)',
  'oklch(0.70 0.12 140)',
  'oklch(0.60 0.18 300)',
  'oklch(0.55 0.15 260)',
  'oklch(0.70 0.15 50)',
  'oklch(0.65 0.18 30)',
];
const COLORS_DARK = [
  'oklch(0.55 0.14 175)',
  'oklch(0.45 0.14 250)',
  'oklch(0.50 0.11 140)',
  'oklch(0.42 0.16 300)',
  'oklch(0.38 0.14 260)',
  'oklch(0.50 0.14 50)',
  'oklch(0.46 0.16 30)',
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

interface ReportSection {
  section_key: string;
  section_title: string;
  content: string | null;
}

interface Report {
  id: string;
  report_type: string;
  status: string;
  sections: ReportSection[];
}

// ───────────────── text-cleaning utilities ─────────────────

const FOOTNOTE_RE = /\[\^\d+\]/g;
const CITE_TAG_RE = /<cite[^>]*\/>/gi;
const BR_RE = /<br\s*\/?\s*>/gi;
const BOLD_RE = /\*\*/g;
const HEADING_HASH_RE = /^#+\s+/;

/** Strip markdown bold, <br>, citation markers, footnote refs from a label. */
function cleanText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(FOOTNOTE_RE, '')
    .replace(CITE_TAG_RE, '')
    .replace(BR_RE, ' · ')
    .replace(BOLD_RE, '')
    .replace(HEADING_HASH_RE, '')
    .replace(/[*_`]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Same as cleanText but joins multiline strings with a space. */
function cleanInline(raw: string): string {
  return cleanText(raw.replace(/\n+/g, ' '));
}

/** Strip the trailing GFM footnote definition block from section content. */
function stripFootnoteBlock(content: string): string {
  const idx = content.search(/^\[\^\d+\]:/m);
  return idx >= 0 ? content.slice(0, idx).trimEnd() : content;
}

/**
 * Shorten a peer/company label for charts. Removes parenthetical suffixes,
 * fiscal-year notes, and clamps length.
 *   "**Activision Blizzard (King)**<br>(FY Dec 2023)" → "Activision Blizzard"
 */
function shortPeerName(raw: string, maxLen = 26): string {
  const cleaned = cleanInline(raw);
  // Drop everything from first parenthesis or " - " onwards
  const trimmed = cleaned
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s+·.*$/, '')
    .replace(/\s+-\s+(FY|Q[1-4]|Year).*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen - 1).trimEnd() + '…';
}

const CHART_BLOCK_RE = /```chart\s*\n([\s\S]*?)```/g;

function extractChartSpecs(content: string): ChartSpec[] {
  const specs: ChartSpec[] = [];
  const re = new RegExp(CHART_BLOCK_RE.source, 'g');
  let m;
  while ((m = re.exec(content)) !== null) {
    const spec = parseChartSpec(m[1].trim());
    if (spec) specs.push(spec);
  }
  return specs;
}

function parseNumber(raw: string): number | null {
  if (!raw) return null;
  const s = cleanText(raw).replace(/[A-Za-z$€£¥%,\s]/g, '');
  if (!s) return null;
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

function parseMarkdownTables(content: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    if (lines[i].includes('|') && lines[i + 1] && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const splitRow = (line: string) => {
        const parts = line.split('|');
        if (parts[0].trim() === '') parts.shift();
        if (parts.length && parts[parts.length - 1].trim() === '') parts.pop();
        return parts.map((c) => c.trim());
      };
      const headers = splitRow(lines[i]);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        const cells = splitRow(lines[i]);
        if (cells.some((c) => c.length > 0)) rows.push(cells);
        i++;
      }
      if (rows.length > 0) tables.push({ headers, rows });
    } else {
      i++;
    }
  }
  return tables;
}

// ───────────────── KPI parsing ─────────────────

interface ParsedKpis {
  latestSize?: string;
  latestUnit?: string;
  latestYear?: string;
  forecastSize?: string;
  forecastUnit?: string;
  forecastYear?: string;
  historicalCagr?: number;
  forecastCagr?: number;
}

function parseKpis(content: string | null): ParsedKpis {
  if (!content) return {};
  const text = cleanText(content);
  const result: ParsedKpis = {};

  const valueMatch = text.match(
    /(?:valued at|was|reached)\s+(?:approximately\s+)?(USD|RMB|HKD|EUR|GBP|MYR|SGD|JPY|KRW)?\s*([\d,.]+)\s*(million|billion|bn|m|trillion|tn)?\s*(?:in|by)?\s*(\d{4})/i,
  );
  if (valueMatch) {
    result.latestSize = valueMatch[2];
    result.latestUnit = `${valueMatch[1] || ''} ${valueMatch[3] || ''}`.trim();
    result.latestYear = valueMatch[4];
  }

  const forecastMatch = text.match(
    /(?:projected to reach|expected to reach|forecast to (?:reach|expand to)|expand to|grow to|reach)\s+(USD|RMB|HKD|EUR|GBP|MYR|SGD|JPY|KRW)?\s*([\d,.]+)\s*(million|billion|bn|m|trillion|tn)?\s*by\s*(\d{4})/i,
  );
  if (forecastMatch) {
    result.forecastSize = forecastMatch[2];
    result.forecastUnit = `${forecastMatch[1] || ''} ${forecastMatch[3] || ''}`.trim();
    result.forecastYear = forecastMatch[4];
  }

  const cagrMatches = [...text.matchAll(/CAGR of\s+([\d.]+)\s*%\s*(?:over|from|for)?\s*(?:the\s+)?(\d{4})\s*[-–]\s*(\d{4})/gi)];
  if (cagrMatches.length === 1) {
    result.forecastCagr = parseFloat(cagrMatches[0][1]);
  } else if (cagrMatches.length >= 2) {
    result.historicalCagr = parseFloat(cagrMatches[0][1]);
    result.forecastCagr = parseFloat(cagrMatches[1][1]);
  }

  return result;
}

// ───────────────── table → chart fallback ─────────────────

function tableToChart(t: ParsedTable, titleHint: string): ChartSpec | null {
  if (t.rows.length < 2) return null;
  const numericColumnIdxs: number[] = [];
  for (let c = 1; c < t.headers.length; c++) {
    let numericCount = 0;
    for (const row of t.rows) {
      if (parseNumber(row[c] || '') !== null) numericCount++;
    }
    if (numericCount >= Math.ceil(t.rows.length / 2)) numericColumnIdxs.push(c);
  }
  if (numericColumnIdxs.length === 0) return null;

  const primaryIdx = numericColumnIdxs[0];
  const seriesName = cleanText(t.headers[primaryIdx] || 'Value');
  const data: Array<Record<string, string | number>> = [];

  for (const row of t.rows) {
    const x = cleanText(row[0] || '');
    const v = parseNumber(row[primaryIdx] || '');
    if (!x || v === null) continue;
    data.push({ x, [seriesName]: v });
  }
  if (data.length < 2) return null;

  const looksLikeYears = data.every((d) => /^\d{4}/.test(String(d.x)));
  const type: ChartSpec['type'] = looksLikeYears ? 'bar' : 'horizontal-bar';

  return {
    type,
    title: titleHint,
    x_label: looksLikeYears ? 'Year' : undefined,
    y_label: seriesName,
    data,
    series: [seriesName],
  };
}

// ───────────────── peer benchmarking ─────────────────

interface PeerRow {
  name: string;          // short, chart-friendly
  fullName: string;      // cleaned but full
  revenue?: number;
  revenueUnit?: string;
  revenueCagr?: number;
  ebitdaMargin?: number;
  patMargin?: number;
  yoyGrowth?: number;
  roe?: number;
}

function parsePeerTable(content: string | null): PeerRow[] {
  if (!content) return [];
  const tables = parseMarkdownTables(stripFootnoteBlock(content));
  const candidate = tables
    .filter((t) => t.headers.some((h) => /revenue|margin|ebitda|pat|roe|roce/i.test(h)))
    .sort((a, b) => b.rows.length - a.rows.length)[0];
  if (!candidate) return [];

  const headerLower = candidate.headers.map((h) => h.toLowerCase());
  const find = (re: RegExp) => headerLower.findIndex((h) => re.test(h));
  const idxName = 0;
  const idxRev = find(/revenue(?!.*cagr)/);
  const idxRevCagr = find(/revenue.*cagr|cagr.*revenue/);
  const idxEbitda = find(/ebitda.*margin/);
  const idxPat = find(/pat.*margin|net.*margin/);
  const idxYoy = find(/yo[yY]|growth/);
  const idxRoe = find(/roe|roce/);

  const rows: PeerRow[] = [];
  for (const r of candidate.rows) {
    const fullName = cleanInline(r[idxName] || '');
    if (!fullName || /^total|^average|^aggregate/i.test(fullName)) continue;
    const peer: PeerRow = { name: shortPeerName(r[idxName] || ''), fullName };
    if (idxRev >= 0) {
      peer.revenue = parseNumber(r[idxRev]) ?? undefined;
      const unitMatch = (r[idxRev] || '').match(/(USD|RMB|EUR|GBP|HKD|MYR|SGD)\s*(million|billion|bn|m|trillion|tn)?/i);
      if (unitMatch) peer.revenueUnit = `${unitMatch[1]} ${unitMatch[2] || ''}`.trim();
    }
    if (idxRevCagr >= 0) peer.revenueCagr = parseNumber(r[idxRevCagr]) ?? undefined;
    if (idxEbitda >= 0) peer.ebitdaMargin = parseNumber(r[idxEbitda]) ?? undefined;
    if (idxPat >= 0) peer.patMargin = parseNumber(r[idxPat]) ?? undefined;
    if (idxYoy >= 0) peer.yoyGrowth = parseNumber(r[idxYoy]) ?? undefined;
    if (idxRoe >= 0) peer.roe = parseNumber(r[idxRoe]) ?? undefined;
    rows.push(peer);
  }
  return rows;
}

// ───────────────── capability matrix ─────────────────

interface CapabilityCell {
  level: 'strong' | 'limited' | 'negligible' | 'unknown';
}

function parseCapabilityMatrix(content: string | null) {
  if (!content) return null;
  const tables = parseMarkdownTables(stripFootnoteBlock(content));
  const candidate = tables.find((t) => {
    if (t.rows.length < 2 || t.headers.length < 3) return false;
    const sample = t.rows.flatMap((r) => r.slice(1)).join(' ').toLowerCase();
    return /strong|limited|negligible|present|absent/.test(sample);
  });
  if (!candidate) return null;

  const capabilities = candidate.headers.slice(1).map((h) => cleanText(h));
  const players: string[] = [];
  const cells: Record<string, Record<string, CapabilityCell['level']>> = {};

  for (const r of candidate.rows) {
    const player = cleanText(r[0] || '');
    if (!player) continue;
    players.push(player);
    cells[player] = {};
    capabilities.forEach((cap, i) => {
      const raw = (r[i + 1] || '').toLowerCase();
      let level: CapabilityCell['level'] = 'unknown';
      if (/strong|✓|✔|yes/.test(raw)) level = 'strong';
      else if (/limited|partial/.test(raw)) level = 'limited';
      else if (/negligible|none|absent|✗|✘|no/.test(raw)) level = 'negligible';
      cells[player][cap] = level;
    });
  }
  if (players.length === 0) return null;
  return { players, capabilities, cells };
}

// ───────────────── verdict synthesis ─────────────────

function synthesizeOutlook(forecastCagr?: number, delta?: number): { word: string; tone: StatTone; sub: string; icon: typeof Activity } {
  if (forecastCagr === undefined) return { word: 'In Review', tone: 'muted', sub: 'CAGR pending', icon: Activity };
  let word = 'Maturing';
  let tone: StatTone = 'primary';
  let icon: typeof Activity = Activity;
  if (forecastCagr >= 15) { word = 'High Growth'; tone = 'positive'; icon = Zap; }
  else if (forecastCagr >= 7) { word = 'Growth Stage'; tone = 'positive'; icon = TrendingUp; }
  else if (forecastCagr >= 3) { word = 'Moderate Growth'; tone = 'primary'; icon = Activity; }
  else { word = 'Maturing'; tone = 'warn'; icon = Activity; }

  const sub = delta === undefined
    ? `${forecastCagr}% forecast CAGR`
    : delta >= 1.5 ? 'Accelerating vs historical'
    : delta <= -1.5 ? 'Decelerating vs historical'
    : 'Steady vs historical';

  return { word, tone, sub, icon };
}

// ───────────────── small components ─────────────────

function ChartCard({
  title,
  icon: Icon,
  children,
  empty,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="py-10 text-center text-xs italic text-muted-foreground">No data parsed.</div>
        ) : children}
      </CardContent>
    </Card>
  );
}

function CagrDeltaPanel({ historical, forecast }: { historical?: number; forecast?: number }) {
  const gid = useId().replace(/[:]/g, '');
  const data: Array<Record<string, string | number>> = [];
  if (historical !== undefined) data.push({ x: 'Historical', value: historical });
  if (forecast !== undefined) data.push({ x: 'Forecast', value: forecast });
  if (data.length === 0) return <div className="py-10 text-center text-xs italic text-muted-foreground">No CAGR data parsed.</div>;
  const delta = (historical !== undefined && forecast !== undefined) ? forecast - historical : null;
  const tone = delta === null ? 'neutral' : delta >= 1.5 ? 'up' : delta <= -1.5 ? 'down' : 'flat';
  const toneClass = tone === 'up' ? 'text-emerald-400' : tone === 'down' ? 'text-rose-400' : 'text-muted-foreground';

  return (
    <>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 14, right: 12, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id={`${gid}-hist`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS[1]} stopOpacity={0.95} />
                <stop offset="100%" stopColor={COLORS_DARK[1]} stopOpacity={0.85} />
              </linearGradient>
              <linearGradient id={`${gid}-fwd`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS[0]} stopOpacity={0.95} />
                <stop offset="100%" stopColor={COLORS_DARK[0]} stopOpacity={0.85} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="x" tick={AXIS_TICK} />
            <YAxis tick={AXIS_TICK} unit="%" />
            <Tooltip contentStyle={TT} labelStyle={TT_LABEL} itemStyle={TT_ITEM} cursor={false} formatter={(v: unknown) => `${v}%`} />
            <Bar dataKey="value" name="CAGR" radius={0}>
              {data.map((_, i) => (
                <Cell key={i} fill={i === 0 ? `url(#${gid}-hist)` : `url(#${gid}-fwd)`} />
              ))}
              <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: 'oklch(0.85 0.01 260)' }} formatter={(v: unknown) => `${v}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {delta !== null && (
        <div className="mt-2 text-center text-xs">
          <span className={toneClass}>{delta > 0 ? '+' : ''}{delta.toFixed(1)} pp</span>{' '}
          <span className="text-muted-foreground">forecast vs historical</span>
        </div>
      )}
    </>
  );
}

function PeerBar({ peers, valueKey, label, unit, colorIdx = 0 }: { peers: PeerRow[]; valueKey: keyof PeerRow; label: string; unit?: string; colorIdx?: number }) {
  const gid = useId().replace(/[:]/g, '');
  const data = peers
    .filter((p) => typeof p[valueKey] === 'number')
    .map((p) => ({ x: p.name, value: p[valueKey] as number }))
    .sort((a, b) => (b.value as number) - (a.value as number))
    .slice(0, 8);
  if (data.length === 0) return (
    <div className="py-10 text-center text-xs italic text-muted-foreground">No data for {label}.</div>
  );
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 4 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={COLORS_DARK[colorIdx % COLORS_DARK.length]} stopOpacity={0.85} />
                <stop offset="100%" stopColor={COLORS[colorIdx % COLORS.length]} stopOpacity={0.95} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} unit={unit} />
            <YAxis type="category" dataKey="x" tick={{ ...AXIS_TICK, fontSize: 10 }} width={120} interval={0} />
            <Tooltip contentStyle={TT} labelStyle={TT_LABEL} itemStyle={TT_ITEM} cursor={false} formatter={(v: unknown) => `${v}${unit || ''}`} />
            <Bar dataKey="value" name={label} fill={`url(#${gid})`} radius={0}>
              <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: 'oklch(0.85 0.01 260)' }} formatter={(v: unknown) => `${v}${unit || ''}`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PeerScatter({ peers }: { peers: PeerRow[] }) {
  const data = peers
    .filter((p) => typeof p.revenue === 'number' && (typeof p.ebitdaMargin === 'number' || typeof p.patMargin === 'number'))
    .map((p) => ({
      x: p.revenue as number,
      y: (p.ebitdaMargin ?? p.patMargin) as number,
      z: 240,
      name: p.name,
    }));
  if (data.length < 2) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Target className="h-4 w-4 text-primary" /> Peer Positioning — Scale × Margin
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 18, right: 32, left: 16, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis type="number" dataKey="x" tick={AXIS_TICK} name="Revenue" label={{ value: 'Revenue', position: 'insideBottom', offset: -10, fill: 'oklch(0.65 0.01 260)', fontSize: 11 }} />
              <YAxis type="number" dataKey="y" tick={AXIS_TICK} unit="%" label={{ value: 'Margin (%)', angle: -90, position: 'insideLeft', fill: 'oklch(0.65 0.01 260)', fontSize: 11 }} />
              <ZAxis type="number" dataKey="z" range={[120, 280]} />
              <Tooltip
                cursor={{ stroke: 'oklch(0.40 0.01 260)', strokeDasharray: '3 3' }}
                contentStyle={TT}
                labelStyle={TT_LABEL}
                itemStyle={TT_ITEM}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((v: any, n: any) => n === 'Revenue' ? `${v}` : `${v}%`) as any}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={((_l: any, payload: any) => payload?.[0]?.payload?.name || '') as any}
              />
              <Scatter data={data} fill={COLORS[0]} fillOpacity={0.8}>
                <LabelList
                  dataKey="name"
                  position="top"
                  offset={10}
                  style={{ fontSize: 10, fill: 'oklch(0.92 0.01 260)', fontWeight: 500 }}
                />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-[11px] italic text-muted-foreground">
          x = revenue (latest reported) · y = EBITDA or PAT margin · bubble = relative scale
        </div>
      </CardContent>
    </Card>
  );
}

function CapabilityHeatmap({ matrix }: { matrix: NonNullable<ReturnType<typeof parseCapabilityMatrix>> }) {
  const colorFor = (level: CapabilityCell['level']) => {
    if (level === 'strong') return 'bg-emerald-500/70 ring-emerald-400/30';
    if (level === 'limited') return 'bg-amber-500/60 ring-amber-400/30';
    if (level === 'negligible') return 'bg-rose-500/40 ring-rose-400/30';
    return 'bg-muted/30 ring-border/50';
  };
  const labelFor = (level: CapabilityCell['level']) => {
    if (level === 'strong') return '●';
    if (level === 'limited') return '◐';
    if (level === 'negligible') return '○';
    return '·';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Compass className="h-4 w-4 text-primary" /> Capability Matrix
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground"> </th>
                {matrix.capabilities.map((c) => (
                  <th
                    key={c}
                    className="px-2 py-1.5 text-left text-[11px] font-medium text-muted-foreground"
                    style={{ minWidth: 100, maxWidth: 140 }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.players.map((p) => (
                <tr key={p} className="hover:bg-accent/30 transition-colors">
                  <td className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-foreground">{p}</td>
                  {matrix.capabilities.map((c) => {
                    const level = matrix.cells[p][c];
                    return (
                      <td key={c} className="px-1 py-1">
                        <div className={cn('flex h-7 items-center justify-center rounded ring-1 text-sm text-white', colorFor(level))}>
                          {labelFor(level)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/70"></span> Strong presence</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500/60"></span> Limited</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500/40"></span> Negligible</span>
        </div>
      </CardContent>
    </Card>
  );
}

function FullReportModal({ report, open, onOpenChange }: { report: Report; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Full Industry Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-8">
          {report.sections
            .filter((s) => s.section_key !== 'references')
            .map((s) => (
              <section key={s.section_key}>
                <h2 className="mb-2 border-b border-border pb-1.5 text-base font-semibold">{s.section_title}</h2>
                <div className="prose prose-invert prose-sm max-w-none report-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>{s.content || ''}</ReactMarkdown>
                </div>
              </section>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────── main ─────────────────

interface Props {
  companyId: string;
  reportType?: string;
}

export function IndustryReportDashboard({ companyId, reportType = 'industry_report' }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFull, setShowFull] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      const reports = await apiJson<Array<{ id: string; report_type: string; status: string }>>(
        `/companies/${companyId}/reports`,
      );
      const match = reports.find(
        (r) => r.report_type === reportType && (r.status === 'draft' || r.status === 'approved'),
      );
      if (match) {
        const detail = await apiJson<Report>(`/companies/${companyId}/reports/${match.id}`);
        setReport(detail);
      }
    } catch {
      // swallow
    } finally {
      setLoading(false);
    }
  }, [companyId, reportType]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const derived = useMemo(() => {
    if (!report) return null;
    const findSection = (key: string) => report.sections.find((s) => s.section_key === key);

    const marketSize = findSection('market_size_trajectory') || findSection('industry_overview');
    const geographic = findSection('geographic_distribution');
    const segments = findSection('market_segments');
    const competitiveBench = findSection('competitive_benchmarking');
    const competitiveMatrix = findSection('competitive_landscape_matrix') || findSection('competitive_landscape');

    const kpis = parseKpis(marketSize?.content || null);

    const trajectoryCharts = marketSize ? extractChartSpecs(marketSize.content || '') : [];
    let trajectoryFallback: ChartSpec | null = null;
    if (trajectoryCharts.length === 0 && marketSize?.content) {
      const tables = parseMarkdownTables(stripFootnoteBlock(marketSize.content));
      const yearTable = tables.find((t) => /year/i.test(t.headers[0] || ''));
      if (yearTable) trajectoryFallback = tableToChart(yearTable, 'Market Size by Year');
    }

    const geoCharts = geographic ? extractChartSpecs(geographic.content || '') : [];
    let geoFallback: ChartSpec | null = null;
    if (geoCharts.length === 0 && geographic?.content) {
      const tables = parseMarkdownTables(stripFootnoteBlock(geographic.content));
      const regionTable = tables.find((t) => /region|geo|country/i.test(t.headers[0] || ''));
      if (regionTable) {
        const shareIdx = regionTable.headers.findIndex((h) => /share/i.test(h));
        if (shareIdx > 0) {
          const data = regionTable.rows
            .map((r) => ({ x: cleanText(r[0] || ''), Share: parseNumber(r[shareIdx]) }))
            .filter((d) => d.x && d.Share !== null && !/^global|^total|^worldwide/i.test(d.x as string)) as Array<Record<string, string | number>>;
          if (data.length >= 2) {
            geoFallback = {
              type: 'horizontal-bar',
              title: 'Geographic Share',
              data, series: ['Share'], y_unit: '%',
            };
          }
        } else {
          geoFallback = tableToChart(regionTable, 'Geographic Share');
        }
      }
    }

    const segmentCharts = segments ? extractChartSpecs(segments.content || '') : [];
    let segmentFallback: ChartSpec | null = null;
    if (segmentCharts.length === 0 && segments?.content) {
      const tables = parseMarkdownTables(stripFootnoteBlock(segments.content));
      const shareTable = tables.find((t) => t.headers.some((h) => /share/i.test(h)));
      const candidate = shareTable || tables[0];
      if (candidate) {
        const shareIdx = candidate.headers.findIndex((h) => /share/i.test(h));
        if (shareIdx > 0) {
          const data = candidate.rows
            .map((r) => ({ x: cleanText(r[0] || ''), Share: parseNumber(r[shareIdx]) }))
            .filter((d) => d.x && d.Share !== null) as Array<Record<string, string | number>>;
          if (data.length >= 2) {
            segmentFallback = {
              type: 'pie',
              title: 'Segment Share',
              data, series: ['Share'], y_unit: '%',
            };
          }
        }
      }
    }

    const benchCharts = competitiveBench ? extractChartSpecs(competitiveBench.content || '') : [];
    const peers = parsePeerTable(competitiveBench?.content || null);
    const matrix = parseCapabilityMatrix(competitiveMatrix?.content || null);

    return {
      kpis,
      trajectoryCharts: trajectoryCharts.length > 0 ? trajectoryCharts : (trajectoryFallback ? [trajectoryFallback] : []),
      geoCharts: geoCharts.length > 0 ? geoCharts : (geoFallback ? [geoFallback] : []),
      segmentCharts: segmentCharts.length > 0 ? segmentCharts : (segmentFallback ? [segmentFallback] : []),
      benchCharts,
      peers,
      matrix,
    };
  }, [report]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report || !derived) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">No report available.</CardContent>
      </Card>
    );
  }

  const { kpis, trajectoryCharts, geoCharts, segmentCharts, benchCharts, peers, matrix } = derived;

  const cagrDelta = (kpis.historicalCagr !== undefined && kpis.forecastCagr !== undefined)
    ? kpis.forecastCagr - kpis.historicalCagr
    : undefined;

  const outlook = synthesizeOutlook(kpis.forecastCagr, cagrDelta);

  // Top region/segment from share-table fallbacks
  const topRegion = geoCharts[0]?.data?.[0];
  const topSegment = segmentCharts[0]?.data?.[0];
  const sortedPeers = [...peers].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0));
  const scaleLeader = sortedPeers[0]?.name;

  const cagrTone: StatTone = cagrDelta === undefined ? 'primary'
    : cagrDelta >= 1.5 ? 'positive'
    : cagrDelta <= -1.5 ? 'danger'
    : 'primary';

  return (
    <div className="space-y-8 stagger-children">
      {/* Industry Snapshot — StatCard row */}
      <section>
        <SectionLabel icon={Sparkles}>Industry Snapshot</SectionLabel>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={outlook.icon}
            label="Industry Outlook"
            value={outlook.word}
            caption={outlook.sub}
            tone={outlook.tone}
          />
          <StatCard
            icon={TrendingUp}
            label="Market Size"
            value={kpis.latestSize ? `${kpis.latestUnit ? kpis.latestUnit + ' ' : ''}${kpis.latestSize}` : '—'}
            caption={kpis.latestYear && kpis.forecastSize && kpis.forecastYear
              ? `→ ${kpis.forecastSize} by ${kpis.forecastYear}`
              : kpis.latestYear ? `as of ${kpis.latestYear}` : undefined}
          />
          <StatCard
            icon={Sparkles}
            label="Forecast CAGR"
            value={kpis.forecastCagr !== undefined ? `${kpis.forecastCagr}%` : '—'}
            caption={cagrDelta !== undefined
              ? `${cagrDelta >= 0 ? '+' : ''}${cagrDelta.toFixed(1)}pp vs historical`
              : (kpis.historicalCagr !== undefined ? `Historical ${kpis.historicalCagr}%` : undefined)}
            tone={cagrTone}
          />
          <StatCard
            icon={Users}
            label="Peer Coverage"
            value={peers.length > 0 ? `${peers.length} peers` : '—'}
            caption={scaleLeader ? `Scale leader: ${scaleLeader}` : undefined}
          />
        </div>
      </section>

      {/* Concentration Snapshot — only when we have parsed top region or top segment */}
      {(topRegion?.Share !== undefined || topSegment?.Share !== undefined) && (
        <section>
          <SectionLabel icon={Globe2}>Concentration</SectionLabel>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {topRegion && topRegion.x && topRegion.Share !== undefined && (
              <StatCard
                icon={MapPin}
                label="Top Region"
                value={cleanText(String(topRegion.x))}
                caption={`${topRegion.Share}% of global market`}
              />
            )}
            {topSegment && topSegment.x && topSegment.Share !== undefined && (
              <StatCard
                icon={Compass}
                label="Top Segment"
                value={cleanText(String(topSegment.x))}
                caption={`${topSegment.Share}% of total revenue`}
              />
            )}
          </div>
        </section>
      )}

      {/* Market Trajectory — full width hero */}
      {trajectoryCharts.length > 0 && (
        <section>
          <SectionLabel icon={TrendingUp}>Market Trajectory</SectionLabel>
          <div className="mt-4">
            <ChartCard title="Market Size Over Time" icon={TrendingUp}>
              <div className="-my-2">
                {trajectoryCharts.map((spec, i) => <ChartBlock key={i} spec={spec} />)}
              </div>
            </ChartCard>
          </div>
        </section>
      )}

      {/* Market Dynamics — 2-col: CAGR Delta + Geographic */}
      <section>
        <SectionLabel icon={BarChart3}>Market Dynamics</SectionLabel>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChartCard title="CAGR Delta" icon={BarChart3}>
            <CagrDeltaPanel historical={kpis.historicalCagr} forecast={kpis.forecastCagr} />
          </ChartCard>
          <ChartCard title="Geographic Split" icon={MapPin} empty={geoCharts.length === 0}>
            {geoCharts.length > 0 && <div className="-my-2">{geoCharts.map((spec, i) => <ChartBlock key={i} spec={spec} />)}</div>}
          </ChartCard>
        </div>
      </section>

      {/* Segment Mix — full row, 2-col internal when 2+ specs */}
      {segmentCharts.length > 0 && (
        <section>
          <SectionLabel icon={Layers}>Segment Mix</SectionLabel>
          <div className="mt-4">
            <ChartCard title="Revenue Composition by Segment" icon={Compass}>
              <div className={cn(
                'grid gap-4',
                segmentCharts.length >= 2 && 'md:grid-cols-2',
              )}>
                {segmentCharts.map((spec, i) => <ChartBlock key={i} spec={spec} />)}
              </div>
            </ChartCard>
          </div>
        </section>
      )}

      {/* Competitive Landscape */}
      {(peers.length > 0 || benchCharts.length > 0) && (
        <section>
          <SectionLabel icon={Users}>Competitive Landscape</SectionLabel>
          <div className="mt-4 space-y-4">
            {peers.length > 0 && (
              <ChartCard title="Peer Benchmarking" icon={Users}>
                <div className="grid gap-6 md:grid-cols-2">
                  <PeerBar peers={peers} valueKey="revenue" label={`Revenue${peers[0]?.revenueUnit ? ` (${peers[0]?.revenueUnit})` : ''}`} colorIdx={0} />
                  <PeerBar peers={peers} valueKey="ebitdaMargin" label="EBITDA Margin" unit="%" colorIdx={1} />
                </div>
              </ChartCard>
            )}

            {benchCharts.length > 0 && (
              <ChartCard title="Additional Peer Charts" icon={BarChart3}>
                <div className={cn('grid gap-4', benchCharts.length >= 2 && 'md:grid-cols-2')}>
                  {benchCharts.map((spec, i) => <ChartBlock key={i} spec={spec} />)}
                </div>
              </ChartCard>
            )}

            <PeerScatter peers={peers} />
          </div>
        </section>
      )}

      {/* Capability Matrix */}
      {matrix && (
        <section>
          <SectionLabel icon={Target}>Capability Matrix</SectionLabel>
          <div className="mt-4">
            <CapabilityHeatmap matrix={matrix} />
          </div>
        </section>
      )}

      {/* Full-report modal trigger */}
      <div className="flex justify-center pt-2">
        <Button variant="outline" size="sm" className="cursor-pointer gap-2" onClick={() => setShowFull(true)}>
          <FileText className="h-3.5 w-3.5" /> Read full report
        </Button>
      </div>
      <FullReportModal report={report} open={showFull} onOpenChange={setShowFull} />
    </div>
  );
}
