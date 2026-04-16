'use client';

import { use, useEffect, useState, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  Upload,
  AlertTriangle,
  Shield,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Loader2,
  Building2,
  BarChart3,
  Sparkles,
  FileSearch,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Wallet,
  Users,
  Network,
  UserCircle2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

import { apiJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CompanyLogo } from '@/components/company-logo';

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
  logo_url?: string | null;
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

interface Shareholder {
  name: string;
  shares: number | null;
  percentage: number | null;
  source: string;
}

interface Personnel {
  name: string;
  title: string | null;
  background: string | null;
  source: string;
}

interface Intelligence {
  risk_flags: RiskFlag[];
  financial_snapshot: Record<string, unknown> | null;
  cross_reference: CrossRef;
  shareholders?: Shareholder[];
  key_personnel?: Personnel[];
  org_chart_summary?: string | null;
  timeline: TimelineItem[];
}

const HALO_GRADIENT =
  'radial-gradient(circle at center, color-mix(in oklch, var(--primary) 22%, transparent), transparent 65%)';

const CHART_COLORS = [
  'oklch(0.75 0.15 175)',
  'oklch(0.65 0.15 250)',
  'oklch(0.70 0.12 140)',
  'oklch(0.60 0.18 300)',
  'oklch(0.55 0.15 260)',
];

const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'oklch(0.20 0.014 260)',
  border: '1px solid oklch(0.30 0.014 260)',
  borderRadius: 8,
  fontSize: 12,
};

const SEVERITY_META: Record<
  string,
  { icon: LucideIcon; tone: string; ring: string; bg: string }
> = {
  high: {
    icon: AlertTriangle,
    tone: 'text-red-400',
    ring: 'ring-red-500/20',
    bg: 'bg-red-500/8',
  },
  medium: {
    icon: Shield,
    tone: 'text-amber-400',
    ring: 'ring-amber-500/20',
    bg: 'bg-amber-500/8',
  },
  low: {
    icon: Shield,
    tone: 'text-blue-400',
    ring: 'ring-blue-500/20',
    bg: 'bg-blue-500/8',
  },
};

const TIMELINE_ICONS: Record<string, LucideIcon> = {
  company_created: Building2,
  document_uploaded: Upload,
  extraction_completed: CheckCircle2,
  report_generated: FileText,
};

type FinSnapshot = {
  income_statement?: Record<string, Record<string, number>>;
  balance_sheet?: Record<string, Record<string, number>>;
  revenue_breakdown?: Record<string, number>;
  currency?: string;
};

export default function CompanyOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  useEffect(() => {
    setSummaryLoading(true);
    apiJson<{ summary: string }>(`/companies/${id}/summary`)
      .then((r) => setSummary(r.summary))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [id]);

  if (!company) return null;

  const fin = intel?.financial_snapshot as FinSnapshot | null | undefined;
  const is_data = fin?.income_statement;
  const bs_data = fin?.balance_sheet;

  const getLatest = (obj: Record<string, number> | undefined): number | null => {
    if (!obj) return null;
    const entries = Object.entries(obj)
      .filter(([, v]) => typeof v === 'number')
      .sort(([a], [b]) => b.localeCompare(a));
    return entries.length > 0 ? entries[0][1] : null;
  };
  const getPrev = (obj: Record<string, number> | undefined): number | null => {
    if (!obj) return null;
    const entries = Object.entries(obj)
      .filter(([, v]) => typeof v === 'number')
      .sort(([a], [b]) => b.localeCompare(a));
    return entries.length > 1 ? entries[1][1] : null;
  };

  const revenue = getLatest(is_data?.revenue);
  const prevRevenue = getPrev(is_data?.revenue);
  const netIncome = getLatest(is_data?.net_income);
  const grossProfit = getLatest(is_data?.gross_profit);
  const totalAssets = getLatest(bs_data?.total_assets);

  const revenueGrowth =
    revenue && prevRevenue && prevRevenue !== 0
      ? ((revenue - prevRevenue) / Math.abs(prevRevenue)) * 100
      : null;
  const grossMargin =
    revenue && grossProfit && revenue !== 0 ? (grossProfit / revenue) * 100 : null;

  const currency = fin?.currency || '';

  const formatNum = (n: number | null | undefined) => {
    if (n === null || n === undefined) return '—';
    if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toFixed(0);
  };

  // Trend data from real extractions — no demo fallback
  const trendData = (() => {
    const revObj = is_data?.revenue || {};
    const niObj = is_data?.net_income || {};
    const gpObj = is_data?.gross_profit || {};
    const periods = [
      ...new Set([
        ...Object.keys(revObj),
        ...Object.keys(niObj),
        ...Object.keys(gpObj),
      ]),
    ].sort();
    return periods
      .map((p) => ({
        period: p.replace('FY', '').replace('20', "'"),
        Revenue: typeof revObj[p] === 'number' ? revObj[p] : null,
        'Net Income': typeof niObj[p] === 'number' ? niObj[p] : null,
        'Gross Profit': typeof gpObj[p] === 'number' ? gpObj[p] : null,
      }))
      .filter((d) => d.Revenue !== null);
  })();

  const marginData = trendData
    .map((d) => ({
      period: d.period,
      'Gross Margin':
        d.Revenue && d['Gross Profit'] ? (d['Gross Profit']! / d.Revenue!) * 100 : null,
      'Net Margin':
        d.Revenue && d['Net Income'] ? (d['Net Income']! / d.Revenue!) * 100 : null,
    }))
    .filter((d) => d['Gross Margin'] !== null);

  const revenueBreakdown = (() => {
    const rb = fin?.revenue_breakdown;
    if (rb && typeof rb === 'object') {
      return Object.entries(rb)
        .filter(([, v]) => typeof v === 'number' && v > 0)
        .map(([name, value]) => ({ name, value }));
    }
    return [];
  })();

  const bsData = (() => {
    const ca = getLatest(bs_data?.current_assets);
    const ta = getLatest(bs_data?.total_assets);
    const nca = ta && ca ? ta - ca : null;
    const items: Array<{ name: string; value: number }> = [];
    if (ca && ca > 0) items.push({ name: 'Current Assets', value: ca });
    if (nca && nca > 0) items.push({ name: 'Non-Current Assets', value: nca });
    return items;
  })();

  const hasFinancialCharts =
    trendData.length > 0 ||
    marginData.length > 0 ||
    revenueBreakdown.length > 0 ||
    bsData.length > 0;

  const toNum = (v: unknown): number => {
    if (typeof v === 'number') return v;
    if (Array.isArray(v)) return Number(v[0]);
    return Number(v);
  };
  const currencyFmt = ((v: unknown) =>
    `${currency}${formatNum(toNum(v))}`) as (v: unknown) => string;
  const percentFmt = ((v: unknown) =>
    `${toNum(v).toFixed(1)}%`) as (v: unknown) => string;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/30 px-6 py-7 sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-grid-drift opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at 25% 50%, black 30%, transparent 70%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at 25% 50%, black 30%, transparent 70%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 top-1/2 h-[320px] w-[320px] -translate-y-1/2 animate-halo blur-3xl"
          style={{ background: HALO_GRADIENT }}
        />

        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <CompanyLogo name={company.name} logoUrl={company.logo_url} size="lg" />
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-primary/70" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary/80">
                  Engagement File
                </p>
              </div>
              <h1 className="truncate text-3xl font-semibold leading-tight tracking-tight">
                {company.name}
              </h1>
              {company.legal_name && company.legal_name !== company.name && (
                <p className="mt-1 text-xs text-muted-foreground">{company.legal_name}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {company.industry && <Pill tone="primary">{company.industry}</Pill>}
                {company.engagement_type && (
                  <Pill tone="outline">{company.engagement_type.toUpperCase()}</Pill>
                )}
                {company.target_exchange && (
                  <Pill tone="muted">{company.target_exchange.toUpperCase()}</Pill>
                )}
                <Pill tone="outline">{company.country}</Pill>
              </div>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/25 px-3 py-1.5 text-[11px] text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {company.status === 'active' || !company.status ? 'Active engagement' : company.status}
          </div>
        </div>
      </section>

      {/* Executive Summary */}
      <section>
        <SectionLabel>Executive summary</SectionLabel>
        <div className="relative mt-4 overflow-hidden rounded-xl border border-border/50 bg-card/30 p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-32 w-32 opacity-40 blur-2xl"
            style={{ background: HALO_GRADIENT }}
          />
          <div className="relative">
            {summaryLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating summary…
              </div>
            ) : summary ? (
              <p className="max-w-3xl text-[15px] leading-relaxed text-foreground/90">
                {summary}
              </p>
            ) : (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 ring-1 ring-inset ring-primary/20">
                  <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm font-medium">Summary pending</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Upload documents to generate an executive summary.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Financial Snapshot */}
      {fin && (
        <section>
          <SectionLabel>Financial snapshot</SectionLabel>
          <div className="stagger-children mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Revenue"
              value={`${currency}${formatNum(revenue)}`}
              icon={BarChart3}
              caption={
                revenueGrowth !== null ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1',
                      revenueGrowth >= 0 ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {revenueGrowth >= 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {Math.abs(revenueGrowth).toFixed(1)}% YoY
                  </span>
                ) : (
                  'Latest period'
                )
              }
            />
            <StatCard
              label="Net Income"
              value={`${currency}${formatNum(netIncome)}`}
              icon={netIncome !== null && netIncome >= 0 ? TrendingUp : TrendingDown}
              caption={
                netIncome === null
                  ? '—'
                  : netIncome >= 0
                  ? 'Profitable'
                  : 'Loss-making'
              }
              accent={netIncome !== null && netIncome < 0 ? 'warn' : undefined}
            />
            <StatCard
              label="Gross Margin"
              value={grossMargin !== null ? `${grossMargin.toFixed(1)}%` : '—'}
              icon={Percent}
              caption={
                grossMargin === null
                  ? '—'
                  : grossMargin > 50
                  ? 'Healthy'
                  : 'Monitor'
              }
            />
            <StatCard
              label="Total Assets"
              value={`${currency}${formatNum(totalAssets)}`}
              icon={Wallet}
              caption="Balance sheet"
            />
          </div>
        </section>
      )}

      {/* Financial Performance */}
      {fin && (
        <section>
          <SectionLabel>Financial performance</SectionLabel>
          {hasFinancialCharts ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {trendData.length > 0 && (
                <ChartCard title="Revenue & Profitability" subtitle="By reporting period">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="oklch(0.30 0.014 260)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 11, fill: 'oklch(0.65 0.01 260)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'oklch(0.65 0.01 260)' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatNum(Number(v))}
                      />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={currencyFmt} />
                      <Bar
                        dataKey="Revenue"
                        fill={CHART_COLORS[0]}
                        radius={[4, 4, 0, 0]}
                        name="Revenue"
                      />
                      <Bar
                        dataKey="Gross Profit"
                        fill={CHART_COLORS[2]}
                        radius={[4, 4, 0, 0]}
                        name="Gross Profit"
                      />
                      <Bar
                        dataKey="Net Income"
                        fill={CHART_COLORS[1]}
                        radius={[4, 4, 0, 0]}
                        name="Net Income"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {marginData.length > 0 && (
                <ChartCard title="Margin Analysis" subtitle="Gross vs. net, percent">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={marginData}>
                      <defs>
                        <linearGradient id="gmFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="nmFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="oklch(0.30 0.014 260)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 11, fill: 'oklch(0.65 0.01 260)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'oklch(0.65 0.01 260)' }}
                        axisLine={false}
                        tickLine={false}
                        unit="%"
                      />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={percentFmt} />
                      <Area
                        type="monotone"
                        dataKey="Gross Margin"
                        stroke={CHART_COLORS[0]}
                        strokeWidth={2}
                        fill="url(#gmFill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="Net Margin"
                        stroke={CHART_COLORS[1]}
                        strokeWidth={2}
                        fill="url(#nmFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {revenueBreakdown.length > 0 && (
                <ChartCard title="Revenue Breakdown" subtitle="By source">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {revenueBreakdown.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={currencyFmt} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Legend
                    items={revenueBreakdown.map((d, i) => ({
                      name: d.name,
                      color: CHART_COLORS[i % CHART_COLORS.length],
                    }))}
                  />
                </ChartCard>
              )}

              {bsData.length > 0 && (
                <ChartCard title="Asset Composition" subtitle="Current vs. non-current">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={bsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {bsData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={currencyFmt} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Legend
                    items={bsData.map((d, i) => ({
                      name: `${d.name} (${currency}${formatNum(d.value)})`,
                      color: CHART_COLORS[i % CHART_COLORS.length],
                    }))}
                  />
                </ChartCard>
              )}
            </div>
          ) : (
            <EmptyPanel
              icon={BarChart3}
              title="Financial charts unlock after extraction"
              description="Upload income statements and balance sheets to surface revenue, margin, and asset visuals."
            />
          )}
        </section>
      )}

      {/* Corporate Structure — shareholders, directors, org chart narrative */}
      {intel && ((intel.shareholders?.length ?? 0) > 0 || (intel.key_personnel?.length ?? 0) > 0 || intel.org_chart_summary) && (
        <section>
          <SectionLabel>Corporate structure</SectionLabel>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(intel.shareholders?.length ?? 0) > 0 && (
              <ShareholdersCard shareholders={intel.shareholders!} />
            )}
            {(intel.key_personnel?.length ?? 0) > 0 && (
              <PersonnelCard personnel={intel.key_personnel!} />
            )}
            {intel.org_chart_summary && (
              <OrgChartNarrative summary={intel.org_chart_summary} />
            )}
          </div>
        </section>
      )}

      {/* Intelligence */}
      <section>
        <SectionLabel>Intelligence</SectionLabel>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {/* Risk Flags */}
          <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/30 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 ring-1 ring-inset ring-amber-500/20">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold">Risk Flags</h3>
              </div>
              {intel && intel.risk_flags.length > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/25">
                  {intel.risk_flags.length}
                </span>
              )}
            </div>
            {!intel || intel.risk_flags.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                No risk flags detected
              </div>
            ) : (
              <div className="space-y-2">
                {intel.risk_flags.map((flag, i) => {
                  const meta = SEVERITY_META[flag.severity] || SEVERITY_META.medium;
                  const Icon = meta.icon;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex items-start gap-3 rounded-lg px-3 py-2.5 ring-1 ring-inset',
                        meta.bg,
                        meta.ring,
                      )}
                    >
                      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', meta.tone)} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{flag.title}</p>
                        <p className="text-xs text-muted-foreground">{flag.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Document Intelligence */}
          <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/30 p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 ring-1 ring-inset ring-primary/20">
                <FileSearch className="h-3.5 w-3.5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold">Document Intelligence</h3>
            </div>
            {intel ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat
                    label="Uploaded"
                    value={intel.cross_reference.total_documents}
                  />
                  <MiniStat
                    label="Extracted"
                    value={intel.cross_reference.extracted}
                    tone="primary"
                  />
                  <MiniStat
                    label="Doc types"
                    value={intel.cross_reference.document_types.length}
                  />
                </div>
                {intel.cross_reference.cross_referenced && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <p className="text-xs">
                      <span className="font-medium">
                        {intel.cross_reference.extracted} documents cross-referenced
                      </span>{' '}
                      — data validated across sources
                    </p>
                  </div>
                )}
                {intel.cross_reference.processing > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {intel.cross_reference.processing} document(s) processing
                  </div>
                )}
                {intel.cross_reference.document_types.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {intel.cross_reference.document_types.map((t) => (
                      <Pill key={t} tone="muted">
                        {t}
                      </Pill>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Upload documents to see intelligence.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Engagement Timeline */}
      {intel && (
        <section>
          <SectionLabel>Engagement timeline</SectionLabel>
          <div className="mt-4 rounded-xl border border-border/50 bg-card/30 p-6">
            <div className="relative space-y-4 pl-6">
              <div className="absolute bottom-2 left-[9px] top-2 w-px bg-border/50" />
              {(() => {
                const completed = [...intel.timeline].sort((a, b) =>
                  (a.timestamp || '').localeCompare(b.timestamp || ''),
                );
                const hasDocuments = intel.cross_reference.total_documents > 0;
                const hasExtracted = intel.cross_reference.extracted > 0;
                const hasReports = completed.some((t) => t.type === 'report_generated');

                const upcoming: Array<{
                  title: string;
                  detail: string;
                  icon: keyof typeof TIMELINE_ICONS;
                }> = [];

                if (!hasDocuments) {
                  upcoming.push({
                    title: 'Upload company documents',
                    detail: 'Prospectus, financial statements, corporate docs',
                    icon: 'document_uploaded',
                  });
                }
                if (hasDocuments && !hasExtracted) {
                  upcoming.push({
                    title: 'AI extraction in progress',
                    detail: 'Extracting structured data from documents',
                    icon: 'extraction_completed',
                  });
                }
                if (!hasReports) {
                  upcoming.push({
                    title: 'Generate Industry Expert Report',
                    detail: 'Market research and competitive landscape',
                    icon: 'report_generated',
                  });
                  upcoming.push({
                    title: 'Generate Due Diligence Report',
                    detail: 'Financial DD, internal controls, risk assessment',
                    icon: 'report_generated',
                  });
                  upcoming.push({
                    title: 'Generate Valuation Report',
                    detail: 'DCF, comparable companies, sensitivity analysis',
                    icon: 'report_generated',
                  });
                } else {
                  const generatedTypes = new Set(
                    completed
                      .filter((t) => t.type === 'report_generated')
                      .map((t) => {
                        if (t.detail.toLowerCase().includes('industry')) return 'industry';
                        if (
                          t.detail.toLowerCase().includes('due diligence') ||
                          t.detail.toLowerCase().includes('dd')
                        )
                          return 'dd';
                        if (t.detail.toLowerCase().includes('valuation')) return 'valuation';
                        return '';
                      }),
                  );
                  if (!generatedTypes.has('industry'))
                    upcoming.push({
                      title: 'Generate Industry Expert Report',
                      detail: 'Market research and competitive landscape',
                      icon: 'report_generated',
                    });
                  if (!generatedTypes.has('dd'))
                    upcoming.push({
                      title: 'Generate Due Diligence Report',
                      detail: 'Financial DD and risk assessment',
                      icon: 'report_generated',
                    });
                  if (!generatedTypes.has('valuation'))
                    upcoming.push({
                      title: 'Generate Valuation Report',
                      detail: 'DCF and comparable company analysis',
                      icon: 'report_generated',
                    });
                }
                upcoming.push({
                  title: 'Export final deliverables',
                  detail: 'Branded PDF reports ready for client delivery',
                  icon: 'report_generated',
                });

                return (
                  <>
                    {completed.map((item, i) => {
                      const Icon = TIMELINE_ICONS[item.type] || Clock;
                      return (
                        <div key={`done-${i}`} className="relative flex items-start gap-3">
                          <div className="absolute -left-6 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-primary/50 bg-primary/10">
                            <Icon className="h-3 w-3 text-primary" />
                          </div>
                          <div className="min-w-0 pt-px">
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {item.detail}
                            </p>
                            {item.timestamp && (
                              <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                                {new Date(item.timestamp).toLocaleDateString('en-MY', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {upcoming.map((item, i) => {
                      const Icon = TIMELINE_ICONS[item.icon] || Clock;
                      return (
                        <div
                          key={`todo-${i}`}
                          className="relative flex items-start gap-3 opacity-40"
                        >
                          <div className="absolute -left-6 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-dashed border-muted-foreground/30 bg-card">
                            <Icon className="h-3 w-3 text-muted-foreground/50" />
                          </div>
                          <div className="min-w-0 pt-px">
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.detail}</p>
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------ helpers ------------------------------ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Sparkles className="h-3 w-3 text-primary/60" />
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        {children}
      </p>
      <span className="h-px flex-1 bg-border/40" />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  caption: React.ReactNode;
  accent?: 'warn';
}

function StatCard({ label, value, icon: Icon, caption, accent }: StatCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/30 p-5">
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent',
          accent === 'warn' ? 'via-amber-400/50' : 'via-primary/40',
        )}
      />
      <div className="relative flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-inset',
            accent === 'warn'
              ? 'bg-amber-400/10 ring-amber-400/25'
              : 'bg-primary/10 ring-primary/20',
          )}
        >
          <Icon
            className={cn(
              'h-3.5 w-3.5',
              accent === 'warn' ? 'text-amber-400' : 'text-primary',
            )}
            strokeWidth={2}
          />
        </div>
      </div>
      <p className="font-numeric relative mt-4 text-3xl font-semibold tracking-tight">
        {value}
      </p>
      <div className="relative mt-1 truncate text-xs text-muted-foreground">
        {caption}
      </div>
    </article>
  );
}

interface PillProps {
  tone: 'primary' | 'outline' | 'muted';
  children: React.ReactNode;
}

function Pill({ tone, children }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        tone === 'primary' &&
          'bg-primary/12 text-primary ring-1 ring-inset ring-primary/25',
        tone === 'outline' &&
          'border border-border/60 bg-muted/20 text-muted-foreground',
        tone === 'muted' && 'bg-muted/40 text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/30 p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="h-52">{children}</div>
    </div>
  );
}

interface LegendProps {
  items: Array<{ name: string; color: string }>;
}

function Legend({ items }: LegendProps) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-3">
      {items.map((d) => (
        <div
          key={d.name}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
          {d.name}
        </div>
      ))}
    </div>
  );
}

interface MiniStatProps {
  label: string;
  value: number;
  tone?: 'primary';
}

function MiniStat({ label, value, tone }: MiniStatProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/15 px-3 py-2 text-center">
      <div
        className={cn(
          'font-numeric text-lg font-semibold',
          tone === 'primary' && 'text-primary',
        )}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function ShareholdersCard({ shareholders }: { shareholders: Shareholder[] }) {
  const maxPct = Math.max(...shareholders.map((s) => s.percentage ?? 0), 1);
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/30 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 ring-1 ring-inset ring-primary/20">
            <Network className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold">Shareholders</h3>
        </div>
        <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {shareholders.length}
        </span>
      </div>
      <ul className="space-y-2">
        {shareholders.map((s, i) => {
          const pct = s.percentage ?? null;
          const widthPct = pct !== null ? Math.max(2, (pct / maxPct) * 100) : 0;
          return (
            <li key={`${s.name}-${i}`} className="relative overflow-hidden rounded-lg border border-border/40 bg-muted/15 px-3 py-2.5">
              {pct !== null && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 bg-primary/10"
                  style={{ width: `${widthPct}%` }}
                />
              )}
              <div className="relative flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 truncate">
                    {s.source}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  {pct !== null && (
                    <span className="font-numeric text-sm font-semibold text-primary">
                      {pct.toFixed(2)}%
                    </span>
                  )}
                  {s.shares !== null && s.shares !== undefined && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {s.shares.toLocaleString()} shares
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PersonnelCard({ personnel }: { personnel: Personnel[] }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/30 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 ring-1 ring-inset ring-primary/20">
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold">Directors &amp; Key Personnel</h3>
        </div>
        <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {personnel.length}
        </span>
      </div>
      <ul className="space-y-2">
        {personnel.map((p, i) => (
          <li
            key={`${p.name}-${i}`}
            className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/15 px-3 py-2.5"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-inset ring-primary/20">
              <UserCircle2 className="h-3.5 w-3.5 text-primary/80" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{p.name}</p>
                {p.title && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary ring-1 ring-inset ring-primary/25">
                    {p.title}
                  </span>
                )}
              </div>
              {p.background && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  {p.background}
                </p>
              )}
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/60 truncate">
                {p.source}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OrgChartNarrative({ summary }: { summary: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/30 p-6 md:col-span-2">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 ring-1 ring-inset ring-primary/20">
          <Network className="h-3.5 w-3.5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold">Org Chart Summary</h3>
        <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          From uploaded diagram
        </span>
      </div>
      <p className="max-w-3xl text-[13px] leading-relaxed text-foreground/85">{summary}</p>
    </div>
  );
}

interface EmptyPanelProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

function EmptyPanel({ icon: Icon, title, description }: EmptyPanelProps) {
  return (
    <div className="mt-4 flex items-start gap-4 rounded-xl border border-dashed border-border/60 bg-card/20 p-6">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-inset ring-primary/20">
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
