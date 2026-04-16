'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { apiJson } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Shield, DollarSign, Calendar, AlertTriangle, Clock, CheckCircle2, XCircle, HelpCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface ScorecardItem {
  dimension: string;
  rating: 'ready' | 'conditional' | 'not_ready' | 'info_required';
  finding: string;
  actions: string;
}

interface WorkstreamItem {
  num: string;
  name: string;
  status: string;
  severity: string;
  cost: string;
  owner: string;
  timeline: string;
  phase: string;
}

interface CostItem {
  category: string;
  range: string;
  notes: string;
}

interface GanttItem {
  name: string;
  phases: boolean[]; // [immediate, pre-filing, filing, pre-roadshow]
}

// ─── Parsers ───

function parseScorecardItems(content: string): ScorecardItem[] {
  const items: ScorecardItem[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line.includes('|') || line.includes('---') || line.includes(':---')) continue;
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 4) continue;

    const dimText = cells[0].replace(/\*\*/g, '').replace(/^\d+\.\s*/, '').trim();
    if (!dimText || dimText.toLowerCase() === 'dimension') continue;

    const ratingCell = cells[1] || '';
    let rating: ScorecardItem['rating'] = 'info_required';
    if (ratingCell.includes('🟢') || (ratingCell.toLowerCase().includes('ready') && !ratingCell.toLowerCase().includes('not'))) rating = 'ready';
    else if (ratingCell.includes('🟡') || ratingCell.toLowerCase().includes('conditional')) rating = 'conditional';
    else if (ratingCell.includes('🔴') || ratingCell.toLowerCase().includes('not ready')) rating = 'not_ready';
    else if (ratingCell.includes('⚪') || ratingCell.toLowerCase().includes('information')) rating = 'info_required';

    items.push({
      dimension: dimText,
      rating,
      finding: cells[2]?.replace(/\*\*/g, '').trim() || '',
      actions: cells[3]?.replace(/\*\*/g, '').replace(/<br\s*\/?>/g, '\n').trim() || '',
    });
  }

  return items;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  // Try to cut at a sentence boundary
  const cut = text.slice(0, maxLen);
  const lastPeriod = cut.lastIndexOf('.');
  if (lastPeriod > maxLen * 0.5) return cut.slice(0, lastPeriod + 1);
  return cut.trim() + '…';
}

function parseOverallReadiness(content: string) {
  const result = { rating: '', timeEstimate: '', totalCost: '', recommendation: '' };
  const lines = content.split('\n');

  for (const line of lines) {
    const lower = line.toLowerCase();
    const value = line.split(':').slice(1).join(':').replace(/\*\*/g, '').trim();
    if (lower.includes('overall readiness rating') || lower.includes('overall readiness:')) result.rating = truncate(value, 40);
    else if (lower.includes('estimated time') || lower.includes('time to ipo')) result.timeEstimate = truncate(value, 40);
    else if (lower.includes('estimated total') || lower.includes('total remediation') || lower.includes('total estimated')) result.totalCost = truncate(value, 30);
    else if (lower.includes('go/no-go') || (lower.includes('recommendation') && !lower.includes('strategic'))) result.recommendation = truncate(value, 60);
  }

  return result;
}

function parseWorkstreams(content: string): WorkstreamItem[] {
  const items: WorkstreamItem[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line.includes('|') || line.includes('---') || line.includes(':---')) continue;
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 7) continue;

    const num = cells[0].replace(/\*\*/g, '').trim();
    if (!num || num === '#' || num.toLowerCase() === 'no') continue;

    items.push({
      num,
      name: cells[1]?.replace(/\*\*/g, '').trim() || '',
      status: cells[2]?.trim() || '',
      severity: cells[3]?.replace(/\*\*/g, '').trim() || '',
      cost: cells[4]?.replace(/\*\*/g, '').trim() || '',
      owner: cells[5]?.replace(/\*\*/g, '').trim() || '',
      timeline: cells[6]?.replace(/\*\*/g, '').trim() || '',
      phase: cells[7]?.replace(/\*\*/g, '').trim() || '',
    });
  }

  return items;
}

function parseCostSummary(content: string): { items: CostItem[]; total: string } {
  const items: CostItem[] = [];
  let total = '';

  // Find the cost summary section
  const costStart = content.toLowerCase().indexOf('cost summary');
  if (costStart === -1) return { items, total };

  const lines = content.slice(costStart).split('\n');
  for (const line of lines) {
    if (!line.includes('|') || line.includes('---') || line.includes(':---')) continue;
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;

    const cat = cells[0].replace(/\*\*/g, '').trim();
    if (!cat || cat.toLowerCase() === 'category') continue;

    const range = cells[1]?.replace(/\*\*/g, '').trim() || '';
    const notes = cells[2]?.replace(/\*\*/g, '').trim() || '';

    if (cat.toLowerCase().includes('total')) {
      total = range;
    } else {
      items.push({ category: cat, range, notes });
    }
  }

  return { items, total };
}

function parseGantt(content: string): GanttItem[] {
  const items: GanttItem[] = [];
  const codeStart = content.indexOf('```');
  if (codeStart === -1) return items;
  const codeEnd = content.indexOf('```', codeStart + 3);
  const block = content.slice(codeStart + 3, codeEnd === -1 ? undefined : codeEnd);

  const lines = block.split('\n');
  for (const line of lines) {
    if (!line.includes('|') || line.includes('Phase:') || line.includes('Timeline:') || line.includes('───')) continue;
    const parts = line.split('|').map(c => c.trim());
    if (parts.length < 5) continue;
    const name = parts[0].trim();
    if (!name) continue;

    items.push({
      name,
      phases: [
        parts[1]?.includes('█') || false,
        parts[2]?.includes('█') || false,
        parts[3]?.includes('█') || false,
        parts[4]?.includes('█') || false,
      ],
    });
  }

  return items;
}

function parseActionList(actions: string): string[] {
  // Split on numbered pattern "1. ", "2. ", etc. at start of string or newline
  const parts = actions.split(/(?:^|\n)\s*\d+\.\s+/).map(s => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;
  // Fallback: split by bullet markers or newlines
  return actions
    .split(/\n|(?:^|\s)[-•]\s+/)
    .map(p => p.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);
}

function parseDependencies(content: string): string[] {
  const deps: string[] = [];
  const depStart = content.toLowerCase().indexOf('key dependencies');
  if (depStart === -1) return deps;

  const lines = content.slice(depStart).split('\n');
  for (const line of lines) {
    const trimmed = line.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').trim();
    if (trimmed.startsWith('-') || /^\d/.test(line.trim())) {
      const clean = trimmed.replace(/^-\s*/, '').replace(/^\d+\.\s*/, '').trim();
      if (clean.length > 10) deps.push(clean);
    }
  }

  return deps;
}

// ─── Rating config ───

const RATING_CONFIG = {
  ready:         { rail: 'bg-emerald-500', railFade: 'bg-gradient-to-b from-emerald-500 via-emerald-500/60 to-transparent', bar: 'bg-gradient-to-r from-emerald-600/75 via-emerald-500/85 to-emerald-400/95', barRing: 'ring-emerald-400/35', badgeBg: 'bg-emerald-500/10', badgeText: 'text-emerald-400', badgeRing: 'ring-emerald-500/25', icon: CheckCircle2, label: 'Ready' },
  conditional:   { rail: 'bg-amber-500',   railFade: 'bg-gradient-to-b from-amber-500 via-amber-500/60 to-transparent',     bar: 'bg-gradient-to-r from-amber-600/75 via-amber-500/85 to-amber-300/95',     barRing: 'ring-amber-400/35',   badgeBg: 'bg-amber-500/10',   badgeText: 'text-amber-400',   badgeRing: 'ring-amber-500/25',   icon: Clock,        label: 'Conditional' },
  not_ready:     { rail: 'bg-red-500',     railFade: 'bg-gradient-to-b from-red-500 via-red-500/60 to-transparent',         bar: 'bg-gradient-to-r from-red-600/75 via-red-500/85 to-red-400/95',           barRing: 'ring-red-400/35',     badgeBg: 'bg-red-500/10',     badgeText: 'text-red-400',     badgeRing: 'ring-red-500/25',     icon: XCircle,      label: 'Not Ready' },
  info_required: { rail: 'bg-slate-400',   railFade: 'bg-gradient-to-b from-slate-400 via-slate-400/60 to-transparent',     bar: 'bg-gradient-to-r from-slate-600/70 via-slate-500/80 to-slate-400/90',     barRing: 'ring-slate-400/35',   badgeBg: 'bg-slate-500/10',   badgeText: 'text-slate-300',   badgeRing: 'ring-slate-500/25',   icon: HelpCircle,   label: 'Info Required' },
};

// Most serious → least serious. Drives scorecard grouping order.
const SEVERITY_ORDER: Array<ScorecardItem['rating']> = ['not_ready', 'conditional', 'info_required', 'ready'];
const SEVERITY_GROUP_LABEL: Record<ScorecardItem['rating'], string> = {
  not_ready: 'Critical Gaps',
  conditional: 'Conditional',
  info_required: 'Information Required',
  ready: 'Meeting Standards',
};

/**
 * Keyword map used to align a Gantt workstream name with its scorecard dimension
 * so the bar inherits the dimension's severity color. Keywords are lowercased
 * and stripped of punctuation before comparison.
 */
const DIMENSION_KEYWORDS: Array<{ match: RegExp; dimension: RegExp }> = [
  { match: /\b(audit|pcaob|sox|control)/i,                      dimension: /audit|accounting/i },
  { match: /\b(governance|board|committee)/i,                   dimension: /governance|board/i },
  { match: /\b(legal|regulat|compliance)/i,                     dimension: /legal|regulat/i },
  { match: /\b(restructur|corporate|entity|cap[\s-]?table)/i,   dimension: /corporate|structure/i },
  { match: /\b(cap[\s-]?raise|capital|fundrais|equity|financ)/i,dimension: /financial|position/i },
  { match: /\b(report|disclosure|ifrs|sec filing|20-?f|6-?k|fin systems|ir infrastructure)/i, dimension: /reporting|disclosure/i },
  { match: /\b(market|ipo materials|roadshow|prospectus|investor relations|ir\b)/i,           dimension: /market|readiness/i },
  { match: /\b(deal|underwriter|transaction|pricing|syndicate)/i,                             dimension: /transaction|feasibility/i },
];

function matchScorecardForWorkstream(name: string, ratings: ScorecardItem[]): ScorecardItem | null {
  if (!name || ratings.length === 0) return null;

  // First: keyword-based routing (handles abbrev like "SOX/Controls" → Audit)
  for (const entry of DIMENSION_KEYWORDS) {
    if (entry.match.test(name)) {
      const hit = ratings.find(r => entry.dimension.test(r.dimension));
      if (hit) return hit;
    }
  }

  // Fallback: direct token overlap against dimension names
  const nameTokens = name.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
  let best: { item: ScorecardItem; score: number } | null = null;
  for (const r of ratings) {
    const dimTokens = r.dimension.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
    const overlap = nameTokens.filter(t => dimTokens.some(d => d.startsWith(t) || t.startsWith(d))).length;
    if (overlap > 0 && (!best || overlap > best.score)) best = { item: r, score: overlap };
  }
  return best?.item ?? null;
}

const STATUS_COLORS: Record<string, string> = {
  '🟢': 'bg-emerald-500',
  '🟡': 'bg-amber-500',
  '🔴': 'bg-red-500',
  '⚪': 'bg-slate-500',
};

const PHASE_LABELS = ['Immediate', 'Pre-filing', 'Filing', 'Pre-roadshow'];
const PHASE_MONTHS = ['Month 1-3', 'Month 4-8', 'Month 9-12', 'Month 13-15'];
const PHASE_MONTH_START = [0, 3, 8, 12]; // 0-indexed month offset where each phase begins
const PHASE_MONTH_DURATION = [3, 5, 4, 3];
const TOTAL_MONTHS = 15;
const TIMELINE_GRID = `160px repeat(${TOTAL_MONTHS}, minmax(0, 1fr))`;

// ─── Component ───

interface HoverState {
  name: string;
  dimension: string;
  rating: ScorecardItem['rating'];
  actions: string;
  finding: string;
}

export function GapAnalysisDashboard({ companyId }: { companyId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedScorecardItem, setSelectedScorecardItem] = useState<ScorecardItem | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      const reports = await apiJson<Array<{ id: string; report_type: string; status: string }>>(
        `/companies/${companyId}/reports`
      );
      const match = reports.find(r => r.report_type === 'gap_analysis' && (r.status === 'draft' || r.status === 'approved'));
      if (match) {
        const full = await apiJson<Report>(`/companies/${companyId}/reports/${match.id}`);
        setReport(full);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!report) return null;

  const scorecardSection = report.sections.find(s => s.section_key === 'scorecard');
  const roadmapSection = report.sections.find(s => s.section_key === 'roadmap');
  if (!scorecardSection?.content && !roadmapSection?.content) return null;

  const ratings = scorecardSection?.content ? parseScorecardItems(scorecardSection.content) : [];
  const overall = scorecardSection?.content ? parseOverallReadiness(scorecardSection.content) : null;
  const workstreams = roadmapSection?.content ? parseWorkstreams(roadmapSection.content) : [];
  const costSummary = roadmapSection?.content ? parseCostSummary(roadmapSection.content) : { items: [], total: '' };
  const ganttItems = roadmapSection?.content ? parseGantt(roadmapSection.content) : [];
  const dependencies = roadmapSection?.content ? parseDependencies(roadmapSection.content) : [];

  return (
    <div className="space-y-4">
      {/* ─── Overall Readiness Banner ─── */}
      {overall && overall.rating && (() => {
        const rLower = overall.rating.toLowerCase();
        const readinessTone =
          rLower.includes('not ready') ? 'text-red-400' :
          rLower.includes('conditional') ? 'text-amber-400' :
          'text-emerald-400';
        const recLower = overall.recommendation.toLowerCase();
        const recTone =
          recLower.startsWith('no-go') || recLower.startsWith('no go') ? 'text-red-400' :
          recLower.startsWith('conditional') || recLower.includes('caution') ? 'text-amber-400' :
          'text-emerald-400';

        type Metric = { label: string; value: string; icon: typeof Shield; valueTone?: string };
        const metrics: Metric[] = [
          { label: 'IPO Readiness',   value: overall.rating,                               icon: Shield,         valueTone: readinessTone },
          { label: 'Time to Ready',   value: overall.timeEstimate,                         icon: Calendar },
          { label: 'Est. Total Cost', value: costSummary.total || overall.totalCost || '', icon: DollarSign },
          { label: 'Recommendation',  value: overall.recommendation,                       icon: AlertTriangle,  valueTone: recTone },
        ].filter(m => m.value);

        return (
          <Card size="sm">
            <CardContent className="py-1">
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map((m, i) => (
                  <div
                    key={m.label}
                    className={cn(
                      'flex items-center gap-3 min-w-0',
                      i > 0 && 'xl:border-l xl:border-border/60 xl:pl-6'
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/50 ring-1 ring-inset ring-border">
                      <m.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">{m.label}</p>
                      <p className={cn('mt-0.5 text-sm font-semibold line-clamp-2', m.valueTone)}>{m.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ─── Scorecard Grid — grouped by severity (most → least serious) ─── */}
      {ratings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Shield className="h-3.5 w-3.5 text-primary" />
              IPO Readiness Scorecard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {SEVERITY_ORDER.map((rating) => {
              const group = ratings.filter((r) => r.rating === rating);
              if (group.length === 0) return null;
              const cfg = RATING_CONFIG[rating];
              const GroupIcon = cfg.icon;
              return (
                <div key={rating} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <GroupIcon className={cn('h-3.5 w-3.5', cfg.badgeText)} />
                    <p className={cn('text-[11px] font-semibold uppercase tracking-[0.14em]', cfg.badgeText)}>
                      {SEVERITY_GROUP_LABEL[rating]}
                    </p>
                    <span className="text-[10px] font-mono text-muted-foreground/60">{group.length}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {group.map((r) => (
                      <button
                        key={r.dimension}
                        type="button"
                        onClick={() => setSelectedScorecardItem(r)}
                        className="group relative overflow-hidden rounded-lg border border-border/60 bg-muted/20 p-3 pl-4 text-left transition-all cursor-pointer hover:bg-muted/40 hover:border-border"
                      >
                        <span aria-hidden className={cn('absolute left-0 top-0 bottom-0 w-[3px]', cfg.rail)} />
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold leading-tight truncate">{r.dimension}</p>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-all group-hover:text-foreground group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ─── Gantt Timeline ─── */}
      {ganttItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Implementation Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                {/* Phase headers — each spans its month columns */}
                <div
                  className="grid border-b border-border/60 pb-2 mb-1"
                  style={{ gridTemplateColumns: TIMELINE_GRID }}
                >
                  <div className="px-2" />
                  {PHASE_LABELS.map((label, i) => {
                    const startCol = 2 + PHASE_MONTH_START[i];
                    const endCol = startCol + PHASE_MONTH_DURATION[i];
                    return (
                      <div
                        key={label}
                        className={cn('text-center px-1', i > 0 && 'border-l border-border/80')}
                        style={{ gridColumn: `${startCol} / ${endCol}` }}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5 font-mono">{PHASE_MONTHS[i]}</p>
                      </div>
                    );
                  })}
                </div>
                {/* Body: rows + single continuous vertical-line overlay */}
                <div className="relative">
                  {/* Vertical month/phase lines — single layer spanning full body height */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 grid"
                    style={{ gridTemplateColumns: TIMELINE_GRID }}
                  >
                    <div />
                    {Array.from({ length: TOTAL_MONTHS }).map((_, m) => {
                      const isPhaseBoundary = PHASE_MONTH_START.includes(m) && m > 0;
                      return (
                        <div
                          key={m}
                          className={cn(
                            m > 0 && (isPhaseBoundary ? 'border-l border-border' : 'border-l border-border/60'),
                          )}
                        />
                      );
                    })}
                  </div>

                  {/* Gantt rows */}
                  {ganttItems.map((item, rowIdx) => {
                    const firstActive = item.phases.indexOf(true);
                    const lastActive = item.phases.lastIndexOf(true);
                    const matched = matchScorecardForWorkstream(item.name, ratings);
                    const matchedRating = matched?.rating ?? null;
                    const barClass = matchedRating
                      ? RATING_CONFIG[matchedRating].bar
                      : 'bg-gradient-to-r from-primary/60 via-primary/80 to-primary/95';
                    const barStartCol = firstActive !== -1 ? 2 + PHASE_MONTH_START[firstActive] : 0;
                    const barEndCol = firstActive !== -1 ? 2 + PHASE_MONTH_START[lastActive] + PHASE_MONTH_DURATION[lastActive] : 0;
                    const isHovered = hover?.name === item.name;
                    const hasTooltipData = !!matched && (matched.actions || matched.finding);
                    const isOdd = rowIdx % 2 === 1;

                    const handleEnter = () => {
                      if (!matched) return;
                      setHover({
                        name: item.name,
                        dimension: matched.dimension,
                        rating: matched.rating,
                        actions: matched.actions,
                        finding: matched.finding,
                      });
                    };

                    return (
                      <div
                        key={item.name}
                        className={cn(
                          'relative grid transition-colors h-8',
                          isHovered
                            ? 'bg-foreground/[0.10]'
                            : isOdd
                              ? 'bg-foreground/[0.06] hover:bg-foreground/[0.08]'
                              : 'hover:bg-foreground/[0.04]',
                          hasTooltipData && 'cursor-default'
                        )}
                        style={{ gridTemplateColumns: TIMELINE_GRID }}
                        onMouseEnter={handleEnter}
                        onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setHover(null)}
                      >
                        <div className="flex items-center px-2">
                          <span className="text-[11px] font-medium truncate text-foreground/90 leading-8">{item.name}</span>
                        </div>
                        {/* Structural spacer cells (no borders — overlay handles lines) */}
                        {Array.from({ length: TOTAL_MONTHS }).map((_, m) => (
                          <div key={m} />
                        ))}
                        {/* Single continuous bar */}
                        {firstActive !== -1 && (
                          <div
                            className={cn(
                              'relative self-center mx-1.5 h-2.5 transition-transform duration-150',
                              barClass,
                              !isHovered && 'shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.25)]',
                              isHovered && 'scale-y-125'
                            )}
                            style={{ gridColumn: `${barStartCol} / ${barEndCol}`, gridRow: 1 }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Dependencies */}
            {dependencies.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-xs font-semibold text-amber-400 mb-2">Key Dependencies</p>
                <ul className="space-y-1">
                  {dependencies.map((dep, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground flex gap-2">
                      <span className="text-amber-500 shrink-0">→</span>
                      {dep}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Workstream Table ─── */}
      {workstreams.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              Workstream Status & Cost Estimates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-2 font-semibold text-muted-foreground">#</th>
                    <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Workstream</th>
                    <th className="text-center py-2 px-2 font-semibold text-muted-foreground">Status</th>
                    <th className="text-center py-2 px-2 font-semibold text-muted-foreground">Severity</th>
                    <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Est. Cost (USD)</th>
                    <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Owner</th>
                    <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Phase</th>
                  </tr>
                </thead>
                <tbody>
                  {workstreams.map((ws, wsIdx) => {
                    const statusEmoji = ws.status.match(/🟢|🟡|🔴|⚪/)?.[0] || '';
                    const statusDot = STATUS_COLORS[statusEmoji] || 'bg-slate-500';
                    const statusText = ws.status.replace(/🟢|🟡|🔴|⚪/g, '').trim();
                    const severityColor = ws.severity.toLowerCase().includes('critical') ? 'text-red-400' :
                      ws.severity.toLowerCase().includes('high') ? 'text-amber-400' : 'text-muted-foreground';
                    const isOdd = wsIdx % 2 === 1;

                    return (
                      <tr
                        key={ws.num}
                        className={cn(
                          'transition-colors',
                          isOdd ? 'bg-foreground/[0.035] hover:bg-foreground/[0.06]' : 'hover:bg-foreground/[0.03]'
                        )}
                      >
                        <td className="py-2 px-2 text-muted-foreground">{ws.num}</td>
                        <td className="py-2 px-2 font-medium">{ws.name}</td>
                        <td className="py-2 px-2 text-center">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn('h-2 w-2 rounded-full', statusDot)} />
                            <span className="text-muted-foreground">{statusText}</span>
                          </span>
                        </td>
                        <td className={cn('py-2 px-2 text-center font-medium', severityColor)}>{ws.severity}</td>
                        <td className="py-2 px-2 text-right font-mono">{ws.cost}</td>
                        <td className="py-2 px-2 text-muted-foreground">{ws.owner}</td>
                        <td className="py-2 px-2 text-muted-foreground">{ws.phase}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cost summary footer */}
            {costSummary.items.length > 0 && (
              <div className="mt-4 rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold mb-2">Cost Summary</p>
                <div className="grid gap-1">
                  {costSummary.items.map((item) => (
                    <div key={item.category} className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{item.category}</span>
                      <span className="font-mono font-medium">{item.range}</span>
                    </div>
                  ))}
                  {costSummary.total && (
                    <div className="flex items-center justify-between text-xs font-bold border-t border-border/30 pt-1 mt-1">
                      <span>Total Estimated Cost</span>
                      <span className="font-mono text-primary">{costSummary.total}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scorecard detail modal — full finding + recommended actions */}
      <Dialog open={!!selectedScorecardItem} onOpenChange={(open) => !open && setSelectedScorecardItem(null)}>
        <DialogContent className="sm:max-w-lg overflow-hidden p-0 gap-0">
          {selectedScorecardItem && (() => {
            const cfg = RATING_CONFIG[selectedScorecardItem.rating];
            const Icon = cfg.icon;
            const actionSteps = selectedScorecardItem.actions ? parseActionList(selectedScorecardItem.actions) : [];
            return (
              <div className="relative">
                {/* Left severity rail — full modal height, fading to transparent at the bottom */}
                <span aria-hidden className={cn('absolute left-0 top-0 bottom-0 w-1', cfg.railFade)} />

                {/* Header */}
                <div className="border-b border-border/60 pl-6 pr-10 pt-5 pb-4">
                  <DialogHeader className="space-y-2.5">
                    <div className={cn(
                      'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
                      cfg.badgeBg, cfg.badgeText, cfg.badgeRing
                    )}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </div>
                    <DialogTitle className="text-lg font-semibold tracking-tight leading-tight">
                      {selectedScorecardItem.dimension}
                    </DialogTitle>
                  </DialogHeader>
                </div>

                {/* Body */}
                <div className="pl-6 pr-6 py-5 space-y-6 max-h-[60vh] overflow-y-auto">
                  {selectedScorecardItem.finding && (
                    <section>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="h-px w-3 bg-border" />
                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Finding</p>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                        {selectedScorecardItem.finding}
                      </p>
                    </section>
                  )}
                  {actionSteps.length > 0 && (
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="h-px w-3 bg-border" />
                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recommended Actions</p>
                      </div>
                      <ol className="space-y-2.5">
                        {actionSteps.map((step, i) => (
                          <li key={i} className="flex gap-3">
                            <span className={cn(
                              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-1 ring-inset tabular-nums',
                              cfg.badgeBg, cfg.badgeText, cfg.badgeRing
                            )}>
                              {i + 1}
                            </span>
                            <p className="text-sm leading-relaxed text-foreground/90">{step}</p>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Cursor-following tooltip for Gantt rows — portaled to <body> so fixed
          positioning bypasses transformed ancestors (stagger-children, etc.) */}
      {hover && typeof document !== 'undefined' && createPortal(
        (() => {
        const cfg = RATING_CONFIG[hover.rating];
        const TOOLTIP_W = 320;
        const APPROX_H = 200;
        const OFFSET_X = 14;
        const OFFSET_Y = 14;
        const PAD = 12;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Horizontal: prefer right side of cursor, flip to left if it would overflow,
        // then clamp to viewport so text is never clipped.
        let left = cursor.x + OFFSET_X;
        if (left + TOOLTIP_W + PAD > vw) left = cursor.x - OFFSET_X - TOOLTIP_W;
        left = Math.max(PAD, Math.min(left, vw - TOOLTIP_W - PAD));

        // Vertical: align the cursor with the tooltip header (~20px below tooltip top)
        // so the cursor reads as being "attached" to the header bar.
        const HEADER_ANCHOR = 20;
        let top = cursor.y - HEADER_ANCHOR;
        if (top + APPROX_H + PAD > vh) top = cursor.y - APPROX_H + HEADER_ANCHOR;
        top = Math.max(PAD, Math.min(top, vh - APPROX_H - PAD));

        return (
          <div
            className="fixed z-50 pointer-events-none rounded-lg border border-border bg-popover text-popover-foreground shadow-xl backdrop-blur-sm"
            style={{ left, top, width: TOOLTIP_W }}
          >
            <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
              <span className={cn('h-1.5 w-1.5 rounded-full', cfg.rail)} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold leading-tight truncate">{hover.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{hover.dimension}</p>
              </div>
              <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ring-1 ring-inset', cfg.badgeBg, cfg.badgeText, cfg.badgeRing)}>
                {cfg.label}
              </span>
            </div>
            <div className="p-3 space-y-2">
              {hover.actions && (
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 mb-1">Recommended Actions</p>
                  <p className="text-[11px] leading-relaxed text-foreground/90 whitespace-pre-line">{hover.actions}</p>
                </div>
              )}
              {hover.finding && (
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 mb-1">Finding</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{hover.finding}</p>
                </div>
              )}
            </div>
          </div>
        );
      })(),
        document.body,
      )}
    </div>
  );
}
