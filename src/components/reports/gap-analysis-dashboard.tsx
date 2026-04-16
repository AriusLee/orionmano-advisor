'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiJson } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Shield, DollarSign, Calendar, AlertTriangle, Clock, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
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
  ready: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: CheckCircle2, label: 'Ready' },
  conditional: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: Clock, label: 'Conditional' },
  not_ready: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: XCircle, label: 'Not Ready' },
  info_required: { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400', icon: HelpCircle, label: 'Info Required' },
};

const STATUS_COLORS: Record<string, string> = {
  '🟢': 'bg-emerald-500',
  '🟡': 'bg-amber-500',
  '🔴': 'bg-red-500',
  '⚪': 'bg-slate-500',
};

const PHASE_BG = ['bg-red-500/8', 'bg-amber-500/8', 'bg-blue-500/8', 'bg-emerald-500/8'];
const PHASE_HEADER_COLOR = ['text-red-400', 'text-amber-400', 'text-blue-400', 'text-emerald-400'];
const PHASE_LABELS = ['Immediate', 'Pre-filing', 'Filing', 'Pre-roadshow'];
const PHASE_MONTHS = ['Month 1-3', 'Month 4-8', 'Month 9-12', 'Month 13-15'];
const BAR_COLOR = 'bg-primary';

// ─── Component ───

export function GapAnalysisDashboard({ companyId }: { companyId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

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
      {overall && overall.rating && (
        <Card className={cn(
          'border',
          overall.rating.toLowerCase().includes('not ready') ? 'border-red-500/30' :
          overall.rating.toLowerCase().includes('conditional') ? 'border-amber-500/30' :
          'border-emerald-500/30'
        )}>
          <CardContent className="py-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  overall.rating.toLowerCase().includes('not ready') ? 'bg-red-500/15' :
                  overall.rating.toLowerCase().includes('conditional') ? 'bg-amber-500/15' :
                  'bg-emerald-500/15'
                )}>
                  <Shield className={cn(
                    'h-5 w-5',
                    overall.rating.toLowerCase().includes('not ready') ? 'text-red-400' :
                    overall.rating.toLowerCase().includes('conditional') ? 'text-amber-400' :
                    'text-emerald-400'
                  )} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">IPO Readiness</p>
                  <p className="text-sm font-bold truncate">{overall.rating}</p>
                </div>
              </div>
              {overall.timeEstimate && (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
                    <Calendar className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Time to Ready</p>
                    <p className="text-sm font-bold truncate">{overall.timeEstimate}</p>
                  </div>
                </div>
              )}
              {(costSummary.total || overall.totalCost) && (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/15">
                    <DollarSign className="h-5 w-5 text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Est. Total Cost</p>
                    <p className="text-sm font-bold truncate">{costSummary.total || overall.totalCost}</p>
                  </div>
                </div>
              )}
              {overall.recommendation && (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/15">
                    <AlertTriangle className="h-5 w-5 text-orange-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Recommendation</p>
                    <p className="text-sm font-bold line-clamp-2">{overall.recommendation}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Scorecard Grid ─── */}
      {ratings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-primary" />
              IPO Readiness Scorecard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {ratings.map((r) => {
                const cfg = RATING_CONFIG[r.rating];
                const Icon = cfg.icon;
                return (
                  <div key={r.dimension} className={cn('rounded-lg border p-3 space-y-2', cfg.bg, cfg.border)}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold leading-tight">{r.dimension}</p>
                      <div className={cn('flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', cfg.bg, cfg.text)}>
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </div>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-4">{r.finding}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Gantt Timeline ─── */}
      {ganttItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-primary" />
              Implementation Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Phase headers */}
                <div className="grid grid-cols-[160px_1fr_1fr_1fr_1fr] mb-px rounded-t-lg overflow-hidden">
                  <div className="px-2 py-2" />
                  {PHASE_LABELS.map((label, i) => (
                    <div key={label} className={cn('text-center py-2 px-1', PHASE_BG[i])}>
                      <p className={cn('text-[10px] font-semibold', PHASE_HEADER_COLOR[i])}>{label}</p>
                      <p className="text-[9px] text-muted-foreground/60">{PHASE_MONTHS[i]}</p>
                    </div>
                  ))}
                </div>
                {/* Gantt bars — continuous spans */}
                {ganttItems.map((item, rowIdx) => {
                  // Find first and last active phase to draw one continuous bar
                  const firstActive = item.phases.indexOf(true);
                  const lastActive = item.phases.lastIndexOf(true);

                  return (
                    <div key={item.name} className={cn('grid grid-cols-[160px_1fr_1fr_1fr_1fr]', rowIdx % 2 === 0 ? 'bg-muted/5' : '')}>
                      <div className="flex items-center px-2 py-2">
                        <p className="text-[11px] font-medium truncate">{item.name}</p>
                      </div>
                      {item.phases.map((_, i) => {
                        const isFirst = i === firstActive;
                        const isLast = i === lastActive;
                        const isActive = i >= firstActive && i <= lastActive && firstActive !== -1;

                        return (
                          <div key={i} className={cn('flex items-center py-2', PHASE_BG[i])}>
                            {isActive ? (
                              <div className={cn(
                                'h-4 w-full', BAR_COLOR,
                                isFirst && 'ml-1.5 rounded-l-sm',
                                isLast && 'mr-1.5 rounded-r-sm',
                              )} />
                            ) : (
                              <div className="h-4 w-full" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
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
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-5 w-5 text-primary" />
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
                  {workstreams.map((ws) => {
                    const statusEmoji = ws.status.match(/🟢|🟡|🔴|⚪/)?.[0] || '';
                    const statusDot = STATUS_COLORS[statusEmoji] || 'bg-slate-500';
                    const statusText = ws.status.replace(/🟢|🟡|🔴|⚪/g, '').trim();
                    const severityColor = ws.severity.toLowerCase().includes('critical') ? 'text-red-400' :
                      ws.severity.toLowerCase().includes('high') ? 'text-amber-400' : 'text-muted-foreground';

                    return (
                      <tr key={ws.num} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
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
    </div>
  );
}
