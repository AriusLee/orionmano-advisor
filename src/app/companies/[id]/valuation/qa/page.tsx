'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Check,
  Download,
  FileText,
  Loader2,
  MessagesSquare,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
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
import { MARKDOWN_COMPONENTS } from '@/components/reports/section-preview';
import { changeTone, fmtDate, fmtMoney, fmtPct } from '@/lib/valuation-format';

interface Impact {
  ev_before: number | null;
  ev_after: number | null;
  equity_before: number | null;
  equity_after: number | null;
  ev_change_pct: number | null;
  equity_change_pct: number | null;
  currency: string | null;
  unit: string | null;
}

interface Change {
  id: string;
  param_key: string;
  label: string;
  kind: 'percent' | 'currency' | 'number';
  old_value: number | null;
  new_value: number;
  old_display: string;
  new_display: string;
  rationale: string | null;
  impact: Impact | null;
  status: 'proposed' | 'approved' | 'rejected';
}

interface Item {
  id: string;
  item_no: number;
  question: string;
  topic: string | null;
  simplified_answer: string | null;
  detailed_answer: string | null;
  status: string;
  error: string | null;
  resulting_version_id: string | null;
  resulting_version_no: number | null;
  resulting_report_id: string | null;
  changes: Change[];
}

interface Batch {
  id: string;
  title: string;
  source_filename: string | null;
  status: string;
  progress_message: string | null;
  base_version_no: number | null;
  currency: string | null;
  unit: string | null;
  created_at: string | null;
  item_count: number;
  answered_count: number;
  applied_count: number;
  items?: Item[];
}

interface Param {
  key: string;
  label: string;
  kind: 'percent' | 'currency' | 'number';
  value: number | null;
  display: string;
}

const STATUS: Record<string, { label: string; variant: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'Drafting…', variant: 'neutral' },
  answered: { label: 'No model change', variant: 'info' },
  change_proposed: { label: 'Model change proposed', variant: 'warning' },
  applying: { label: 'Applying…', variant: 'neutral' },
  applied: { label: 'Applied', variant: 'success' },
  failed: { label: 'Failed', variant: 'danger' },
};

/** Stored → editor (25% shows as 25). */
const toEditor = (kind: Change['kind'], v: number | null) => (v == null ? '' : kind === 'percent' ? String(+(v * 100).toFixed(4)) : String(v));
const fromEditor = (kind: Change['kind'], s: string) => {
  const n = Number(s.replace(/,/g, ''));
  if (s.trim() === '' || Number.isNaN(n)) return null;
  return kind === 'percent' ? n / 100 : n;
};

export default function CounterpartyQaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [paramsList, setParamsList] = useState<Param[]>([]);

  const loadList = useCallback(async () => {
    try {
      const list = await apiJson<Batch[]>(`/companies/${id}/qa/batches`);
      setBatches(list);
      setSelected((cur) => cur ?? list[0]?.id ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load questions');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadBatch = useCallback(async () => {
    if (!selected) {
      setBatch(null);
      return;
    }
    try {
      setBatch(await apiJson<Batch>(`/companies/${id}/qa/batches/${selected}`));
    } catch {
      setBatch(null);
    }
  }, [id, selected]);

  useEffect(() => {
    loadList();
    apiJson<Param[]>(`/companies/${id}/qa/params`).then(setParamsList).catch(() => {});
  }, [id, loadList]);

  useEffect(() => {
    loadBatch();
  }, [loadBatch]);

  // Poll while answers are drafting or a change is being applied.
  const busy = batch?.status === 'answering' || batch?.items?.some((i) => i.status === 'pending' || i.status === 'applying');
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => {
      loadBatch();
      loadList();
    }, 4000);
    return () => clearInterval(t);
  }, [busy, loadBatch, loadList]);

  const deleteBatch = async (b: Batch) => {
    if (!confirm(`Delete "${b.title}" and its answers? Versions already created stay.`)) return;
    try {
      await apiFetch(`/companies/${id}/qa/batches/${b.id}`, { method: 'DELETE' });
      setSelected(null);
      setBatch(null);
      loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const draftRemaining = async () => {
    if (!batch) return;
    try {
      await apiFetch(`/companies/${id}/qa/batches/${batch.id}/answer`, { method: 'POST', body: JSON.stringify({}) });
      toast.success('Drafting the remaining answers…');
      loadBatch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start drafting');
    }
  };

  const download = async (format: 'xlsx' | 'docx') => {
    if (!batch) return;
    try {
      const res = await apiFetch(`/companies/${id}/qa/batches/${batch.id}/export?format=${format}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${batch.title}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <ValuationPageHeader
        icon={MessagesSquare}
        title="Counterparty Q&A"
        description="Paste or upload the counterparty's questions. Each gets a short and a detailed answer drafted against the current valuation. Where the model should move, the proposed change shows its effect on value before you approve it; applying it creates a new version and report linked to the question."
        action={
          <Button onClick={() => setCreating(true)} className="cursor-pointer">
            <Plus /> New question set
          </Button>
        }
      />
      <ValuationNav companyId={id} />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : batches.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No question sets yet.{' '}
          <button type="button" onClick={() => setCreating(true)} className="text-primary underline-offset-4 hover:underline cursor-pointer">
            Add the counterparty&apos;s questions
          </button>
          .
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <ul className="space-y-1.5">
            {batches.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setSelected(b.id)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2.5 text-left ring-1 ring-inset transition-colors cursor-pointer',
                    selected === b.id ? 'bg-primary/10 ring-primary/30' : 'ring-border/60 hover:bg-muted/30',
                  )}
                >
                  <p className="truncate text-sm font-medium">{b.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {b.item_count} questions · {b.answered_count} drafted · {b.applied_count} applied
                  </p>
                  <p className="text-[11px] text-muted-foreground">{fmtDate(b.created_at)} · on v{b.base_version_no ?? '—'}</p>
                </button>
              </li>
            ))}
          </ul>

          {batch && batch.items && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto">
                  <h2 className="text-lg font-semibold">{batch.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    Answered against valuation v{batch.base_version_no ?? '—'}
                    {batch.source_filename ? ` · from ${batch.source_filename}` : ''}
                    {batch.status === 'answering' && (
                      <span className="ml-2 text-primary">
                        <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                        {batch.progress_message ?? 'Drafting answers…'}
                      </span>
                    )}
                    {batch.status !== 'answering' && batch.progress_message && <span className="ml-2 text-amber-400">{batch.progress_message}</span>}
                  </p>
                </div>
                {batch.status !== 'answering' && batch.items.some((i) => i.status === 'pending' || i.status === 'failed') && (
                  <Button size="sm" onClick={draftRemaining} className="cursor-pointer">
                    <Sparkles /> Draft remaining
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => download('xlsx')} className="cursor-pointer">
                  <Download /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => download('docx')} className="cursor-pointer">
                  <Download /> Word
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => deleteBatch(batch)} title="Delete question set" className="cursor-pointer">
                  <Trash2 />
                </Button>
              </div>
              {batch.items.map((item) => (
                <QaItemCard
                  key={item.id}
                  companyId={id}
                  batchId={batch.id}
                  item={item}
                  currency={batch.currency}
                  unit={batch.unit}
                  params={paramsList}
                  batchBusy={batch.status === 'answering'}
                  onChanged={() => {
                    loadBatch();
                    loadList();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {creating && (
        <NewBatchDialog
          companyId={id}
          onClose={() => setCreating(false)}
          onCreated={(b) => {
            setCreating(false);
            setSelected(b.id);
            loadList();
          }}
        />
      )}
    </div>
  );
}

function QaItemCard({
  companyId,
  batchId,
  item,
  currency,
  unit,
  params,
  batchBusy,
  onChanged,
}: {
  companyId: string;
  batchId: string;
  item: Item;
  currency: string | null;
  unit: string | null;
  params: Param[];
  batchBusy: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [simple, setSimple] = useState(item.simplified_answer ?? '');
  const [detail, setDetail] = useState(item.detailed_answer ?? '');
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [combined, setCombined] = useState<Impact | null>(null);
  const [applying, setApplying] = useState(false);
  const status = STATUS[item.status] ?? { label: item.status, variant: 'neutral' as const };
  const locked = item.status === 'applied' || item.status === 'applying';
  const approvedCount = item.changes.filter((c) => c.status === 'approved').length;

  useEffect(() => {
    if (!editing) {
      setSimple(item.simplified_answer ?? '');
      setDetail(item.detailed_answer ?? '');
    }
  }, [item.simplified_answer, item.detailed_answer, editing]);

  useEffect(() => {
    if (approvedCount === 0 || locked) {
      setCombined(null);
      return;
    }
    apiJson<{ impact: Impact | null }>(`/companies/${companyId}/qa/items/${item.id}/impact`)
      .then((r) => setCombined(r.impact))
      .catch(() => setCombined(null));
  }, [companyId, item.id, approvedCount, locked, item.changes]);

  const saveAnswer = async () => {
    setSaving(true);
    try {
      await apiFetch(`/companies/${companyId}/qa/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ simplified_answer: simple, detailed_answer: detail }),
      });
      setEditing(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const redraft = async () => {
    try {
      await apiFetch(`/companies/${companyId}/qa/batches/${batchId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ item_ids: [item.id] }),
      });
      toast.success(`Redrafting question ${item.item_no}…`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Redraft failed');
    }
  };

  const apply = async () => {
    if (!confirm(`Apply ${approvedCount} approved change(s)? This creates a new valuation version and regenerates the valuation report for it.`)) return;
    setApplying(true);
    try {
      await apiFetch(`/companies/${companyId}/qa/items/${item.id}/apply`, { method: 'POST', body: JSON.stringify({ pin: true }) });
      toast.success('Applying — the new version appears in a minute');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Card className="gap-3 px-5">
      <div className="flex flex-wrap items-start gap-2">
        <span className="mt-0.5 font-mono text-sm text-muted-foreground">#{item.item_no}</span>
        <p className="min-w-0 flex-1 font-medium leading-snug">{item.question}</p>
        {item.topic && <Badge variant="neutral">{item.topic}</Badge>}
        <Badge variant={status.variant}>
          {(item.status === 'pending' || item.status === 'applying') && <Loader2 className="animate-spin" />}
          {status.label}
        </Badge>
      </div>

      {item.error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">{item.error}</p>}

      {item.status !== 'pending' && (item.simplified_answer || item.detailed_answer || editing) && (
        <div className="space-y-3">
          {editing ? (
            <>
              <div className="space-y-1.5">
                <Label>Short answer</Label>
                <Textarea value={simple} onChange={(e) => setSimple(e.target.value)} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Detailed answer (markdown)</Label>
                <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={12} className="font-mono text-xs" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveAnswer} disabled={saving} className="cursor-pointer">
                  {saving && <Loader2 className="animate-spin" />} Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="cursor-pointer">Cancel</Button>
              </div>
            </>
          ) : (
            <>
              {item.simplified_answer && (
                <div className="rounded-lg bg-primary/5 px-4 py-3 text-sm ring-1 ring-inset ring-primary/15">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/80">In brief</p>
                  {item.simplified_answer}
                </div>
              )}
              {item.detailed_answer && (
                <details className="group">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Detailed answer</summary>
                  <div className="prose prose-invert prose-sm mt-2 max-w-none report-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>{item.detailed_answer}</ReactMarkdown>
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      )}

      {(item.changes.length > 0 || (!locked && item.status !== 'pending')) && (
        <div className="space-y-2">
          {item.changes.length > 0 && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Proposed model changes</p>
          )}
          {item.changes.map((c) => (
            <ChangeRow key={c.id} companyId={companyId} change={c} currency={currency} unit={unit} locked={locked} onChanged={onChanged} />
          ))}
          {adding && <AddChangeRow companyId={companyId} itemId={item.id} params={params} onDone={() => { setAdding(false); onChanged(); }} />}
        </div>
      )}

      {combined && !locked && (
        <div className="rounded-lg bg-muted/30 px-4 py-2.5 text-xs">
          <span className="text-muted-foreground">Approved changes together, on the current model: </span>
          EV {fmtMoney(combined.ev_before)} → <span className="font-mono">{fmtMoney(combined.ev_after, combined.currency, combined.unit)}</span>{' '}
          <span className={changeTone(combined.ev_change_pct)}>({fmtPct(combined.ev_change_pct, 1, true)})</span>
          {' · '}Equity {fmtMoney(combined.equity_before)} → <span className="font-mono">{fmtMoney(combined.equity_after)}</span>{' '}
          <span className={changeTone(combined.equity_change_pct)}>({fmtPct(combined.equity_change_pct, 1, true)})</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
        {item.status === 'applied' ? (
          <>
            <Badge variant="success"><Check /> New version v{item.resulting_version_no ?? '—'}</Badge>
            {item.resulting_report_id && (
              <Link href={`/companies/${companyId}/reports/${item.resulting_report_id}`} className="cursor-pointer">
                <Button size="sm" variant="outline" className="cursor-pointer"><FileText /> Report for this change</Button>
              </Link>
            )}
            <Link href={`/companies/${companyId}/valuation/versions`} className="text-xs text-primary hover:underline cursor-pointer">
              See versions
            </Link>
          </>
        ) : (
          <>
            {approvedCount > 0 && (
              <Button size="sm" onClick={apply} disabled={applying || item.status === 'applying'} className="cursor-pointer">
                {applying || item.status === 'applying' ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Apply {approvedCount} change{approvedCount === 1 ? '' : 's'} → new version
              </Button>
            )}
            {!locked && item.status !== 'pending' && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setAdding(true)} className="cursor-pointer"><Plus /> Add change</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="cursor-pointer"><Pencil /> Edit answer</Button>
                <Button size="sm" variant="ghost" onClick={redraft} disabled={batchBusy} className="cursor-pointer"><RefreshCw /> Redraft</Button>
              </>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function ChangeRow({
  companyId,
  change,
  currency,
  unit,
  locked,
  onChanged,
}: {
  companyId: string;
  change: Change;
  currency: string | null;
  unit: string | null;
  locked: boolean;
  onChanged: () => void;
}) {
  const [value, setValue] = useState(toEditor(change.kind, change.new_value));
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(toEditor(change.kind, change.new_value)), [change.new_value, change.kind]);

  const decide = async (approve: boolean) => {
    const nv = fromEditor(change.kind, value);
    setBusy(true);
    try {
      await apiFetch(`/companies/${companyId}/qa/changes/${change.id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ approve, new_value: nv }),
      });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const imp = change.impact;
  return (
    <div
      className={cn(
        'grid gap-3 rounded-lg px-3 py-2.5 ring-1 ring-inset md:grid-cols-[minmax(0,1fr)_auto_auto]',
        change.status === 'approved' ? 'ring-emerald-500/30 bg-emerald-500/5' : change.status === 'rejected' ? 'ring-border/40 opacity-60' : 'ring-amber-500/25 bg-amber-500/5',
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {change.label}: <span className="font-mono text-muted-foreground">{change.old_display}</span> →{' '}
          <span className="font-mono">{change.new_display}</span>
        </p>
        {change.rationale && <p className="mt-0.5 text-xs text-muted-foreground">{change.rationale}</p>}
        {imp && (
          <p className="mt-1 text-xs">
            EV <span className={cn('font-mono', changeTone(imp.ev_change_pct))}>{fmtPct(imp.ev_change_pct, 1, true)}</span>
            <span className="text-muted-foreground"> ({fmtMoney(imp.ev_before)} → {fmtMoney(imp.ev_after, currency, unit)})</span>
            {' · '}Equity <span className={cn('font-mono', changeTone(imp.equity_change_pct))}>{fmtPct(imp.equity_change_pct, 1, true)}</span>
          </p>
        )}
      </div>
      {!locked && (
        <div className="flex items-center gap-1.5">
          <Input value={value} onChange={(e) => setValue(e.target.value)} className="h-7 w-24 text-right font-mono text-xs" inputMode="decimal" />
          <span className="text-xs text-muted-foreground">{change.kind === 'percent' ? '%' : change.kind === 'currency' ? unit ?? '' : ''}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        {locked ? (
          <Badge variant={change.status === 'approved' ? 'success' : 'neutral'}>{change.status}</Badge>
        ) : (
          <>
            <Button size="xs" variant={change.status === 'rejected' ? 'secondary' : 'outline'} onClick={() => decide(false)} disabled={busy} className="cursor-pointer">
              <X /> Reject
            </Button>
            <Button size="xs" variant={change.status === 'approved' ? 'default' : 'outline'} onClick={() => decide(true)} disabled={busy} className="cursor-pointer">
              {busy ? <Loader2 className="animate-spin" /> : <Check />} Approve
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function AddChangeRow({ companyId, itemId, params, onDone }: { companyId: string; itemId: string; params: Param[]; onDone: () => void }) {
  const available = params.filter((p) => p.value != null);
  const [key, setKey] = useState(available[0]?.key ?? '');
  const p = available.find((x) => x.key === key);
  const [value, setValue] = useState('');
  const [rationale, setRationale] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!p) return;
    const nv = fromEditor(p.kind, value);
    if (nv == null) {
      toast.error('Enter the new value');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/companies/${companyId}/qa/items/${itemId}/changes`, {
        method: 'POST',
        body: JSON.stringify({ param_key: key, new_value: nv, rationale: rationale || null }),
      });
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add the change');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2.5 ring-1 ring-inset ring-border/60">
      <select
        value={key}
        onChange={(e) => setKey(e.target.value)}
        className="h-7 rounded-md border border-border bg-background px-2 text-xs cursor-pointer"
      >
        {available.map((x) => (
          <option key={x.key} value={x.key}>
            {x.label} (now {x.display})
          </option>
        ))}
      </select>
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={p?.kind === 'percent' ? 'new %' : 'new value'} className="h-7 w-24 text-xs" inputMode="decimal" />
      <Input value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Why (optional)" className="h-7 min-w-[12rem] flex-1 text-xs" />
      <Button size="xs" onClick={save} disabled={saving} className="cursor-pointer">
        {saving && <Loader2 className="animate-spin" />} Add
      </Button>
      <Button size="xs" variant="ghost" onClick={onDone} className="cursor-pointer">Cancel</Button>
    </div>
  );
}

function NewBatchDialog({ companyId, onClose, onCreated }: { companyId: string; onClose: () => void; onCreated: (b: Batch) => void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (!text.trim() && !file) {
      toast.error('Paste the questions or choose a file');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('text', text);
      if (file) fd.append('file', file);
      const res = await apiFetch(`/companies/${companyId}/qa/batches`, { method: 'POST', body: fd });
      const b = (await res.json()) as Batch;
      toast.success(`${b.item_count} question${b.item_count === 1 ? '' : 's'} added — drafting answers`);
      onCreated(b);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add the questions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New question set</DialogTitle>
          <DialogDescription>
            Paste the questions (numbered or one per paragraph) or upload the counterparty&apos;s file (.xlsx, .docx, .pdf, .txt). Answers are drafted against the current valuation version.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qa-title">Title</Label>
            <Input id="qa-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Underwriter DD questions — round 1" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qa-text">Questions</Label>
            <Textarea id="qa-text" value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder={'1. Why is the terminal growth rate 3.5%?\n2. What is the basis for the size premium?'} />
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xlsm,.docx,.pdf,.txt,.md,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="cursor-pointer">
              <Upload /> {file ? 'Change file' : 'Upload file'}
            </Button>
            {file && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {file.name}
                <button type="button" onClick={() => setFile(null)} className="cursor-pointer hover:text-foreground" aria-label="Remove file">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving} className="cursor-pointer">Cancel</Button>
          <Button onClick={save} disabled={saving} className="cursor-pointer">
            {saving && <Loader2 className="animate-spin" />} Add and draft answers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
