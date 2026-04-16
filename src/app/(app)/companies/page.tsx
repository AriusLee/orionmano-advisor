'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiJson } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Plus, Building2, Search, ChevronRight, Crown, Star, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CompanyLogo } from '@/components/company-logo';

interface Company {
  id: string;
  name: string;
  legal_name: string | null;
  industry: string | null;
  country: string;
  status: string;
  engagement_type: string | null;
  report_tier?: string | null;
  logo_url?: string | null;
  created_at: string;
}

const TIER_META: Record<string, { icon: LucideIcon; label: string; text: string; ring: string; bg: string }> = {
  essential: { icon: Zap,   label: 'Essential', text: 'text-slate-300', ring: 'ring-slate-500/25', bg: 'bg-slate-500/10' },
  standard:  { icon: Star,  label: 'Standard',  text: 'text-blue-400',  ring: 'ring-blue-500/25',  bg: 'bg-blue-500/10' },
  premium:   { icon: Crown, label: 'Premium',   text: 'text-amber-400', ring: 'ring-amber-500/25', bg: 'bg-amber-500/10' },
};

const STATUS_META: Record<string, { dot: string; label: string; text: string }> = {
  active:    { dot: 'bg-emerald-500', label: 'Active',    text: 'text-emerald-400' },
  on_hold:   { dot: 'bg-amber-500',   label: 'On Hold',   text: 'text-amber-400' },
  completed: { dot: 'bg-blue-500',    label: 'Completed', text: 'text-blue-400' },
  archived:  { dot: 'bg-slate-500',   label: 'Archived',  text: 'text-muted-foreground' },
};

type StatusFilter = 'all' | 'active' | 'on_hold' | 'completed' | 'archived';
type TierFilter = 'all' | 'essential' | 'standard' | 'premium';

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'active',    label: 'Active' },
  { id: 'on_hold',   label: 'On Hold' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived',  label: 'Archived' },
];

const TIER_TABS: { id: TierFilter; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'essential', label: 'Essential' },
  { id: 'standard',  label: 'Standard' },
  { id: 'premium',   label: 'Premium' },
];

export default function CompaniesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');

  useEffect(() => {
    if (user) {
      apiJson<Company[]>('/companies').then(setCompanies).catch(() => {});
    }
  }, [user]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: companies.length };
    for (const c of companies) counts[c.status] = (counts[c.status] ?? 0) + 1;
    return counts;
  }, [companies]);

  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { all: companies.length };
    for (const c of companies) {
      const t = (c.report_tier || 'standard').toLowerCase();
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [companies]);

  const industryCount = useMemo(() => {
    const set = new Set<string>();
    companies.forEach((c) => c.industry && set.add(c.industry));
    return set.size;
  }, [companies]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (tierFilter !== 'all' && (c.report_tier || 'standard').toLowerCase() !== tierFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.legal_name?.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.engagement_type?.toLowerCase().includes(q)
      );
    });
  }, [companies, search, statusFilter, tierFilter]);

  const activeCount = statusCounts.active ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          {companies.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono tabular-nums text-foreground/90">{activeCount}</span>{' '}
              active engagement{activeCount === 1 ? '' : 's'}
              {industryCount > 0 && (
                <>
                  {' · '}
                  <span className="font-mono tabular-nums text-foreground/90">{industryCount}</span>{' '}
                  {industryCount === 1 ? 'industry' : 'industries'}
                </>
              )}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push('/companies/new')}
          className="group relative inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_-4px_oklch(from_var(--primary)_l_c_h_/_0.5),inset_0_1px_0_oklch(1_0_0/0.2)] transition-all duration-150 cursor-pointer hover:brightness-110 hover:shadow-[0_6px_20px_-4px_oklch(from_var(--primary)_l_c_h_/_0.6),inset_0_1px_0_oklch(1_0_0/0.25)] active:brightness-95 active:translate-y-px"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          New Company
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, industry, country…"
          className="pl-9"
        />
      </div>

      {/* Filter row: status + tier */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <FilterRow label="Status">
          <SegmentedFilter
            tabs={STATUS_TABS}
            value={statusFilter}
            onChange={setStatusFilter}
            counts={statusCounts}
          />
        </FilterRow>
        <FilterRow label="Tier">
          <SegmentedFilter
            tabs={TIER_TABS}
            value={tierFilter}
            onChange={setTierFilter}
            counts={tierCounts}
          />
        </FilterRow>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          hasCompanies={companies.length > 0}
          hasQuery={!!search.trim() || statusFilter !== 'all' || tierFilter !== 'all'}
          search={search}
          onCreate={() => router.push('/companies/new')}
          onClearFilters={() => {
            setSearch('');
            setStatusFilter('all');
            setTierFilter('all');
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
          {/* Column headers */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_140px_120px_130px_110px_120px_28px] items-center gap-4 border-b border-border/60 bg-muted/20 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span>Company</span>
            <span>Industry</span>
            <span>Engagement</span>
            <span>Status</span>
            <span>Tier</span>
            <span>Created</span>
            <span />
          </div>

          {/* Rows */}
          <ul className="divide-y divide-border/40">
            {filtered.map((c) => {
              const status = STATUS_META[c.status] ?? STATUS_META.archived;
              return (
                <li
                  key={c.id}
                  onClick={() => router.push(`/companies/${c.id}`)}
                  className="group grid grid-cols-1 sm:grid-cols-[1fr_140px_120px_130px_110px_120px_28px] items-center gap-2 sm:gap-4 px-4 py-3 transition-colors cursor-pointer hover:bg-foreground/[0.03]"
                >
                  {/* Company name + logo (falls back to initials when no logo available) */}
                  <div className="flex items-center gap-3 min-w-0">
                    <CompanyLogo name={c.name} logoUrl={c.logo_url} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate leading-tight">{c.name}</p>
                      {c.legal_name && c.legal_name !== c.name && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{c.legal_name}</p>
                      )}
                    </div>
                  </div>

                  {/* Industry */}
                  <div className="hidden sm:block min-w-0">
                    {c.industry ? (
                      <span className="inline-flex items-center rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border truncate max-w-full">
                        {c.industry}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </div>

                  {/* Engagement */}
                  <div className="hidden sm:block">
                    {c.engagement_type ? (
                      <span className="inline-flex items-center rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {c.engagement_type.replace('_', ' ')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                    <span className={cn('text-[11px] font-medium', status.text)}>{status.label}</span>
                  </div>

                  {/* Tier */}
                  <div className="hidden sm:block">
                    {(() => {
                      const tierKey = (c.report_tier || 'standard').toLowerCase();
                      const tier = TIER_META[tierKey] ?? TIER_META.standard;
                      const TierIcon = tier.icon;
                      return (
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset',
                          tier.bg, tier.text, tier.ring,
                        )}>
                          <TierIcon className="h-3 w-3" strokeWidth={2.2} />
                          {tier.label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Created */}
                  <div className="hidden sm:block">
                    <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('en-MY', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Chevron */}
                  <div className="hidden sm:flex justify-end">
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 transition-all group-hover:text-foreground group-hover:translate-x-0.5" />
                  </div>

                  {/* Mobile secondary row */}
                  <div className="flex items-center gap-2 sm:hidden text-[11px] text-muted-foreground">
                    <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                    {status.label}
                    {(() => {
                      const tierKey = (c.report_tier || 'standard').toLowerCase();
                      const tier = TIER_META[tierKey] ?? TIER_META.standard;
                      const TierIcon = tier.icon;
                      return (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className={cn('inline-flex items-center gap-0.5', tier.text)}>
                            <TierIcon className="h-2.5 w-2.5" />
                            {tier.label}
                          </span>
                        </>
                      );
                    })()}
                    {c.industry && <span className="text-muted-foreground/40">·</span>}
                    {c.industry && <span>{c.industry}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Count footer */}
      {filtered.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Showing <span className="font-mono tabular-nums text-foreground/80">{filtered.length}</span>
          {filtered.length !== companies.length && (
            <>
              {' '}of <span className="font-mono tabular-nums text-foreground/80">{companies.length}</span>
            </>
          )}{' '}
          {companies.length === 1 ? 'company' : 'companies'}
        </p>
      )}
    </div>
  );
}

interface EmptyStateProps {
  hasCompanies: boolean;
  hasQuery: boolean;
  search: string;
  onCreate: () => void;
  onClearFilters: () => void;
}

function EmptyState({ hasCompanies, hasQuery, search, onCreate, onClearFilters }: EmptyStateProps) {
  // No companies at all → polished onboarding
  if (!hasCompanies) {
    return (
      <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-card/40 px-6 py-20 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, color-mix(in oklch, var(--primary) 12%, transparent), transparent 60%)',
          }}
        />
        <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-card ring-1 ring-foreground/15 shadow-[0_20px_50px_-20px_oklch(0_0_0/0.8),inset_0_1px_0_oklch(1_0_0/0.06)]">
          <Building2 className="h-7 w-7 text-primary" strokeWidth={1.5} />
        </div>
        <p className="relative text-lg font-semibold tracking-tight">No companies yet</p>
        <p className="relative mt-1.5 max-w-sm text-sm text-muted-foreground">
          Create your first company to begin an IPO, M&A, or advisory engagement.
        </p>
        <button
          onClick={onCreate}
          className="relative mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_-4px_oklch(from_var(--primary)_l_c_h_/_0.5),inset_0_1px_0_oklch(1_0_0/0.2)] transition-all duration-150 cursor-pointer hover:brightness-110"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          Create First Company
        </button>
      </div>
    );
  }

  // No results for active filter/search
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-muted/10 px-6 py-14 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40 ring-1 ring-inset ring-border">
        <Search className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">No matches</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {search ? (
          <>No companies match &ldquo;{search}&rdquo;</>
        ) : (
          <>Nothing matches the selected filter.</>
        )}
      </p>
      {hasQuery && (
        <button
          onClick={onClearFilters}
          className="mt-4 text-xs font-medium text-primary hover:underline cursor-pointer"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
        {label}
      </span>
      {children}
    </div>
  );
}

interface SegmentedFilterProps<T extends string> {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  counts: Record<string, number>;
}

function SegmentedFilter<T extends string>({ tabs, value, onChange, counts }: SegmentedFilterProps<T>) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
      {tabs.map((t) => {
        const count = counts[t.id] ?? 0;
        const isActive = value === t.id;
        const disabled = t.id !== 'all' && count === 0;
        return (
          <button
            key={t.id}
            onClick={() => !disabled && onChange(t.id)}
            disabled={disabled}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm ring-1 ring-foreground/10'
                : disabled
                  ? 'text-muted-foreground/30 cursor-not-allowed'
                  : 'text-muted-foreground cursor-pointer hover:text-foreground'
            )}
          >
            {t.label}
            {count > 0 && (
              <span
                className={cn(
                  'font-mono tabular-nums text-[10px]',
                  isActive ? 'text-muted-foreground' : 'text-muted-foreground/60'
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
