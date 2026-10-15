'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Landmark,
  Loader2,
  Lock,
  LockOpen,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, apiJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ValuationNav, ValuationPageHeader } from '@/components/valuation/valuation-nav';
import { PeriodPicker } from '@/components/documents/period-picker';
import { fmtDate, fmtNumber } from '@/lib/valuation-format';

interface Period {
  id: string;
  label: string;
  period_type: string;
  fiscal_year: number | null;
  locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  figure_count: number;
}

interface Cell {
  id: string;
  value: number | null;
  currency: string | null;
  unit: string | null;
  source_document_id: string | null;
  source_document_name: string | null;
  source_page: string | null;
  origin: string;
  updated_at: string | null;
}

interface Row {
  key: string;
  label: string;
  statement: string;
  in_model: boolean;
  empty?: boolean;
  values: Record<string, Cell>;
}

interface Discrepancy {
  id: string;
  period_label: string;
  line_item: string;
  line_label: string;
  current_value: number | null;
  current_currency: string | null;
  current_unit: string | null;
  document_value: number | null;
  document_currency: string | null;
  document_unit: string | null;
  document_name: string | null;
  source_page: string | null;
  kind: string;
}

interface Amendment {
  id: string;
  period_label: string;
  line_label: string;
  old_value: number | null;
  new_value: number | null;
  reason: string | null;
  action: string;
  was_locked: boolean;
  user: string | null;
  created_at: string | null;
}

interface DocRow {
  id: string;
  filename: string;
  target_period: string | null;
  extraction_status: string;
}

interface FinancialsData {
  periods: Period[];
  rows: Row[];
  statements: { key: string; label: string }[];
  discrepancies: Discrepancy[];
  amendments: Amendment[];
  documents: DocRow[];
}

function sourceText(c: Cell): string {
  const page = c.source_page ? (/^\d+$/.test(c.source_page) ? `p. ${c.source_page}` : c.source_page) : null;
  const doc = c.source_document_name ?? (c.origin === 'manual' ? 'Entered by analyst' : 'Source document removed');
  return [doc, page].filter(Boolean).join(', ');
}

function unitText(currency: string | null, unit: string | null): string {
  return [currency, unit].filter(Boolean).join(' ');
}

export default function HistoricalFiguresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<FinancialsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmpty, setShowEmpty] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [editing, setEditing] = useState<{ period: Period; row: Row } | null>(null);
  const [unlocking, setUnlocking] = useState<Period | null>(null);
  const [addingPeriod, setAddingPeriod] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  const load = useCallback(() => {
    return apiJson<FinancialsData>(`/companies/${id}/financials`)
      .then(setData)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load figures'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const lock = async (p: Period) => {
    try {
      await apiFetch(`/companies/${id}/financials/periods/${p.id}/lock`, {
        method: 'POST',
        body: JSON.stringify({ locked: true }),
      });
      toast.success(`${p.label} locked — these figures are now fixed in every valuation run`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lock failed');
    }
  };

  const resync = async () => {
    setResyncing(true);
    try {
      const r = await apiJson<{ written: number; discrepancies: number }>(`/companies/${id}/financials/resync`, { method: 'POST' });
      toast.success(`Re-read documents: ${r.written} figure(s) updated, ${r.discrepancies} difference(s) to review`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Re-read failed');
    } finally {
      setResyncing(false);
    }
  };

  const resolve = async (d: Discrepancy, accept: boolean) => {
    try {
      await apiFetch(`/companies/${id}/financials/discrepancies/${d.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ accept }),
      });
      toast.success(accept ? `${d.period_label} ${d.line_label} updated to the document's figure` : 'Dismissed — the figure stays');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const periods = data?.periods ?? [];
  const rowsByStatement = useMemo(() => {
    const out: Record<string, Row[]> = {};
    for (const r of data?.rows ?? []) {
      if (r.empty && !showEmpty) continue;
      (out[r.statement] ??= []).push(r);
    }
    return out;
  }, [data, showEmpty]);

  const periodUnit = (p: Period) => {
    for (const r of data?.rows ?? []) {
      const c = r.values[p.label];
      if (c) return unitText(c.currency, c.unit);
    }
    return '';
  };

  return (
    <div className="space-y-6 pb-16">
      <ValuationPageHeader
        icon={Landmark}
        title="Historical figures"
        description="The historical financials every valuation run is built on, with the document and page each figure came from. Lock a period once it is confirmed: from then on it is used verbatim, uploads can't change it, and any document that disagrees is flagged below for review."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAddingPeriod(true)} className="cursor-pointer">
              <Plus /> Add period
            </Button>
            <Button variant="outline" onClick={resync} disabled={resyncing} className="cursor-pointer">
              {resyncing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Re-read documents
            </Button>
          </div>
        }
      />
      <ValuationNav companyId={id} />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data || periods.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No financial figures yet. Upload audited accounts, a prospectus or management accounts — figures appear here once
          extraction finishes. You can also add a period and type figures in by hand.
        </Card>
      ) : (
        <>
          {data.discrepancies.length > 0 && (
            <Card className="gap-3 border-amber-500/30 px-4 ring-amber-500/30">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                {data.discrepancies.length} figure{data.discrepancies.length === 1 ? '' : 's'} to review — a document reports a different value
              </div>
              <ul className="space-y-2">
                {data.discrepancies.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/30 px-3 py-2 text-xs">
                    <span className="font-medium">{d.period_label} · {d.line_label}</span>
                    <span className="text-muted-foreground">
                      held <span className="font-mono text-foreground">{fmtNumber(d.current_value)}</span> {unitText(d.current_currency, d.current_unit)}
                      {' '}vs <span className="font-mono text-foreground">{fmtNumber(d.document_value)}</span> {unitText(d.document_currency, d.document_unit)}
                      {' '}in {d.document_name ?? 'a document'}{d.source_page ? `, p. ${d.source_page}` : ''}
                    </span>
                    <Badge variant={d.kind === 'comparative' ? 'neutral' : 'warning'}>
                      {d.kind === 'comparative' ? 'Comparative figure' : 'Locked period'}
                    </Badge>
                    <div className="ml-auto flex gap-1.5">
                      <Button size="xs" variant="outline" onClick={() => resolve(d, false)} className="cursor-pointer">
                        <X /> Keep ours
                      </Button>
                      <Button size="xs" onClick={() => resolve(d, true)} className="cursor-pointer">
                        <Check /> Use document&apos;s
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="gap-0 overflow-x-auto py-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Line item
                  </th>
                  {periods.map((p) => (
                    <th key={p.id} className="min-w-[9.5rem] px-3 py-2 text-right align-bottom">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-mono text-sm font-semibold">{p.label}</span>
                        {p.locked ? (
                          <button
                            type="button"
                            onClick={() => setUnlocking(p)}
                            title={`Locked${p.locked_by ? ` by ${p.locked_by}` : ''} ${fmtDate(p.locked_at)} — click to unlock`}
                            className="inline-flex h-6 items-center gap-1 rounded-md bg-amber-500/10 px-1.5 text-[10px] font-medium text-amber-400 ring-1 ring-inset ring-amber-500/25 cursor-pointer hover:bg-amber-500/20"
                          >
                            <Lock className="h-3 w-3" /> Locked
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => lock(p)}
                            title="Confirm and lock this period"
                            className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] text-muted-foreground ring-1 ring-inset ring-border cursor-pointer hover:text-foreground"
                          >
                            <LockOpen className="h-3 w-3" /> Lock
                          </button>
                        )}
                      </div>
                      <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                        {p.period_type === 'interim' ? 'Interim · ' : ''}
                        {periodUnit(p) || '—'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              {data.statements.map((st) =>
                (rowsByStatement[st.key] ?? []).length === 0 ? null : (
                  <tbody key={st.key}>
                    <tr>
                      <td
                        colSpan={periods.length + 1}
                        className="sticky left-0 bg-muted/20 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                      >
                        {st.label}
                      </td>
                    </tr>
                    {rowsByStatement[st.key].map((r) => (
                      <tr key={r.key} className="border-t border-border/30 hover:bg-muted/10">
                        <td className="sticky left-0 z-10 bg-card px-4 py-2">
                          <span className={cn(r.empty && 'text-muted-foreground')}>{r.label}</span>
                          {r.in_model && (
                            <span className="ml-1.5 text-[9px] uppercase tracking-wider text-primary/70" title="Feeds the valuation model's historical financials">
                              model
                            </span>
                          )}
                        </td>
                        {periods.map((p) => {
                          const c = r.values[p.label];
                          return (
                            <td key={p.id} className="px-3 py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() => setEditing({ period: p, row: r })}
                                title={c ? `Source: ${sourceText(c)}${c.origin === 'manual' ? ' (entered by hand)' : ''}` : 'Add a figure'}
                                className={cn(
                                  'w-full rounded px-1.5 py-0.5 text-right font-mono tabular-nums cursor-pointer hover:bg-muted/40',
                                  !c && 'text-muted-foreground/30',
                                  p.locked && 'text-amber-100',
                                )}
                              >
                                {c ? fmtNumber(c.value, Math.abs(c.value ?? 0) < 100 && c.value !== Math.round(c.value ?? 0) ? 2 : 0) : '·'}
                                {c && (
                                  <span className="block truncate text-[9.5px] font-sans text-muted-foreground/70">
                                    {c.origin === 'manual' ? 'manual' : c.source_page ? (/^\d+$/.test(c.source_page) ? `p. ${c.source_page}` : c.source_page) : (c.source_document_name ?? '').slice(0, 18)}
                                  </span>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                ),
              )}
            </table>
          </Card>
          <label className="flex w-fit items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} className="cursor-pointer" />
            Show lines with no figures (to add them by hand)
          </label>

          <CollapsibleSection title={`Documents and their periods (${data.documents.length})`} open={showDocs} onToggle={() => setShowDocs((v) => !v)}>
            <p className="mb-3 text-xs text-muted-foreground">
              A document tagged to a period only updates that period. Other years it shows are compared with what is held here and flagged if they differ.
            </p>
            <ul className="divide-y divide-border/40">
              {data.documents.map((d) => (
                <DocPeriodRow key={d.id} companyId={id} doc={d} onSaved={load} />
              ))}
            </ul>
          </CollapsibleSection>

          <CollapsibleSection title={`Change log (${data.amendments.length})`} open={showLog} onToggle={() => setShowLog((v) => !v)}>
            {data.amendments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No changes yet.</p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {data.amendments.map((a) => (
                    <tr key={a.id} className="border-t border-border/40 first:border-t-0">
                      <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">{fmtDate(a.created_at, true)}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{a.period_label}</td>
                      <td className="py-1.5 pr-3">
                        {a.action === 'lock' ? 'Locked period' : a.action === 'unlock' ? 'Unlocked period' : a.line_label}
                        {a.was_locked && a.action !== 'unlock' && <Lock className="ml-1 inline h-3 w-3 text-amber-400" />}
                      </td>
                      <td className="py-1.5 pr-3 font-mono tabular-nums whitespace-nowrap">
                        {a.action === 'edit' || a.action === 'resolve_discrepancy' ? `${fmtNumber(a.old_value)} → ${fmtNumber(a.new_value)}` : ''}
                      </td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{a.reason}</td>
                      <td className="py-1.5 text-muted-foreground whitespace-nowrap">{a.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CollapsibleSection>
        </>
      )}

      {editing && (
        <EditFigureDialog
          companyId={id}
          period={editing.period}
          row={editing.row}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {unlocking && (
        <UnlockDialog
          companyId={id}
          period={unlocking}
          onClose={() => setUnlocking(null)}
          onSaved={() => {
            setUnlocking(null);
            load();
          }}
        />
      )}
      {addingPeriod && (
        <AddPeriodDialog
          companyId={id}
          onClose={() => setAddingPeriod(false)}
          onSaved={() => {
            setAddingPeriod(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CollapsibleSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <Card className="gap-0 px-4 py-0">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 py-3 text-left text-sm font-medium cursor-pointer">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}
      </button>
      {open && <div className="pb-4">{children}</div>}
    </Card>
  );
}

function DocPeriodRow({ companyId, doc, onSaved }: { companyId: string; doc: DocRow; onSaved: () => void }) {
  const [value, setValue] = useState(doc.target_period ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = (doc.target_period ?? '') !== value.trim();
  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/companies/${companyId}/documents/${doc.id}/target-period`, {
        method: 'PATCH',
        body: JSON.stringify({ target_period: value.trim() || null }),
      });
      toast.success(value.trim() ? `${doc.filename} tagged to ${value.trim()}` : `${doc.filename} untagged`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };
  return (
    <li className="flex flex-wrap items-center gap-3 py-2 text-xs">
      <span className="min-w-0 flex-1 truncate" title={doc.filename}>{doc.filename}</span>
      {doc.extraction_status !== 'completed' && <Badge variant="neutral">{doc.extraction_status}</Badge>}
      <PeriodPicker companyId={companyId} value={value} onChange={setValue} compact />
      <Button size="xs" variant={dirty ? 'default' : 'ghost'} disabled={!dirty || saving} onClick={save} className="cursor-pointer">
        {saving ? <Loader2 className="animate-spin" /> : 'Save'}
      </Button>
    </li>
  );
}

function EditFigureDialog({
  companyId,
  period,
  row,
  onClose,
  onSaved,
}: {
  companyId: string;
  period: Period;
  row: Row;
  onClose: () => void;
  onSaved: () => void;
}) {
  const cell = row.values[period.label];
  const [value, setValue] = useState(cell?.value != null ? String(cell.value) : '');
  const [reason, setReason] = useState('');
  const [page, setPage] = useState(cell?.source_page ?? '');
  const [saving, setSaving] = useState(false);
  const needsReason = period.locked;

  const save = async (clear = false) => {
    const num = clear ? null : value.trim() === '' ? null : Number(value.replace(/,/g, ''));
    if (num != null && Number.isNaN(num)) {
      toast.error('Enter a number');
      return;
    }
    if (needsReason && !reason.trim()) {
      toast.error(`${period.label} is locked — give a reason for the change`);
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/companies/${companyId}/financials/figures`, {
        method: 'PUT',
        body: JSON.stringify({
          period_id: period.id,
          line_item: row.key,
          value: num,
          reason: reason.trim() || null,
          source_page: page.trim() || null,
        }),
      });
      toast.success(num == null ? 'Figure cleared' : 'Figure saved');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {row.label} · {period.label}
          </DialogTitle>
          <DialogDescription>
            {cell ? (
              <>
                Currently {fmtNumber(cell.value, 2)} {unitText(cell.currency, cell.unit)} — from {sourceText(cell)}.
              </>
            ) : (
              'No figure yet for this line and period.'
            )}
            {period.locked && (
              <span className="mt-1 block text-amber-400">
                This period is locked. Changing it is logged with your reason and flows into the next valuation run.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fig-value">Value (as reported{cell ? `, ${unitText(cell.currency, cell.unit) || 'units'}` : ''})</Label>
            <Input id="fig-value" value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fig-page">Source page / reference</Label>
            <Input id="fig-page" value={page} onChange={(e) => setPage(e.target.value)} placeholder="e.g. 47, or Note 12" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fig-reason">Reason{needsReason ? ' (required)' : ''}</Label>
            <Textarea id="fig-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Restated per signed FY2025 audit report" />
          </div>
        </div>
        <DialogFooter>
          {cell && (
            <Button variant="destructive" onClick={() => save(true)} disabled={saving} className="mr-auto cursor-pointer">
              Clear
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving} className="cursor-pointer">
            Cancel
          </Button>
          <Button onClick={() => save(false)} disabled={saving} className="cursor-pointer">
            {saving && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnlockDialog({ companyId, period, onClose, onSaved }: { companyId: string; period: Period; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/companies/${companyId}/financials/periods/${period.id}/lock`, {
        method: 'POST',
        body: JSON.stringify({ locked: false, reason }),
      });
      toast.success(`${period.label} unlocked`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unlock failed');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unlock {period.label}?</DialogTitle>
          <DialogDescription>
            While unlocked, new uploads can change this period&apos;s figures again and the valuation model stops using them verbatim. To correct a single figure, edit it instead — that keeps the period locked.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="unlock-reason">Reason (required)</Label>
          <Textarea id="unlock-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving} className="cursor-pointer">Cancel</Button>
          <Button variant="destructive" onClick={save} disabled={saving || !reason.trim()} className="cursor-pointer">
            {saving && <Loader2 className="animate-spin" />} Unlock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddPeriodDialog({ companyId, onClose, onSaved }: { companyId: string; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const p = await apiJson<{ label: string }>(`/companies/${companyId}/financials/periods`, {
        method: 'POST',
        body: JSON.stringify({ label }),
      });
      toast.success(`${p.label} added`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add period');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add a period</DialogTitle>
          <DialogDescription>Annual (FY2025) or interim (H1_2026, Q3_2025, 9M_2025).</DialogDescription>
        </DialogHeader>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="FY2025" autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="cursor-pointer">Cancel</Button>
          <Button onClick={save} disabled={saving || !label.trim()} className="cursor-pointer">
            {saving && <Loader2 className="animate-spin" />} Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
