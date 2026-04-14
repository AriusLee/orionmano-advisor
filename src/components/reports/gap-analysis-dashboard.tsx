'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiJson } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, DollarSign, Calendar, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

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

interface GapAnalysisDashboardProps {
  companyId: string;
}

// Parse the scorecard section to extract ratings
function parseScorecardRatings(content: string): Array<{
  dimension: string;
  rating: 'ready' | 'conditional' | 'not_ready' | 'info_required';
  finding: string;
  actions: string;
}> {
  const ratings: Array<{
    dimension: string;
    rating: 'ready' | 'conditional' | 'not_ready' | 'info_required';
    finding: string;
    actions: string;
  }> = [];

  // Parse markdown table rows
  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.includes('|') || line.includes('---') || line.toLowerCase().includes('dimension')) continue;
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 3) continue;

    let rating: 'ready' | 'conditional' | 'not_ready' | 'info_required' = 'info_required';
    const ratingCell = cells[1]?.toLowerCase() || '';
    if (ratingCell.includes('🟢') || ratingCell.includes('ready') && !ratingCell.includes('not')) rating = 'ready';
    else if (ratingCell.includes('🟡') || ratingCell.includes('conditional')) rating = 'conditional';
    else if (ratingCell.includes('🔴') || ratingCell.includes('not ready')) rating = 'not_ready';
    else if (ratingCell.includes('⚪') || ratingCell.includes('information')) rating = 'info_required';

    ratings.push({
      dimension: cells[0]?.replace(/\*\*/g, '') || '',
      rating,
      finding: cells[2]?.replace(/\*\*/g, '') || '',
      actions: cells[3]?.replace(/\*\*/g, '') || '',
    });
  }

  return ratings;
}

// Extract overall readiness from scorecard content
function parseOverallReadiness(content: string): {
  rating: string;
  timeEstimate: string;
  totalCost: string;
  recommendation: string;
} {
  const result = { rating: '', timeEstimate: '', totalCost: '', recommendation: '' };

  const lines = content.split('\n');
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('overall readiness rating') || lower.includes('overall readiness:')) {
      result.rating = line.split(':').slice(1).join(':').replace(/\*\*/g, '').trim();
    } else if (lower.includes('estimated time') || lower.includes('time to ipo')) {
      result.timeEstimate = line.split(':').slice(1).join(':').replace(/\*\*/g, '').trim();
    } else if (lower.includes('estimated total') || lower.includes('remediation cost')) {
      result.totalCost = line.split(':').slice(1).join(':').replace(/\*\*/g, '').trim();
    } else if (lower.includes('go/no-go') || lower.includes('recommendation:')) {
      result.recommendation = line.split(':').slice(1).join(':').replace(/\*\*/g, '').trim();
    }
  }

  return result;
}

const RATING_CONFIG = {
  ready: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500', label: 'Ready' },
  conditional: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', dot: 'bg-amber-500', label: 'Conditional' },
  not_ready: { color: 'bg-red-500/20 text-red-400 border-red-500/30', dot: 'bg-red-500', label: 'Not Ready' },
  info_required: { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', dot: 'bg-slate-500', label: 'Info Required' },
};

export function GapAnalysisDashboard({ companyId }: GapAnalysisDashboardProps) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    try {
      const reports = await apiJson<Array<{ id: string; report_type: string; status: string }>>(
        `/companies/${companyId}/reports`
      );
      const match = reports.find(
        (r) => r.report_type === 'gap_analysis' && (r.status === 'draft' || r.status === 'approved')
      );
      if (match) {
        const full = await apiJson<Report>(`/companies/${companyId}/reports/${match.id}`);
        setReport(full);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) return null;

  const scorecardSection = report.sections.find(s => s.section_key === 'scorecard');
  const roadmapSection = report.sections.find(s => s.section_key === 'roadmap');

  if (!scorecardSection?.content && !roadmapSection?.content) return null;

  const ratings = scorecardSection?.content ? parseScorecardRatings(scorecardSection.content) : [];
  const overall = scorecardSection?.content ? parseOverallReadiness(scorecardSection.content) : null;

  return (
    <div className="space-y-4">
      {/* Overall Readiness Banner */}
      {overall && overall.rating && (
        <Card className={cn(
          'border',
          overall.rating.toLowerCase().includes('not ready') ? 'border-red-500/30' :
          overall.rating.toLowerCase().includes('conditional') ? 'border-amber-500/30' :
          'border-emerald-500/30'
        )}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">IPO Readiness</p>
                  <p className="text-lg font-bold">{overall.rating}</p>
                </div>
              </div>
              {overall.timeEstimate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Time to Ready</p>
                    <p className="text-sm font-semibold">{overall.timeEstimate}</p>
                  </div>
                </div>
              )}
              {overall.totalCost && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Est. Total Cost</p>
                    <p className="text-sm font-semibold">{overall.totalCost}</p>
                  </div>
                </div>
              )}
              {overall.recommendation && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Recommendation</p>
                    <p className="text-sm font-semibold">{overall.recommendation}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scorecard Grid */}
      {ratings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-primary" />
              IPO Readiness Scorecard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ratings.map((r) => {
                const config = RATING_CONFIG[r.rating];
                return (
                  <div
                    key={r.dimension}
                    className={cn(
                      'rounded-lg border p-3 space-y-2',
                      config.color
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold truncate">{r.dimension}</p>
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', config.color)}>
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed opacity-90 line-clamp-3">{r.finding}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roadmap & Timeline */}
      {roadmapSection?.content && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-primary" />
              Implementation Roadmap & Cost Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{roadmapSection.content}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
