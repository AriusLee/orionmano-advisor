'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Download, FileText, History, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { apiJson, uploadUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ValuationNav, ValuationPageHeader } from '@/components/valuation/valuation-nav';
import { changeTone, fmtDate, fmtMoney, fmtPct } from '@/lib/valuation-format';

interface VersionItem {
  id: string;
  version_no: number;
  status: string;
  trigger: string;
  trigger_label: string;
  note: string | null;
  qa_item_id: string | null;
  xlsx_url: string | null;
  xlsx_filename: string | null;
  report_id: string | null;
  ev: number | null;
  equity_value: number | null;
  currency: string | null;
  unit: string | null;
  error_count: number;
  created_at: string | null;
}

interface VersionChanges {
  against: { id: string; version_no: number } | null;
  params: { key: string; label: string; from: string; to: string }[];
  historical: { series: string; slot: string; from: number | null; to: number | null }[];
  ev: { from: number | null; to: number | null; equity_from: number | null; equity_to: number | null } | null;
}

const TRIGGER_TONE: Record<string, 'info' | 'success' | 'warning' | 'neutral'> = {
  generate: 'info',
  qa_change: 'warning',
  restore: 'neutral',
  regenerate_inputs: 'neutral',
  regenerate_xlsx: 'neutral',
  legacy_import: 'neutral',
};

export default function ValuationVersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [items, setItems] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  const load = useCallback(() => {
    apiJson<VersionItem[]>(`/companies/${id}/valuation/versions`)
      .then(setItems)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load versions'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const restore = async (v: VersionItem) => {
    if (!confirm(`Make v${v.version_no} the current valuation? This adds a new version; nothing is deleted.`)) return;
    setRestoring(v.id);
    try {
      const nv = await apiJson<VersionItem>(`/companies/${id}/valuation/versions/${v.id}/restore`, { method: 'POST' });
      toast.success(`v${v.version_no} restored as v${nv.version_no}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="space-y-6">
      <ValuationPageHeader
        icon={History}
        title="Valuation versions"
        description="Every workpaper run is kept as a version — generated, re-uploaded, changed through counterparty Q&A, or restored. One is current; the rest stay as history and can be restored."
      />
      <ValuationNav companyId={id} />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No valuation has been generated yet. Generate one on the{' '}
          <Link href={`/companies/${id}/valuation`} className="text-primary underline-offset-4 hover:underline">
            Workpaper
          </Link>{' '}
          tab.
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <div className="grid grid-cols-[2.5rem_4rem_minmax(0,1fr)_9rem_9rem_5rem_7.5rem_auto] items-center gap-3 border-b border-border/60 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span />
            <span>Version</span>
            <span>What happened</span>
            <span className="text-right">Enterprise value</span>
            <span className="text-right">Equity value</span>
            <span className="text-right">Δ EV</span>
            <span>Created</span>
            <span />
          </div>
          {items.map((v, i) => {
            const older = items[i + 1];
            const delta = older && older.ev && v.ev != null ? (v.ev - older.ev) / older.ev : null;
            const expanded = open === v.id;
            return (
              <div key={v.id} className="border-b border-border/40 last:border-b-0">
                <div className="grid grid-cols-[2.5rem_4rem_minmax(0,1fr)_9rem_9rem_5rem_7.5rem_auto] items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : v.id)}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted cursor-pointer"
                    aria-label={expanded ? 'Hide changes' : 'Show changes'}
                  >
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-semibold">v{v.version_no}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {v.status === 'active' && <Badge variant="success">Current</Badge>}
                      <Badge variant={TRIGGER_TONE[v.trigger] ?? 'neutral'}>{v.trigger_label}</Badge>
                      {v.error_count > 0 && <Badge variant="danger">{v.error_count} errors</Badge>}
                    </div>
                    {v.note && <p className="mt-1 truncate text-xs text-muted-foreground" title={v.note}>{v.note}</p>}
                  </div>
                  <span className="text-right font-mono text-sm tabular-nums">{fmtMoney(v.ev, v.currency, v.unit)}</span>
                  <span className="text-right font-mono text-sm tabular-nums">{fmtMoney(v.equity_value, v.currency, v.unit)}</span>
                  <span className={cn('text-right font-mono text-xs tabular-nums', changeTone(delta))}>
                    {delta == null ? '—' : fmtPct(delta, 1, true)}
                  </span>
                  <span className="text-xs text-muted-foreground">{fmtDate(v.created_at, true)}</span>
                  <div className="flex items-center justify-end gap-1">
                    {v.xlsx_url && (
                      <a href={uploadUrl(v.xlsx_url) ?? '#'} download className="cursor-pointer">
                        <Button variant="ghost" size="icon-sm" title="Download workpaper" className="cursor-pointer">
                          <Download />
                        </Button>
                      </a>
                    )}
                    {v.report_id && (
                      <Link href={`/companies/${id}/reports/${v.report_id}`} className="cursor-pointer">
                        <Button variant="ghost" size="icon-sm" title="Open the report for this version" className="cursor-pointer">
                          <FileText />
                        </Button>
                      </Link>
                    )}
                    {v.status !== 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restore(v)}
                        disabled={restoring === v.id}
                        className="cursor-pointer"
                      >
                        {restoring === v.id ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                        Restore
                      </Button>
                    )}
                  </div>
                </div>
                {expanded && <VersionDiff companyId={id} version={v} />}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function VersionDiff({ companyId, version }: { companyId: string; version: VersionItem }) {
  const [data, setData] = useState<VersionChanges | null>(null);

  useEffect(() => {
    apiJson<VersionChanges>(`/companies/${companyId}/valuation/versions/${version.id}/changes`)
      .then(setData)
      .catch(() => setData({ against: null, params: [], historical: [], ev: null }));
  }, [companyId, version.id]);

  if (!data) {
    return (
      <div className="px-14 pb-4 text-xs text-muted-foreground">
        <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" /> Comparing…
      </div>
    );
  }
  if (!data.against) {
    return <p className="px-14 pb-4 text-xs text-muted-foreground">First version — nothing to compare with.</p>;
  }
  const none = data.params.length === 0 && data.historical.length === 0;
  return (
    <div className="space-y-3 bg-muted/10 px-14 pb-4 pt-1">
      <p className="text-[11px] text-muted-foreground">
        Compared with v{data.against.version_no}
        {data.ev && data.ev.from != null && data.ev.to != null && (
          <> · EV {fmtMoney(data.ev.from)} → {fmtMoney(data.ev.to, version.currency, version.unit)}</>
        )}
      </p>
      {none && <p className="text-xs text-muted-foreground">No parameter or historical figure changed (the difference comes from the AI&apos;s re-derived assumptions outside the tracked parameters, if any).</p>}
      {data.params.length > 0 && (
        <table className="w-full max-w-2xl text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="py-1 font-medium">Parameter</th>
              <th className="py-1 text-right font-medium">Before</th>
              <th className="py-1 text-right font-medium">After</th>
            </tr>
          </thead>
          <tbody>
            {data.params.map((p) => (
              <tr key={p.key} className="border-t border-border/40">
                <td className="py-1.5">{p.label}</td>
                <td className="py-1.5 text-right font-mono tabular-nums text-muted-foreground">{p.from}</td>
                <td className="py-1.5 text-right font-mono tabular-nums">{p.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data.historical.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
            Historical figures changed ({data.historical.length})
          </p>
          <table className="w-full max-w-2xl text-xs">
            <tbody>
              {data.historical.map((h, i) => (
                <tr key={i} className="border-t border-border/40">
                  <td className="py-1.5">{h.series.replaceAll('_', ' ')}</td>
                  <td className="py-1.5 text-muted-foreground">{h.slot}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-muted-foreground">{h.from == null ? '—' : h.from.toLocaleString('en-US')}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{h.to == null ? '—' : h.to.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
