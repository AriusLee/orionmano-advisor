'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  FileText,
  PenSquare,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';

import { useAuth } from '@/lib/auth-context';
import { apiJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CompanyLogo } from '@/components/company-logo';

interface Company {
  id: string;
  name: string;
  industry: string | null;
  status: string;
  engagement_type: string | null;
  tier?: string | null;
  logo_url?: string | null;
  created_at: string;
}

interface Report {
  id: string;
  report_type: string;
  status: string;
  created_at: string;
}

interface Document {
  id: string;
  extraction_status: string;
}

const HALO_GRADIENT =
  'radial-gradient(circle at center, color-mix(in oklch, var(--primary) 22%, transparent), transparent 65%)';

const REPORT_STROKE = 'oklch(0.65 0.15 250)';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [docsByCompany, setDocsByCompany] = useState<Record<string, Document[]>>({});

  useEffect(() => {
    if (!user) return;
    apiJson<Company[]>('/companies')
      .then(async (comps) => {
        setCompanies(comps);
        const docs: Record<string, Document[]> = {};
        let allReports: Report[] = [];
        for (const c of comps.slice(0, 20)) {
          try {
            const r = await apiJson<Report[]>(`/companies/${c.id}/reports`);
            allReports = [...allReports, ...r];
          } catch {
            /* skip */
          }
          try {
            const d = await apiJson<Document[]>(`/companies/${c.id}/documents`);
            docs[c.id] = d;
          } catch {
            docs[c.id] = [];
          }
        }
        setReports(allReports);
        setDocsByCompany(docs);
      })
      .catch(() => {});
  }, [user]);

  const totalDocs = useMemo(
    () => Object.values(docsByCompany).reduce((a, d) => a + d.length, 0),
    [docsByCompany],
  );
  const extractedDocs = useMemo(
    () =>
      Object.values(docsByCompany)
        .flat()
        .filter((d) => d.extraction_status === 'completed').length,
    [docsByCompany],
  );
  const draftReports = reports.filter((r) => r.status === 'draft').length;
  const needsAttention = useMemo(() => {
    return companies.filter((c) => {
      const docs = docsByCompany[c.id] || [];
      return (
        !c.industry ||
        docs.length === 0 ||
        docs.some((d) => d.extraction_status === 'failed')
      );
    }).length;
  }, [companies, docsByCompany]);

  const activityData = useMemo(() => {
    const days: Record<string, { companies: number; reports: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days[key] = { companies: 0, reports: 0 };
    }
    companies.forEach((c) => {
      const key = new Date(c.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      if (days[key]) days[key].companies++;
    });
    reports.forEach((r) => {
      const key = new Date(r.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      if (days[key]) days[key].reports++;
    });
    return Object.entries(days).map(([date, data]) => ({ date, ...data }));
  }, [companies, reports]);

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/30 px-8 py-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-grid-drift opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage:
              'radial-gradient(ellipse at 20% 50%, black 30%, transparent 70%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at 20% 50%, black 30%, transparent 70%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-1/2 h-[380px] w-[380px] -translate-y-1/2 animate-halo blur-3xl"
          style={{ background: HALO_GRADIENT }}
        />

        <div className="relative flex items-start justify-between gap-6">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-primary/70" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-primary/80">
                Command Center
              </p>
            </div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight">
              Welcome back, {firstName}.
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
              {companies.length === 0
                ? 'Start by creating your first engagement — AI will handle the rest.'
                : `Tracking ${companies.length} ${companies.length === 1 ? 'engagement' : 'engagements'} across ${totalDocs} ${totalDocs === 1 ? 'document' : 'documents'}.`}
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-muted/25 px-3 py-1.5 text-[11px] text-muted-foreground sm:inline-flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            All systems active
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <section>
        <SectionLabel>At a glance</SectionLabel>
        <div className="stagger-children mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Active Engagements"
            value={companies.length}
            caption={
              companies.length === 0
                ? 'None yet — create your first'
                : `${companies.filter((c) => !c.status || c.status === 'active').length} active`
            }
            icon={Building2}
            onClick={() => router.push('/companies')}
          />
          <StatCard
            label="Documents"
            value={totalDocs}
            caption={
              totalDocs === 0
                ? 'Awaiting first upload'
                : `${extractedDocs} extracted · ${totalDocs - extractedDocs} pending`
            }
            icon={FileText}
          />
          <StatCard
            label="Reports in Draft"
            value={draftReports}
            caption={
              reports.length === 0
                ? 'No reports generated yet'
                : `${reports.length} total across engagements`
            }
            icon={PenSquare}
          />
          <StatCard
            label="Needs Attention"
            value={needsAttention}
            caption={
              needsAttention === 0
                ? companies.length === 0
                  ? 'Nothing to review'
                  : 'All engagements on track'
                : 'Missing industry, docs, or failed extractions'
            }
            icon={AlertCircle}
            accent={needsAttention > 0 ? 'warn' : undefined}
            onClick={needsAttention > 0 ? () => router.push('/companies') : undefined}
          />
        </div>
      </section>

      {/* Activity */}
      <section>
        <SectionLabel>Activity</SectionLabel>
        <div className="relative mt-4 overflow-hidden rounded-xl border border-border/50 bg-card/30 p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Last 7 days</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Engagement and reporting cadence
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: 'var(--primary)' }}
                />
                Companies
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: REPORT_STROKE }}
                />
                Reports
              </span>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={activityData}
                margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
              >
                <defs>
                  <linearGradient id="fillCompanies" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillReports" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={REPORT_STROKE} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={REPORT_STROKE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(0.30 0.014 260)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'oklch(0.65 0.01 260)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'oklch(0.65 0.01 260)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'oklch(0.20 0.014 260)',
                    border: '1px solid oklch(0.30 0.014 260)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'oklch(0.93 0.006 260)' }}
                />
                <Area
                  type="monotone"
                  dataKey="companies"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#fillCompanies)"
                  name="Companies"
                />
                <Area
                  type="monotone"
                  dataKey="reports"
                  stroke={REPORT_STROKE}
                  strokeWidth={2}
                  fill="url(#fillReports)"
                  name="Reports"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Recent engagements */}
      {companies.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-3">
            <SectionLabel>Recent engagements</SectionLabel>
            <button
              onClick={() => router.push('/companies')}
              className="group flex shrink-0 cursor-pointer items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
          <div className="mt-4 divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50 bg-card/30">
            {companies.slice(0, 5).map((c) => {
              const docs = docsByCompany[c.id] || [];
              const ready = !!c.industry && docs.length > 0;
              return (
                <button
                  key={c.id}
                  onClick={() => router.push(`/companies/${c.id}`)}
                  className="group flex w-full cursor-pointer items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-muted/25"
                >
                  <CompanyLogo name={c.name} logoUrl={c.logo_url} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.industry || 'No industry set'} · {docs.length}{' '}
                      {docs.length === 1 ? 'doc' : 'docs'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {c.engagement_type && (
                      <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {c.engagement_type}
                      </span>
                    )}
                    <span
                      className={cn(
                        'text-[10px] font-semibold uppercase tracking-wider',
                        ready ? 'text-primary/90' : 'text-amber-400/80',
                      )}
                    >
                      {ready ? 'Ready' : 'Setup'}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-foreground/60" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

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
  value: number;
  caption: string;
  icon: LucideIcon;
  onClick?: () => void;
  accent?: 'warn';
}

function StatCard({ label, value, caption, icon: Icon, onClick, accent }: StatCardProps) {
  const interactive = !!onClick;
  return (
    <article
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border/50 bg-card/30 p-5 transition-all duration-200',
        interactive &&
          'cursor-pointer hover:-translate-y-px hover:border-border hover:bg-card/50',
      )}
    >
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent',
          accent === 'warn' ? 'via-amber-400/50' : 'via-primary/40',
        )}
      />
      {interactive && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              accent === 'warn'
                ? 'radial-gradient(circle, oklch(0.78 0.15 75 / 0.22), transparent 70%)'
                : 'radial-gradient(circle, color-mix(in oklch, var(--primary) 22%, transparent), transparent 70%)',
          }}
        />
      )}

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
      <p className="font-numeric relative mt-4 text-4xl font-semibold tracking-tight">
        {value}
      </p>
      <p className="relative mt-1 truncate text-xs text-muted-foreground">{caption}</p>
    </article>
  );
}
