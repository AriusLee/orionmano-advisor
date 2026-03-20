'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { apiJson } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Upload, AlertTriangle, Shield, TrendingUp, TrendingDown,
  CheckCircle2, Clock, XCircle, Loader2, Building2, BarChart3, Sparkles,
  FileSearch, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
  legal_name: string | null;
  industry: string | null;
  sub_industry: string | null;
  country: string;
  description: string | null;
  engagement_type: string | null;
  target_exchange: string | null;
  status: string;
}

interface RiskFlag {
  severity: string;
  title: string;
  detail: string;
}

interface CrossRef {
  total_documents: number;
  extracted: number;
  processing: number;
  failed: number;
  document_types: string[];
  cross_referenced: boolean;
}

interface TimelineItem {
  type: string;
  title: string;
  detail: string;
  timestamp: string | null;
}

interface Intelligence {
  risk_flags: RiskFlag[];
  financial_snapshot: Record<string, unknown> | null;
  cross_reference: CrossRef;
  timeline: TimelineItem[];
}

const SEVERITY_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; bg: string }> = {
  high: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  medium: { icon: Shield, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  low: { icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
};

const TIMELINE_ICONS: Record<string, typeof Building2> = {
  company_created: Building2,
  document_uploaded: Upload,
  extraction_completed: CheckCircle2,
  report_generated: FileText,
};

export default function CompanyOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [company, setCompany] = useState<Company | null>(null);
  const [intel, setIntel] = useState<Intelligence | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const loadData = useCallback(() => {
    apiJson<Company>(`/companies/${id}`).then(setCompany);
    apiJson<Intelligence>(`/companies/${id}/intelligence`).then(setIntel);
  }, [id]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Load executive summary once
  useEffect(() => {
    setSummaryLoading(true);
    apiJson<{ summary: string }>(`/companies/${id}/summary`)
      .then((r) => setSummary(r.summary))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [id]);

  if (!company) return null;

  const fin = intel?.financial_snapshot;
  const is_data = (fin as Record<string, unknown>)?.income_statement as Record<string, Record<string, number>> | undefined;
  const bs_data = (fin as Record<string, unknown>)?.balance_sheet as Record<string, Record<string, number>> | undefined;

  // Extract latest financial metrics
  const getLatest = (obj: Record<string, number> | undefined): number | null => {
    if (!obj) return null;
    const entries = Object.entries(obj).filter(([, v]) => typeof v === 'number').sort(([a], [b]) => b.localeCompare(a));
    return entries.length > 0 ? entries[0][1] : null;
  };
  const getPrev = (obj: Record<string, number> | undefined): number | null => {
    if (!obj) return null;
    const entries = Object.entries(obj).filter(([, v]) => typeof v === 'number').sort(([a], [b]) => b.localeCompare(a));
    return entries.length > 1 ? entries[1][1] : null;
  };

  const revenue = getLatest(is_data?.revenue);
  const prevRevenue = getPrev(is_data?.revenue);
  const netIncome = getLatest(is_data?.net_income);
  const grossProfit = getLatest(is_data?.gross_profit);
  const totalAssets = getLatest(bs_data?.total_assets);

  const revenueGrowth = revenue && prevRevenue && prevRevenue !== 0 ? ((revenue - prevRevenue) / Math.abs(prevRevenue)) * 100 : null;
  const grossMargin = revenue && grossProfit && revenue !== 0 ? (grossProfit / revenue) * 100 : null;

  const currency = (fin as Record<string, unknown>)?.currency as string || '';

  const formatNum = (n: number | null) => {
    if (n === null) return '—';
    if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toFixed(0);
  };

  return (
    <div className="space-y-6">
      {/* Company header */}
      <div>
        <h2 className="text-2xl font-semibold">{company.name}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {company.industry && <Badge>{company.industry}</Badge>}
          {company.engagement_type && <Badge variant="outline">{company.engagement_type.toUpperCase()}</Badge>}
          {company.target_exchange && <Badge variant="secondary">{company.target_exchange.toUpperCase()}</Badge>}
          <Badge variant="outline">{company.country}</Badge>
        </div>
      </div>

      {/* Executive Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-primary" /> Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Generating summary...</div>
          ) : summary ? (
            <p className="text-sm leading-relaxed">{summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Upload documents to generate an executive summary.</p>
          )}
        </CardContent>
      </Card>

      {/* Financial Snapshot */}
      {fin && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Revenue</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currency}{formatNum(revenue)}</div>
              {revenueGrowth !== null && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${revenueGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {revenueGrowth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(revenueGrowth).toFixed(1)}% YoY
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Net Income</CardTitle>
              {netIncome !== null && netIncome >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currency}{formatNum(netIncome)}</div>
              <p className="text-xs text-muted-foreground mt-1">{netIncome !== null && netIncome >= 0 ? 'Profitable' : 'Loss-making'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Gross Margin</CardTitle>
              <Minus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{grossMargin !== null ? `${grossMargin.toFixed(1)}%` : '—'}</div>
              <p className="text-xs text-muted-foreground mt-1">{grossMargin !== null && grossMargin > 50 ? 'Healthy' : grossMargin !== null ? 'Monitor' : ''}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Assets</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currency}{formatNum(totalAssets)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Risk Flags */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Risk Flags
              {intel && intel.risk_flags.length > 0 && (
                <Badge variant="destructive" className="text-xs">{intel.risk_flags.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!intel || intel.risk_flags.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> No risk flags detected
              </div>
            ) : (
              <div className="space-y-2">
                {intel.risk_flags.map((flag, i) => {
                  const cfg = SEVERITY_CONFIG[flag.severity] || SEVERITY_CONFIG.medium;
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${cfg.bg}`}>
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
                      <div>
                        <p className="text-sm font-medium">{flag.title}</p>
                        <p className="text-xs text-muted-foreground">{flag.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document Cross-Reference */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSearch className="h-5 w-5 text-primary" />
              Document Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {intel ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border px-3 py-2 text-center">
                    <div className="text-lg font-bold">{intel.cross_reference.total_documents}</div>
                    <div className="text-[10px] text-muted-foreground">Uploaded</div>
                  </div>
                  <div className="rounded-lg border px-3 py-2 text-center">
                    <div className="text-lg font-bold text-emerald-400">{intel.cross_reference.extracted}</div>
                    <div className="text-[10px] text-muted-foreground">Extracted</div>
                  </div>
                  <div className="rounded-lg border px-3 py-2 text-center">
                    <div className="text-lg font-bold">{intel.cross_reference.document_types.length}</div>
                    <div className="text-[10px] text-muted-foreground">Doc Types</div>
                  </div>
                </div>
                {intel.cross_reference.cross_referenced && (
                  <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs"><span className="font-medium">{intel.cross_reference.extracted} documents cross-referenced</span> — data validated across multiple sources</p>
                  </div>
                )}
                {intel.cross_reference.processing > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> {intel.cross_reference.processing} document(s) still processing
                  </div>
                )}
                {intel.cross_reference.document_types.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {intel.cross_reference.document_types.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs font-normal">{t}</Badge>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4">Upload documents to see intelligence.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      {intel && intel.timeline.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-muted-foreground" /> Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative pl-6 space-y-4">
              {/* Vertical line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
              {intel.timeline.map((item, i) => {
                const Icon = TIMELINE_ICONS[item.type] || Clock;
                return (
                  <div key={i} className="relative flex items-start gap-3">
                    <div className="absolute -left-6 flex h-[18px] w-[18px] items-center justify-center rounded-full border bg-card">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 pt-px">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                      {item.timestamp && (
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {new Date(item.timestamp).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
