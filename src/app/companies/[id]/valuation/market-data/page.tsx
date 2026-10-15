'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText, Globe2, Loader2, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, apiJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ValuationNav, ValuationPageHeader } from '@/components/valuation/valuation-nav';
import { fmtDate } from '@/lib/valuation-format';

interface Source {
  url: string;
  title?: string | null;
  publisher?: string | null;
  published_date?: string | null;
  quote?: string | null;
}

interface EvidenceRow {
  id: string;
  assumption_key: string;
  label: string;
  value_display: string | null;
  assessment: string;
  market_range: string | null;
  finding: string | null;
  sources: Source[];
  searched_at: string | null;
  error: string | null;
}

interface VersionLite {
  id: string;
  version_no: number;
  status: string;
  trigger_label: string;
  note: string | null;
  created_at: string | null;
}

interface ReportLite {
  id: string;
  title: string;
  status: string;
  progress_message: string | null;
  created_at: string | null;
}

interface EvidenceResponse {
  version: VersionLite | null;
  rows: EvidenceRow[];
  running: boolean;
  reports: ReportLite[];
  assumptions: string[];
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const ASSESSMENT: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }> = {
  supported: { label: 'Supported', variant: 'success' },
  partially_supported: { label: 'Partially supported', variant: 'warning' },
  not_supported: { label: 'Not supported', variant: 'danger' },
  insufficient_data: { label: 'Insufficient data', variant: 'neutral' },
  pending: { label: 'Searching…', variant: 'info' },
  failed: { label: 'Search failed', variant: 'danger' },
};

export default function MarketDataPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [versionsList, setVersionsList] = useState<VersionLite[]>([]);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [data, setData] = useState<EvidenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      const q = versionId ? `?version_id=${versionId}` : '';
      setData(await apiJson<EvidenceResponse>(`/companies/${id}/valuation/market-evidence${q}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load market data');
    } finally {
      setLoading(false);
    }
  }, [id, versionId]);

  useEffect(() => {
    apiJson<VersionLite[]>(`/companies/${id}/valuation/versions`).then(setVersionsList).catch(() => {});
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const busy = data?.running || data?.reports.some((r) => r.status === 'pending' || r.status === 'generating');
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [busy, load]);

  const run = async (keys?: string[]) => {
    if (!keys && !confirm('Search live market data for every key assumption, then write the Market Data Supported report? This makes several web searches per assumption and takes a few minutes.')) return;
    setStarting(true);
    try {
      await apiFetch(`/companies/${id}/valuation/market-evidence`, {
        method: 'POST',
        body: JSON.stringify({ version_id: data?.version?.id ?? null, keys: keys ?? null, make_report: !keys }),
      });
      toast.success(keys ? 'Re-checking…' : 'Searching market data — the report follows when every assumption is checked');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start');
    } finally {
      setStarting(false);
    }
  };

  const makeReport = async () => {
    try {
      await apiFetch(`/companies/${id}/valuation/market-evidence/report`, {
        method: 'POST',
        body: JSON.stringify({ version_id: data?.version?.id ?? null }),
      });
      toast.success('Writing the Market Data Supported report…');
      setTimeout(load, 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start the report');
    }
  };

  const rows = data?.rows ?? [];
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.assessment] = (acc[r.assessment] ?? 0) + 1;
    return acc;
  }, {});
  const hasEvidence = rows.some((r) => r.assessment !== 'pending' && r.assessment !== 'failed');

  return (
    <div className="space-y-6 pb-16">
      <ValuationPageHeader
        icon={Globe2}
        title="Market data check"
        description="Checks each key assumption of a valuation version against current market data found by live web search, with every source's link and date. The result feeds the Market Data Supported version of the valuation report."
        action={
          <Button onClick={() => run()} disabled={starting || data?.running || !data?.version} className="cursor-pointer">
            {starting || data?.running ? <Loader2 className="animate-spin" /> : <Search />}
            {rows.length ? 'Re-check all and write report' : 'Check assumptions and write report'}
          </Button>
        }
      />
      <ValuationNav companyId={id} />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.version ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Generate a valuation first — the check runs against a valuation version.
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Version
              <select
                value={data.version.id}
                onChange={(e) => setVersionId(e.target.value)}
                className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground cursor-pointer"
              >
                {versionsList.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_no}{v.status === 'active' ? ' (current)' : ''} — {v.note ?? v.trigger_label}
                  </option>
                ))}
              </select>
            </label>
            {rows.length > 0 &&
              Object.entries(counts).map(([k, n]) => (
                <Badge key={k} variant={ASSESSMENT[k]?.variant ?? 'neutral'}>
                  {n} {ASSESSMENT[k]?.label ?? k}
                </Badge>
              ))}
          </div>

          {(data.reports.length > 0 || hasEvidence) && (
            <Card className="gap-2 px-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-auto text-sm font-medium">Market Data Supported report</p>
                {hasEvidence && !data.running && (
                  <Button size="sm" variant="outline" onClick={makeReport} className="cursor-pointer">
                    <FileText /> Write report from this evidence
                  </Button>
                )}
              </div>
              {data.reports.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {data.running ? 'Written automatically once every assumption has been checked.' : 'No report written for this version yet.'}
                </p>
              ) : (
                <ul className="space-y-1">
                  {data.reports.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 text-xs">
                      {r.status === 'completed' ? (
                        <Link href={`/companies/${id}/reports/${r.id}`} className="text-primary hover:underline cursor-pointer">
                          {r.title}
                        </Link>
                      ) : (
                        <span>{r.title}</span>
                      )}
                      <Badge variant={r.status === 'completed' ? 'success' : r.status === 'failed' ? 'danger' : 'info'}>
                        {(r.status === 'pending' || r.status === 'generating') && <Loader2 className="animate-spin" />}
                        {r.status === 'generating' ? r.progress_message ?? 'Generating' : r.status}
                      </Badge>
                      <span className="text-muted-foreground">{fmtDate(r.created_at, true)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {rows.length === 0 ? (
            <Card className="p-8 text-sm text-muted-foreground">
              Not checked yet for v{data.version.version_no}. The check covers: {data.assumptions.join(', ')}.
            </Card>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => {
                const a = ASSESSMENT[r.assessment] ?? { label: r.assessment, variant: 'neutral' as const };
                return (
                  <Card
                    key={r.id}
                    className={cn(
                      'gap-2 px-5',
                      r.assessment === 'not_supported' && 'ring-red-500/30',
                      r.assessment === 'partially_supported' && 'ring-amber-500/25',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{r.label}</p>
                      <span className="font-mono text-sm text-muted-foreground">{r.value_display}</span>
                      <Badge variant={a.variant}>
                        {r.assessment === 'pending' && <Loader2 className="animate-spin" />}
                        {a.label}
                      </Badge>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => run([r.assumption_key])}
                        disabled={r.assessment === 'pending'}
                        className="ml-auto cursor-pointer"
                        title="Search again for this assumption"
                      >
                        <RefreshCw /> Re-check
                      </Button>
                    </div>
                    {r.market_range && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Market evidence: </span>
                        {r.market_range}
                      </p>
                    )}
                    {r.finding && <p className="text-sm text-muted-foreground">{r.finding}</p>}
                    {r.error && <p className="text-xs text-red-400">{r.error}</p>}
                    {r.sources.length > 0 && (
                      <ul className="mt-1 space-y-1 border-t border-border/40 pt-2">
                        {r.sources.map((s, i) => (
                          <li key={i} className="text-xs">
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer"
                            >
                              {s.publisher || s.title || hostOf(s.url)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            {s.title && s.publisher && <span className="text-muted-foreground"> — {s.title}</span>}
                            <span className="text-muted-foreground"> · {s.published_date || 'date n/a'}</span>
                            {s.quote && <span className="block pl-3 italic text-muted-foreground/80">“{s.quote}”</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.searched_at && <p className="text-[10px] text-muted-foreground/70">Searched {fmtDate(r.searched_at, true)}</p>}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
