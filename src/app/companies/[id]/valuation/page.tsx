'use client';

import { use, useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  Download,
  FileJson,
  FileSpreadsheet,
  Lightbulb,
  Loader2,
  Save,
  Sparkles,
  Target,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { apiJson, apiFetch, uploadUrl } from '@/lib/api';
import { EmptyDataState } from '@/components/empty-data-state';
import { GeneratingState } from '@/components/generating-state';
import { ValuationDashboard, type ValuationSummary } from '@/components/reports/valuation-dashboard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Document {
  id: string;
  filename: string;
  extraction_status: string;
  extracted_data: Record<string, unknown> | null;
  category?: string | null;
  categories?: string[] | null;
}

interface CompanyMeta {
  website: string | null;
  report_tier: string;
  target_valuation: number | null;
}

interface WorkpaperResult {
  status: 'success' | 'partial' | 'failed';
  message: string;
  xlsx_url: string | null;
  warnings: string[];
  errors: string[];
  generatedAt: string;
  summary?: ValuationSummary | null;
}

interface LatestSummary {
  generated_at: string;
  xlsx_url: string;
  xlsx_filename: string;
  warnings: string[];
  errors: string[];
  summary: ValuationSummary;
  inputs?: Record<string, unknown>;
}

const REQUIRED_DOCS = ['audit_report', 'projections'];
const RECOMMENDED_DOCS = [
  'management_accounts',
  'cap_table',
  'shareholder_agreement',
  'board_minutes',
  'tax_return',
];

export default function ValuationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [docs, setDocs] = useState<Document[]>([]);
  const [company, setCompany] = useState<CompanyMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('Loading extracted documents…');
  const [result, setResult] = useState<WorkpaperResult | null>(null);
  const [latest, setLatest] = useState<LatestSummary | null>(null);
  const [targetValuation, setTargetValuation] = useState<string>('');
  const [savedTargetValuation, setSavedTargetValuation] = useState<number | null>(null);
  const [savingTarget, setSavingTarget] = useState(false);
  const autoRegenFiredRef = useRef(false);

  // Prefill the run-config input. Precedence: Company.target_valuation (saved
  // default) > latest run's engagement.target_valuation > empty. Only fires
  // while the input is empty so the user's typing isn't overwritten.
  useEffect(() => {
    if (targetValuation !== '') return;
    if (savedTargetValuation != null) {
      setTargetValuation(String(savedTargetValuation));
      return;
    }
    const prior = latest?.summary?.engagement?.target_valuation;
    if (prior != null) {
      setTargetValuation(String(prior));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedTargetValuation, latest]);

  const reuploadInputRef = useRef<HTMLInputElement>(null);

  // Download the latest run's inputs JSON to disk so the user can edit it offline.
  // Eric 2026-05-08 item 8: half of the re-upload-and-re-evaluate round trip.
  const handleDownloadInputs = useCallback(() => {
    const inputs = latest?.inputs;
    if (!inputs) {
      toast.error('No inputs available yet — generate the workpaper first.');
      return;
    }
    const blob = new Blob([JSON.stringify(inputs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (latest.xlsx_filename || 'valuation.xlsx').replace(/\.xlsx$/, '.inputs.json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [latest]);

  const handleReuploadClick = useCallback(() => {
    reuploadInputRef.current?.click();
  }, []);

  const handleReuploadFile = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so re-uploading the same file path still triggers the change event.
    e.target.value = '';
    if (!file) return;
    const lower = file.name.toLowerCase();
    const isXlsx = lower.endsWith('.xlsx');
    const isJson = lower.endsWith('.json');
    if (!isXlsx && !isJson) {
      toast.error('Upload must be .xlsx or .json');
      return;
    }
    setGenerating(true);
    setGenerationStartedAt(new Date().toISOString());
    setProgressMessage(isXlsx ? 'Parsing edited xlsx…' : 'Validating uploaded inputs JSON…');
    try {
      type RegenerateResponse = {
        status: string;
        message: string;
        xlsx_url: string | null;
        warnings: string[];
        errors: string[];
        summary?: ValuationSummary | null;
        parsed_inputs?: Record<string, unknown>;
      };
      let res: RegenerateResponse;
      let parsedForLatest: Record<string, unknown> | undefined;

      if (isXlsx) {
        const fd = new FormData();
        fd.append('file', file);
        const httpRes = await apiFetch(`/companies/${id}/valuation/regenerate-from-xlsx`, {
          method: 'POST',
          body: fd,
        });
        res = await httpRes.json();
        parsedForLatest = res.parsed_inputs;
      } else {
        const text = await file.text();
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error('Selected file is not valid JSON');
        }
        res = await apiJson<RegenerateResponse>(`/companies/${id}/valuation/regenerate-from-inputs`, {
          method: 'POST',
          body: JSON.stringify(parsed),
        });
        parsedForLatest = parsed;
      }

      const status = (['success', 'partial', 'failed'] as const).includes(res.status as 'success')
        ? (res.status as WorkpaperResult['status'])
        : 'success';
      const generatedAt = new Date().toISOString();
      setResult({
        status,
        message: res.message,
        xlsx_url: res.xlsx_url,
        warnings: res.warnings ?? [],
        errors: res.errors ?? [],
        generatedAt,
        summary: res.summary ?? null,
      });
      if (res.summary && res.xlsx_url) {
        setLatest({
          generated_at: generatedAt,
          xlsx_url: res.xlsx_url,
          xlsx_filename: res.xlsx_url.split('/').pop() ?? 'valuation.xlsx',
          warnings: res.warnings ?? [],
          errors: res.errors ?? [],
          summary: res.summary,
          inputs: parsedForLatest,
        });
      }
      if (status === 'success') {
        toast.success(isXlsx ? 'Regenerated from edited xlsx' : 'Regenerated from edited inputs');
      } else if (status === 'partial') {
        toast.warning(`Regenerated with ${(res.errors ?? []).length} validation issues`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Re-upload failed');
    } finally {
      setGenerating(false);
      setGenerationStartedAt(null);
    }
  }, [id]);

  const handleSaveTarget = useCallback(async () => {
    if (savingTarget) return;
    setSavingTarget(true);
    try {
      const tv = targetValuation.trim() ? Number(targetValuation) : null;
      const updated = await apiJson<CompanyMeta>(`/companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ target_valuation: tv }),
      });
      setSavedTargetValuation(updated.target_valuation ?? null);
      toast.success(tv == null ? 'Target valuation cleared' : 'Target valuation saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingTarget(false);
    }
  }, [id, savingTarget, targetValuation]);

  useEffect(() => {
    if (!generating || !generationStartedAt) return;
    const start = new Date(generationStartedAt).getTime();
    const tick = () => {
      const sec = (Date.now() - start) / 1000;
      if (sec < 6) setProgressMessage('Loading extracted documents…');
      else if (sec < 80) setProgressMessage('Producing valuation inputs with Claude…');
      else setProgressMessage('Populating the Excel template…');
    };
    tick();
    const t = setInterval(tick, 1500);
    return () => clearInterval(t);
  }, [generating, generationStartedAt]);

  const loadData = useCallback(() => {
    Promise.all([
      apiJson<Document[]>(`/companies/${id}/documents`),
      apiJson<CompanyMeta>(`/companies/${id}`),
      apiFetch(`/companies/${id}/valuation/latest`).then((r) => r.json()).catch(() => null),
    ])
      .then(([d, c, l]) => {
        setDocs(d);
        setCompany(c);
        setSavedTargetValuation(c.target_valuation ?? null);
        if (l && l.summary) setLatest(l as LatestSummary);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ?regenerate=1 (set by the action-panel modal's Regenerate button) auto-
  // triggers a fresh run as soon as the page has finished its initial load.
  // The flag is stripped from the URL so refreshing the page doesn't re-fire.
  useEffect(() => {
    if (autoRegenFiredRef.current) return;
    if (loading || generating) return;
    if (searchParams.get('regenerate') !== '1') return;
    autoRegenFiredRef.current = true;
    router.replace(`/companies/${id}/valuation`);
    handleGenerate();
    // handleGenerate is stable-ish but isn't memoized; avoid re-firing by gating
    // on autoRegenFiredRef rather than declaring it as a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, generating, searchParams]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerationStartedAt(new Date().toISOString());
    try {
      const res = await apiJson<{
        status: string;
        message: string;
        xlsx_url: string | null;
        warnings: string[];
        errors: string[];
        summary?: ValuationSummary | null;
      }>(`/companies/${id}/valuation/generate-workpaper`, {
        method: 'POST',
        body: JSON.stringify({
          // Prefer the state value; fall back to the prior run's target so a
          // modal-initiated Regenerate (?regenerate=1) re-uses the last target
          // even before the prefill effect has copied it into state.
          target_valuation: targetValuation.trim()
            ? Number(targetValuation)
            : savedTargetValuation ?? latest?.summary?.engagement?.target_valuation ?? null,
        }),
      });

      const status = res.status === 'success' || res.status === 'partial' || res.status === 'failed'
        ? (res.status as WorkpaperResult['status'])
        : 'success';

      const generatedAt = new Date().toISOString();
      setResult({
        status,
        message: res.message,
        xlsx_url: res.xlsx_url,
        warnings: res.warnings ?? [],
        errors: res.errors ?? [],
        generatedAt,
        summary: res.summary ?? null,
      });
      if (res.summary && res.xlsx_url) {
        setLatest({
          generated_at: generatedAt,
          xlsx_url: res.xlsx_url,
          xlsx_filename: res.xlsx_url.split('/').pop() ?? 'valuation.xlsx',
          warnings: res.warnings ?? [],
          errors: res.errors ?? [],
          summary: res.summary,
        });
      }

      if (status === 'success') {
        toast.success('Workpaper generated');
      } else if (status === 'partial') {
        toast.warning(`Generated with ${(res.errors ?? []).length} validation errors`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Workpaper generation failed');
    } finally {
      setGenerating(false);
      setGenerationStartedAt(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 stagger-children">
      {/* Hidden file picker shared by every Re-upload button on the page */}
      <input
        ref={reuploadInputRef}
        type="file"
        accept=".json,application/json,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleReuploadFile}
      />
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
          <BarChart3 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight leading-none">Valuation</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            DCF + Comparable-companies workpaper — exported as a populated Excel template
          </p>
        </div>
      </div>

      <RunConfigCard
        targetValuation={targetValuation}
        onChange={setTargetValuation}
        currencyLabel={
          latest?.summary?.currency
            ? `${latest.summary.currency.primary ?? 'USD'} ${latest.summary.currency.unit ?? ''}`.trim()
            : "USD '000"
        }
        savedValue={savedTargetValuation}
        onSave={handleSaveTarget}
        saving={savingTarget}
      />

      {generating ? (
        <GeneratingState
          icon={BarChart3}
          title="Valuation Workpaper"
          description="Reading extracted documents → producing the Inputs JSON with Claude → populating the Excel template. Typical run: 60–120 seconds."
          progressMessage={progressMessage}
          startedAt={generationStartedAt}
          unitLabel="DCF + Comps + Sensitivity"
          safeToNavigate={false}
        />
      ) : latest ? (
        <div className="space-y-4">
          <WorkpaperHeaderCard
            xlsxUrl={latest.xlsx_url}
            filename={latest.xlsx_filename}
            generatedAt={latest.generated_at}
            errorCount={latest.errors?.length ?? 0}
            onRegenerate={handleGenerate}
            onDownloadInputs={handleDownloadInputs}
            onReupload={handleReuploadClick}
            hasInputs={Boolean(latest.inputs)}
          />
          <ValuationDashboard
            summary={latest.summary}
            generatedAt={latest.generated_at}
            xlsxUrl={latest.xlsx_url}
            warnings={latest.warnings}
          />
          <AssumptionsPanel inputs={latest.inputs} summary={latest.summary} />
        </div>
      ) : result ? (
        <WorkpaperResultCard
          result={result}
          onRegenerate={handleGenerate}
          onReupload={handleReuploadClick}
        />
      ) : (
        <EmptyDataState
          icon={BarChart3}
          title="Valuation Workpaper"
          description="Upload audited financials and management projections — Claude will read every figure, populate the Inputs sheet, and return a full DCF workbook with WACC, comps cross-check, EV-to-equity bridge, and a 7×7 sensitivity grid."
          requiredCategories={REQUIRED_DOCS}
          recommendedCategories={RECOMMENDED_DOCS}
          documents={docs}
          companyWebsite={company?.website}
          cta={
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="group relative inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_-4px_oklch(from_var(--primary)_l_c_h_/_0.5),inset_0_1px_0_oklch(1_0_0/0.2)] transition-all duration-150 cursor-pointer hover:brightness-110 hover:shadow-[0_6px_20px_-4px_oklch(from_var(--primary)_l_c_h_/_0.6),inset_0_1px_0_oklch(1_0_0/0.25)] active:brightness-95 active:translate-y-px disabled:opacity-70 disabled:cursor-wait"
            >
              <FileSpreadsheet className="h-4 w-4" strokeWidth={2.25} />
              Generate Workpaper
            </button>
          }
        />
      )}
    </div>
  );
}

function formatTargetPreview(raw: string, currency: string, unit: string): string | null {
  const n = Number(raw);
  if (!raw.trim() || !Number.isFinite(n) || n <= 0) return null;
  // Unit multiplier: '000 = thousand, '000000 / "mm" = million; default = 1.
  const u = unit.trim().toLowerCase();
  const mult =
    u === "'000" || u === '000' ? 1_000 :
    u === "'000000" || u === 'mm' || u === "'mm" ? 1_000_000 :
    1;
  const actual = n * mult;
  let display: string;
  if (actual >= 1_000_000_000) display = `${(actual / 1_000_000_000).toFixed(actual >= 10_000_000_000 ? 0 : 2)}B`;
  else if (actual >= 1_000_000) display = `${(actual / 1_000_000).toFixed(actual >= 10_000_000 ? 0 : 1)}M`;
  else if (actual >= 1_000) display = `${(actual / 1_000).toFixed(0)}K`;
  else display = String(actual);
  return `= ${currency} ${display}`;
}

interface SourceEntry {
  source?: string;
  detail?: string;
  notes?: string;
  rationale?: string;
}

interface HeadlineAssumption {
  sourceId: string;
  label: string;
  path: string[];
  format: 'currency' | 'percent' | 'number';
  digits?: number;
}

const HEADLINE_ASSUMPTIONS: HeadlineAssumption[] = [
  { sourceId: 'target_valuation', label: 'Target valuation', path: ['engagement', 'target_valuation'], format: 'currency' },
  { sourceId: 'revenue_y0', label: 'Revenue Y0 (cascade base)', path: ['projections', 'revenue_y0'], format: 'currency' },
  { sourceId: 'revenue_growth_y1', label: 'Revenue growth — Y1', path: ['projections', 'revenue_growth', '0'], format: 'percent' },
  { sourceId: 'gross_margin_y1', label: 'Gross margin — Y1', path: ['projections', 'gross_margin', '0'], format: 'percent' },
  { sourceId: 'terminal_growth_rate', label: 'Terminal growth', path: ['terminal', 'growth_rate'], format: 'percent' },
  { sourceId: 'unlevered_beta_per_mgmt', label: 'Unlevered β (per-management)', path: ['wacc', 'per_management', 'unlevered_beta'], format: 'number', digits: 3 },
  { sourceId: 'risk_free_rate', label: 'Risk-free rate', path: ['wacc', 'shared', 'risk_free_rate'], format: 'percent' },
  { sourceId: 'equity_risk_premium', label: 'Equity risk premium', path: ['wacc', 'shared', 'equity_risk_premium'], format: 'percent' },
  { sourceId: 'dlom_pct', label: 'DLOM', path: ['bridge', 'dlom_pct'], format: 'percent' },
  { sourceId: 'dloc_pct', label: 'DLOC', path: ['bridge', 'dloc_pct'], format: 'percent' },
];

function readPath(obj: Record<string, unknown> | undefined, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(key);
      cur = Number.isFinite(idx) ? cur[idx] : undefined;
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return cur;
}

function formatAssumption(raw: unknown, fmt: HeadlineAssumption['format'], digits: number | undefined, currency: string, unit: string): string {
  if (raw == null) return '—';
  const n = Number(raw);
  if (!Number.isFinite(n)) return '—';
  if (fmt === 'percent') {
    return `${(n * 100).toFixed(2)}%`;
  }
  if (fmt === 'number') {
    return n.toFixed(digits ?? 2);
  }
  // currency: apply unit multiplier so we display human-readable scale
  const u = unit.trim().toLowerCase();
  const mult =
    u === "'000" || u === '000' ? 1_000 :
    u === "'000000" || u === 'mm' || u === "'mm" ? 1_000_000 :
    1;
  const actual = n * mult;
  let body: string;
  if (actual >= 1_000_000_000) body = `${(actual / 1_000_000_000).toFixed(actual >= 10_000_000_000 ? 0 : 2)}B`;
  else if (actual >= 1_000_000) body = `${(actual / 1_000_000).toFixed(actual >= 10_000_000 ? 0 : 1)}M`;
  else if (actual >= 1_000) body = `${(actual / 1_000).toFixed(0)}K`;
  else body = String(Math.round(actual));
  return `${currency} ${body}`;
}

function AssumptionsPanel({
  inputs,
  summary,
}: {
  inputs?: Record<string, unknown>;
  summary: ValuationSummary;
}) {
  const sources = (inputs?.sources as Record<string, SourceEntry> | undefined) ?? {};
  const currency = summary.currency?.primary ?? 'USD';
  const unit = summary.currency?.unit ?? "'000";

  const rows = HEADLINE_ASSUMPTIONS.map((a) => {
    const value = readPath(inputs, a.path);
    const src = sources[a.sourceId];
    return { ...a, value, src };
  }).filter((r) => r.value != null || r.src?.rationale);

  if (rows.length === 0) return null;
  const withRationale = rows.filter((r) => r.src?.rationale).length;

  return (
    <details className="group rounded-2xl border bg-card">
      <summary className="flex cursor-pointer items-center gap-3 p-4 list-none">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
          <Lightbulb className="h-4 w-4 text-primary" strokeWidth={2.25} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">Assumptions explained</h2>
          <p className="text-[11px] text-muted-foreground/80">
            Why each headline number was chosen — {withRationale} of {rows.length} carry a rationale paragraph.
          </p>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" strokeWidth={2.25} />
      </summary>
      <div className="border-t divide-y">
        {rows.map((r) => (
          <div key={r.sourceId} className="flex gap-4 px-4 py-3">
            <div className="w-48 shrink-0">
              <p className="text-xs font-medium tracking-tight">{r.label}</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                {formatAssumption(r.value, r.format, r.digits, currency, unit)}
              </p>
              {r.src?.source && (
                <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">{r.src.source}</p>
              )}
            </div>
            <div className="flex-1 min-w-0 text-[12px] leading-relaxed">
              {r.src?.rationale ? (
                <p className="text-foreground/90">{r.src.rationale}</p>
              ) : (
                <p className="text-muted-foreground italic">No rationale recorded for this assumption yet.</p>
              )}
              {r.src?.detail && (
                <p className="mt-1.5 text-[11px] text-muted-foreground/80">
                  <span className="font-medium text-muted-foreground">Source detail:</span> {r.src.detail}
                </p>
              )}
              {r.src?.notes && (
                <p className="mt-1 text-[11px] text-muted-foreground/70">{r.src.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}


function RunConfigCard({
  targetValuation,
  onChange,
  currencyLabel,
  savedValue,
  onSave,
  saving,
}: {
  targetValuation: string;
  onChange: (v: string) => void;
  currencyLabel: string;
  savedValue: number | null;
  onSave: () => void;
  saving: boolean;
}) {
  // Split "USD '000" → ("USD", "'000") so we can compute the real-money preview.
  const [currencyCode, unit] = (() => {
    const m = currencyLabel.match(/^(\S+)\s*(.*)$/);
    return m ? [m[1], m[2]] : [currencyLabel, ''];
  })();
  const preview = formatTargetPreview(targetValuation, currencyCode, unit);
  const trimmed = targetValuation.trim();
  const currentNumeric = trimmed ? Number(trimmed) : null;
  const isDirty =
    (currentNumeric === null && savedValue !== null) ||
    (currentNumeric !== null && currentNumeric !== savedValue);
  return (
    <div className="rounded-2xl border bg-card p-4 flex items-center gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
        <Target className="h-4 w-4 text-primary" strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0">
        <Label htmlFor="target-valuation" className="text-xs font-semibold tracking-tight">
          Target valuation
        </Label>
        <p className="text-[11px] text-muted-foreground/80">
          Client&apos;s target valuation. Save to persist on the company record (used as the default on every run); or just type and Generate to use it for this run only.
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <Input
            id="target-valuation"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="e.g. 500000"
            value={targetValuation}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-44 text-sm tabular-nums"
          />
          <span className="text-[11px] text-muted-foreground/80 font-mono whitespace-nowrap">{currencyLabel}</span>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !isDirty}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors',
              saving || !isDirty
                ? 'cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground'
                : 'cursor-pointer bg-card hover:bg-muted',
            )}
          >
            {saving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving…
              </>
            ) : !isDirty && savedValue !== null ? (
              <>
                <Check className="h-3 w-3" />
                Saved
              </>
            ) : (
              <>
                <Save className="h-3 w-3" strokeWidth={2.25} />
                Save
              </>
            )}
          </button>
        </div>
        {preview && (
          <span className="text-[11px] font-medium text-primary tabular-nums whitespace-nowrap">{preview}</span>
        )}
      </div>
    </div>
  );
}


function WorkpaperHeaderCard({
  xlsxUrl,
  filename,
  generatedAt,
  errorCount,
  onRegenerate,
  onDownloadInputs,
  onReupload,
  hasInputs,
}: {
  xlsxUrl: string;
  filename: string;
  generatedAt: string;
  errorCount: number;
  onRegenerate: () => void;
  onDownloadInputs: () => void;
  onReupload: () => void;
  hasInputs: boolean;
}) {
  const downloadHref = uploadUrl(xlsxUrl);
  return (
    <div className="rounded-2xl border bg-card p-4 flex items-center gap-3 flex-wrap">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
        <FileSpreadsheet className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">Latest workpaper</h2>
          {errorCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 ring-1 ring-amber-500/30">
              <AlertTriangle className="h-2.5 w-2.5" /> {errorCount} validation
            </span>
          )}
        </div>
        <p className="font-mono text-[11px] text-muted-foreground/70 truncate">
          {filename} · {new Date(generatedAt).toLocaleString()}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 flex-wrap">
        <button
          onClick={onDownloadInputs}
          disabled={!hasInputs}
          title="Download the inputs JSON for this run so you can edit it offline"
          className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium transition-all duration-150 cursor-pointer hover:bg-muted active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileJson className="h-3.5 w-3.5" strokeWidth={2.25} />
          Inputs JSON
        </button>
        <button
          onClick={onReupload}
          title="Upload an edited xlsx (or inputs JSON) to regenerate the workpaper with your manual overrides"
          className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium transition-all duration-150 cursor-pointer hover:bg-muted active:translate-y-px"
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={2.25} />
          Re-upload
        </button>
        <button
          onClick={onRegenerate}
          className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium transition-all duration-150 cursor-pointer hover:bg-muted active:translate-y-px"
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
          Regenerate
        </button>
        {downloadHref && (
          <a
            href={downloadHref}
            download={filename}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_-4px_oklch(from_var(--primary)_l_c_h_/_0.5),inset_0_1px_0_oklch(1_0_0/0.2)] transition-all duration-150 cursor-pointer hover:brightness-110 active:translate-y-px"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
            Download xlsx
          </a>
        )}
      </div>
    </div>
  );
}

function WorkpaperResultCard({
  result,
  onRegenerate,
  onReupload,
}: {
  result: WorkpaperResult;
  onRegenerate: () => void;
  onReupload: () => void;
}) {
  const downloadHref = result.xlsx_url ? uploadUrl(result.xlsx_url) : null;
  const filename = result.xlsx_url ? result.xlsx_url.split('/').pop() ?? 'valuation.xlsx' : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">Workpaper ready</h2>
              {result.status === 'partial' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 ring-1 ring-amber-500/30">
                  <AlertTriangle className="h-3 w-3" /> Validation errors
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
            {filename && (
              <p className="mt-1 font-mono text-xs text-muted-foreground/70 truncate">{filename}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 flex-wrap">
            <button
              onClick={onReupload}
              className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium transition-all duration-150 cursor-pointer hover:bg-muted active:translate-y-px"
            >
              <Upload className="h-3.5 w-3.5" strokeWidth={2.25} />
              Re-upload
            </button>
            <button
              onClick={onRegenerate}
              className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium transition-all duration-150 cursor-pointer hover:bg-muted active:translate-y-px"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
              Regenerate
            </button>
            {downloadHref && (
              <a
                href={downloadHref}
                download={filename ?? undefined}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_-4px_oklch(from_var(--primary)_l_c_h_/_0.5),inset_0_1px_0_oklch(1_0_0/0.2)] transition-all duration-150 cursor-pointer hover:brightness-110 active:translate-y-px"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
                Download xlsx
              </a>
            )}
          </div>
        </div>
      </div>

      {result.errors.length > 0 && (
        <IssueList
          tone="error"
          title={`${result.errors.length} validation error${result.errors.length === 1 ? '' : 's'}`}
          items={result.errors}
        />
      )}
      {result.warnings.length > 0 && (
        <IssueList
          tone="warning"
          title={`${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`}
          items={result.warnings}
        />
      )}
    </div>
  );
}

function IssueList({
  tone,
  title,
  items,
}: {
  tone: 'error' | 'warning';
  title: string;
  items: string[];
}) {
  const palette =
    tone === 'error'
      ? 'border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400'
      : 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400';
  return (
    <div className={`rounded-2xl border p-5 ${palette}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs">
        {items.slice(0, 25).map((item, i) => (
          <li key={i} className="font-mono leading-relaxed text-foreground/80">
            • {item}
          </li>
        ))}
        {items.length > 25 && (
          <li className="text-muted-foreground">
            …and {items.length - 25} more (full list in response)
          </li>
        )}
      </ul>
    </div>
  );
}
