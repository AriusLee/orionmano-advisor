'use client';

import { use, useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
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
  valuation_date: string | null;
  pinned_overrides: Record<string, number | null> | null;
  pinned_cocos: Record<string, { include?: boolean; selected_for_wacc?: boolean }> | null;
  business_development_plan: string | null;
  additional_revenue_streams: RevenueStreamWire[] | null;
}

// Wire format of Company.additional_revenue_streams (backend JSONB). Percent
// fields are decimals on the wire (0.25 = 25%), same convention as pinned
// overrides; base_year_revenue is in ACTUAL currency units like target_valuation.
interface RevenueStreamWire {
  name: string;
  description?: string | null;
  base_year_revenue: number;
  start_year?: number | null;
  growth_override?: number | null;
  gross_margin_override?: number | null;
  opex_pct_override?: number | null;
  contractual_support?: string | null;
}

// Editable row state for the streams list editor (string-valued for inputs;
// percent fields displayed ×100).
interface RevenueStreamDraft {
  name: string;
  description: string;
  base_year_revenue: string;
  start_year: string;
  growth_override: string;
  gross_margin_override: string;
  opex_pct_override: string;
  contractual_support: string;
}

interface CocoSummary {
  tier?: number;
  include?: boolean;
  selected_for_wacc?: boolean;
  company?: string;
  ticker?: string;
  business_description?: string;
}

// Mirror of backend PINNABLE_PARAMS (produce_valuation_inputs.py). Kept in
// sync manually — if a new key is added to the backend whitelist, add it here
// too or the dropdown won't surface it.
type PinnableType = 'currency' | 'percent' | 'number';
interface PinnableParam {
  key: string;
  label: string;
  type: PinnableType;
  section: string;
}
const PINNABLE_PARAMS: PinnableParam[] = [
  { key: 'revenue_y0',                  label: 'Revenue Y0 (audited base)', type: 'currency', section: 'Projections' },
  { key: 'gross_profit_y0',             label: 'Gross profit Y0',           type: 'currency', section: 'Projections' },
  { key: 'opex_y0',                     label: 'Operating expenses Y0 (negative)', type: 'currency', section: 'Projections' },
  { key: 'ebitda_y0',                   label: 'EBITDA Y0',                 type: 'currency', section: 'Projections' },
  { key: 'ebit_y0',                     label: 'EBIT Y0',                   type: 'currency', section: 'Projections' },
  { key: 'tax_y0',                      label: 'Tax Y0 (negative)',         type: 'currency', section: 'Projections' },
  { key: 'net_income_y0',               label: 'Net income Y0',             type: 'currency', section: 'Projections' },
  { key: 'revenue_growth_y1',           label: 'Revenue growth (total) — Y1',  type: 'percent',  section: 'Projections' },
  { key: 'revenue_growth_y2',           label: 'Revenue growth (total) — Y2',  type: 'percent',  section: 'Projections' },
  { key: 'revenue_growth_y3',           label: 'Revenue growth (total) — Y3',  type: 'percent',  section: 'Projections' },
  { key: 'revenue_growth_y4',           label: 'Revenue growth (total) — Y4',  type: 'percent',  section: 'Projections' },
  { key: 'revenue_growth_y5',           label: 'Revenue growth (total) — Y5',  type: 'percent',  section: 'Projections' },
  { key: 'revenue_growth_primary_y1',   label: 'Revenue growth (primary) — Y1', type: 'percent', section: 'Projections' },
  { key: 'revenue_growth_primary_y2',   label: 'Revenue growth (primary) — Y2', type: 'percent', section: 'Projections' },
  { key: 'revenue_growth_primary_y3',   label: 'Revenue growth (primary) — Y3', type: 'percent', section: 'Projections' },
  { key: 'revenue_growth_primary_y4',   label: 'Revenue growth (primary) — Y4', type: 'percent', section: 'Projections' },
  { key: 'revenue_growth_primary_y5',   label: 'Revenue growth (primary) — Y5', type: 'percent', section: 'Projections' },
  { key: 'gross_margin_y1',             label: 'Gross margin — Y1',          type: 'percent',  section: 'Projections' },
  { key: 'gross_margin_y2',             label: 'Gross margin — Y2',          type: 'percent',  section: 'Projections' },
  { key: 'gross_margin_y3',             label: 'Gross margin — Y3',          type: 'percent',  section: 'Projections' },
  { key: 'gross_margin_y4',             label: 'Gross margin — Y4',          type: 'percent',  section: 'Projections' },
  { key: 'gross_margin_y5',             label: 'Gross margin — Y5',          type: 'percent',  section: 'Projections' },
  { key: 'terminal_growth_rate',        label: 'Terminal growth rate',       type: 'percent',  section: 'Terminal' },
  { key: 'nominal_gdp_growth',          label: 'Nominal GDP growth (terminal ceiling)', type: 'percent', section: 'Terminal' },
  { key: 'risk_free_rate',              label: 'Risk-free rate',             type: 'percent',  section: 'WACC' },
  { key: 'equity_risk_premium',         label: 'Equity risk premium',        type: 'percent',  section: 'WACC' },
  { key: 'country_risk_premium',        label: 'Country risk premium',       type: 'percent',  section: 'WACC' },
  { key: 'unlevered_beta_pm',           label: 'Unlevered β (per-mgmt)',     type: 'number',   section: 'WACC' },
  { key: 'size_premium_pm',             label: 'Size premium (per-mgmt)',    type: 'percent',  section: 'WACC' },
  { key: 'specific_risk_premium_pm',    label: 'Specific risk (per-mgmt)',   type: 'percent',  section: 'WACC' },
  { key: 'pretax_cost_of_debt_pm',      label: 'Pretax Kd (per-mgmt)',       type: 'percent',  section: 'WACC' },
  { key: 'dlom_pct',                    label: 'DLOM',                        type: 'percent',  section: 'Bridge' },
  { key: 'dloc_pct',                    label: 'DLOC',                        type: 'percent',  section: 'Bridge' },
  { key: 'shares_outstanding',          label: 'Shares outstanding (basic)', type: 'number',   section: 'Bridge' },
  { key: 'shares_outstanding_diluted',  label: 'Shares outstanding (diluted)', type: 'number', section: 'Bridge' },
];
const PINNABLE_BY_KEY: Record<string, PinnableParam> =
  PINNABLE_PARAMS.reduce((acc, p) => ({ ...acc, [p.key]: p }), {});

interface WorkpaperResult {
  status: 'success' | 'partial' | 'failed';
  message: string;
  xlsx_url: string | null;
  warnings: string[];
  errors: string[];
  generatedAt: string;
  summary?: ValuationSummary | null;
  report_id?: string | null;
}

interface LatestSummary {
  generated_at: string;
  xlsx_url: string;
  xlsx_filename: string;
  warnings: string[];
  errors: string[];
  summary: ValuationSummary;
  inputs?: Record<string, unknown>;
  report_id?: string | null;
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
  // Eric 2026-05-08 item 6 — per-run valuation date. Defaults to today; the
  // prefill effect overwrites it with the most recent run's date if present.
  const [valuationDate, setValuationDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [savedValuationDate, setSavedValuationDate] = useState<string | null>(null);
  const [savingValuationDate, setSavingValuationDate] = useState(false);
  // Eric 2026-05-17 — pinned overrides. drafts: editable rows the user is
  // composing (string-valued for the input); saved: what's persisted on Company
  // (number-valued, in the units the backend expects — 0.25 for 25%, raw for currency).
  const [pinnedDrafts, setPinnedDrafts] = useState<Array<{ key: string; value: string }>>([]);
  const [savedPinnedOverrides, setSavedPinnedOverrides] = useState<Record<string, number | null>>({});
  const [savingPinned, setSavingPinned] = useState(false);
  const pinnedInitializedRef = useRef(false);
  // Pinned CoCo selection — keyed by ticker → {include, selected_for_wacc}
  const [pinnedCocosDraft, setPinnedCocosDraft] = useState<Record<string, { include: boolean; selected_for_wacc: boolean }>>({});
  const [savedPinnedCocos, setSavedPinnedCocos] = useState<Record<string, { include?: boolean; selected_for_wacc?: boolean }>>({});
  const [savingPinnedCocos, setSavingPinnedCocos] = useState(false);
  const pinnedCocosInitializedRef = useRef(false);
  // Eric 2026-05-19 #9 — Business Development Plan
  const [bdpDraft, setBdpDraft] = useState<string>('');
  const [savedBdp, setSavedBdp] = useState<string>('');
  const [savingBdp, setSavingBdp] = useState(false);
  const bdpInitializedRef = useRef(false);
  // Additional revenue streams — user-defined streams the producer maps onto
  // projections.segments (AI web-researches growth when no override is set).
  const [streamsDraft, setStreamsDraft] = useState<RevenueStreamDraft[]>([]);
  const [savedStreams, setSavedStreams] = useState<RevenueStreamWire[]>([]);
  const [savingStreams, setSavingStreams] = useState(false);
  const streamsInitializedRef = useRef(false);
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

  // Prefill the valuation date input. Precedence: Company.valuation_date
  // (saved default) > latest run's engagement.valuation_date > today (the
  // initial state). Only fires once so the user's typing isn't overwritten.
  const valuationDateInitializedRef = useRef(false);
  useEffect(() => {
    if (valuationDateInitializedRef.current) return;
    if (savedValuationDate && /^\d{4}-\d{2}-\d{2}/.test(savedValuationDate)) {
      setValuationDate(savedValuationDate.slice(0, 10));
      valuationDateInitializedRef.current = true;
      return;
    }
    const prior = latest?.summary?.engagement?.valuation_date;
    if (prior && /^\d{4}-\d{2}-\d{2}/.test(prior)) {
      setValuationDate(prior.slice(0, 10));
      valuationDateInitializedRef.current = true;
    }
  }, [savedValuationDate, latest]);

  const reuploadInputRef = useRef<HTMLInputElement>(null);

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
        report_id?: string | null;
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
        report_id: res.report_id ?? null,
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
          report_id: res.report_id ?? null,
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

  // Seed pinned-cocos draft from the latest run's cocos + saved overrides
  // once both are loaded. After that, the draft is user-controlled.
  useEffect(() => {
    if (pinnedCocosInitializedRef.current) return;
    const cocos = (latest?.inputs?.cocos as CocoSummary[] | undefined) ?? null;
    if (!cocos || cocos.length === 0) return;
    const seed: Record<string, { include: boolean; selected_for_wacc: boolean }> = {};
    for (const c of cocos) {
      const t = (c.ticker ?? '').trim();
      if (!t) continue;
      const saved = savedPinnedCocos[t] ?? {};
      seed[t] = {
        include: saved.include ?? c.include ?? false,
        selected_for_wacc: saved.selected_for_wacc ?? c.selected_for_wacc ?? false,
      };
    }
    setPinnedCocosDraft(seed);
    pinnedCocosInitializedRef.current = true;
  }, [latest, savedPinnedCocos]);

  const handleSavePinnedCocos = useCallback(async () => {
    if (savingPinnedCocos) return;
    setSavingPinnedCocos(true);
    try {
      const updated = await apiJson<CompanyMeta>(`/companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ pinned_cocos: pinnedCocosDraft }),
      });
      setSavedPinnedCocos(updated.pinned_cocos ?? {});
      toast.success(`Saved ${Object.keys(pinnedCocosDraft).length} CoCo selection${Object.keys(pinnedCocosDraft).length === 1 ? '' : 's'}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingPinnedCocos(false);
    }
  }, [id, pinnedCocosDraft, savingPinnedCocos]);

  const handleSaveBdp = useCallback(async () => {
    if (savingBdp) return;
    setSavingBdp(true);
    try {
      const trimmed = bdpDraft.trim();
      const updated = await apiJson<CompanyMeta>(`/companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ business_development_plan: trimmed || null }),
      });
      setSavedBdp(updated.business_development_plan ?? '');
      toast.success(trimmed ? 'Business development plan saved' : 'BDP cleared');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingBdp(false);
    }
  }, [id, bdpDraft, savingBdp]);

  const handleSavePinned = useCallback(async () => {
    if (savingPinned) return;
    setSavingPinned(true);
    try {
      // Convert drafts → wire format: drop empty values, parse percent → decimal,
      // dedupe by key (last wins).
      const wire: Record<string, number> = {};
      for (const row of pinnedDrafts) {
        if (!row.key || !row.value.trim()) continue;
        const param = PINNABLE_BY_KEY[row.key];
        if (!param) continue;
        const n = Number(row.value);
        if (!Number.isFinite(n)) continue;
        wire[row.key] = param.type === 'percent' ? n / 100 : n;
      }
      const updated = await apiJson<CompanyMeta>(`/companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ pinned_overrides: wire }),
      });
      setSavedPinnedOverrides(updated.pinned_overrides ?? {});
      toast.success(
        Object.keys(wire).length === 0
          ? 'Pinned overrides cleared'
          : `Saved ${Object.keys(wire).length} pinned parameter${Object.keys(wire).length === 1 ? '' : 's'}`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingPinned(false);
    }
  }, [id, pinnedDrafts, savingPinned]);

  const handleSaveStreams = useCallback(async () => {
    if (savingStreams) return;
    setSavingStreams(true);
    try {
      const wire = streamsToWire(streamsDraft);
      const updated = await apiJson<CompanyMeta>(`/companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ additional_revenue_streams: wire }),
      });
      setSavedStreams(updated.additional_revenue_streams ?? []);
      toast.success(
        wire.length === 0
          ? 'Additional revenue streams cleared'
          : `Saved ${wire.length} revenue stream${wire.length === 1 ? '' : 's'}`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingStreams(false);
    }
  }, [id, streamsDraft, savingStreams]);

  const handleSaveValuationDate = useCallback(async () => {
    if (savingValuationDate) return;
    setSavingValuationDate(true);
    try {
      const vd = valuationDate.trim() && /^\d{4}-\d{2}-\d{2}$/.test(valuationDate.trim())
        ? valuationDate.trim()
        : null;
      const updated = await apiJson<CompanyMeta>(`/companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ valuation_date: vd }),
      });
      setSavedValuationDate(updated.valuation_date ?? null);
      toast.success(vd == null ? 'Valuation date cleared' : 'Valuation date saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingValuationDate(false);
    }
  }, [id, savingValuationDate, valuationDate]);

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

  // Polling fallback — the /generate-workpaper POST can run 60-180s, and if
  // the connection silently drops (uvicorn reload, proxy timeout, sleeping
  // tab) the handleGenerate promise never resolves and the UI stays stuck
  // spinning. Watch /latest every 5s while generating; if it returns a
  // summary newer than when we started, complete the run from that data.
  useEffect(() => {
    if (!generating || !generationStartedAt) return;
    const startMs = new Date(generationStartedAt).getTime();
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/companies/${id}/valuation/latest`);
        const fresh = await res.json();
        if (!fresh || !fresh.summary || !fresh.generated_at) return;
        const freshMs = new Date(fresh.generated_at).getTime();
        if (!Number.isFinite(freshMs) || freshMs < startMs) return;
        // Fresh run detected — adopt it and exit generating state.
        setLatest(fresh as LatestSummary);
        setResult({
          status: 'success',
          message: 'Workpaper generated (recovered via polling — connection dropped)',
          xlsx_url: fresh.xlsx_url,
          warnings: fresh.warnings ?? [],
          errors: fresh.errors ?? [],
          generatedAt: fresh.generated_at,
          summary: fresh.summary,
          report_id: fresh.report_id ?? null,
        });
        setGenerating(false);
        setGenerationStartedAt(null);
      } catch {
        // 404 / network blip — keep polling, the run is still in flight.
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [generating, generationStartedAt, id]);

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
        setSavedValuationDate(c.valuation_date ?? null);
        const pinned = c.pinned_overrides ?? {};
        setSavedPinnedOverrides(pinned);
        if (!pinnedInitializedRef.current) {
          // Seed the editable drafts from saved overrides on first load.
          setPinnedDrafts(
            Object.entries(pinned)
              .filter(([k, v]) => v != null && k in PINNABLE_BY_KEY)
              .map(([k, v]) => {
                const p = PINNABLE_BY_KEY[k];
                const displayValue = p.type === 'percent' ? String((v as number) * 100) : String(v);
                return { key: k, value: displayValue };
              })
          );
          pinnedInitializedRef.current = true;
        }
        const pinCocos = c.pinned_cocos ?? {};
        setSavedPinnedCocos(pinCocos);
        const bdp = c.business_development_plan ?? '';
        setSavedBdp(bdp);
        if (!bdpInitializedRef.current) {
          setBdpDraft(bdp);
          bdpInitializedRef.current = true;
        }
        const streams = Array.isArray(c.additional_revenue_streams) ? c.additional_revenue_streams : [];
        setSavedStreams(streams);
        if (!streamsInitializedRef.current) {
          setStreamsDraft(streams.map(streamToDraft));
          streamsInitializedRef.current = true;
        }
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
        report_id?: string | null;
      }>(`/companies/${id}/valuation/generate-workpaper`, {
        method: 'POST',
        body: JSON.stringify({
          // Prefer the state value; fall back to the prior run's target so a
          // modal-initiated Regenerate (?regenerate=1) re-uses the last target
          // even before the prefill effect has copied it into state.
          target_valuation: targetValuation.trim()
            ? Number(targetValuation)
            : savedTargetValuation ?? latest?.summary?.engagement?.target_valuation ?? null,
          valuation_date: valuationDate.trim() || null,
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
        report_id: res.report_id ?? null,
      });
      if (res.summary && res.xlsx_url) {
        setLatest({
          generated_at: generatedAt,
          xlsx_url: res.xlsx_url,
          xlsx_filename: res.xlsx_url.split('/').pop() ?? 'valuation.xlsx',
          warnings: res.warnings ?? [],
          errors: res.errors ?? [],
          summary: res.summary,
          report_id: res.report_id ?? null,
        });
      }

      if (status === 'success') {
        toast.success(
          res.report_id
            ? 'Workpaper generated · written report kicked off'
            : 'Workpaper generated'
        );
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
        valuationDate={valuationDate}
        onValuationDateChange={setValuationDate}
        currencyLabel={
          latest?.summary?.currency
            ? `${latest.summary.currency.primary ?? 'USD'} ${latest.summary.currency.unit ?? ''}`.trim()
            : "USD '000"
        }
        savedValue={savedTargetValuation}
        onSave={handleSaveTarget}
        saving={savingTarget}
        savedValuationDate={savedValuationDate}
        onSaveValuationDate={handleSaveValuationDate}
        savingValuationDate={savingValuationDate}
      />

      <RiskPremiumCard
        pinnedDrafts={pinnedDrafts}
        onChangePinned={setPinnedDrafts}
        savedOverrides={savedPinnedOverrides}
        onSave={handleSavePinned}
        saving={savingPinned}
      />

      <RevenueStreamsCard
        drafts={streamsDraft}
        onChange={setStreamsDraft}
        savedStreams={savedStreams}
        onSave={handleSaveStreams}
        saving={savingStreams}
      />

      <PinnedParamsCard
        drafts={pinnedDrafts}
        onChange={setPinnedDrafts}
        savedOverrides={savedPinnedOverrides}
        onSave={handleSavePinned}
        saving={savingPinned}
      />

      <BdpCard
        value={bdpDraft}
        onChange={setBdpDraft}
        savedValue={savedBdp}
        onSave={handleSaveBdp}
        saving={savingBdp}
      />

      <PriorityDocsCard
        documents={docs}
        companyId={id}
      />

      {latest && Array.isArray(latest.inputs?.cocos) && (latest.inputs?.cocos as unknown[]).length > 0 && (
        <PinnedCocosCard
          cocos={latest.inputs?.cocos as CocoSummary[]}
          draft={pinnedCocosDraft}
          onChange={setPinnedCocosDraft}
          savedPinned={savedPinnedCocos}
          onSave={handleSavePinnedCocos}
          saving={savingPinnedCocos}
        />
      )}

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
        <>
          <div className="space-y-4 pb-32">
            <ValuationDashboard
              summary={latest.summary}
              xlsxUrl={latest.xlsx_url}
              warnings={latest.warnings}
            />
            <AssumptionsPanel inputs={latest.inputs} summary={latest.summary} />
          </div>
          <div className="sticky -bottom-4 lg:-bottom-6 z-30 -mx-4 lg:-mx-6 -mb-4 lg:-mb-6 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 lg:px-6 pt-3 pb-7 lg:pb-9">
            <WorkpaperHeaderCard
              xlsxUrl={latest.xlsx_url}
              filename={latest.xlsx_filename}
              generatedAt={latest.generated_at}
              errorCount={latest.errors?.length ?? 0}
              companyId={id}
              reportId={latest.report_id ?? null}
              onRegenerate={handleGenerate}
              onReupload={handleReuploadClick}
            />
          </div>
        </>
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

function formatTargetPreview(raw: string, currency: string): string | null {
  // target_valuation is stored in ACTUAL currency units — the typed number IS
  // the literal dollar amount, no '000 multiplier. The preview just abbreviates
  // it for readability (400000000 → "= USD 400M").
  const n = Number(raw);
  if (!raw.trim() || !Number.isFinite(n) || n <= 0) return null;
  let display: string;
  if (n >= 1_000_000_000) display = `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 2)}B`;
  else if (n >= 1_000_000) display = `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  else if (n >= 1_000) display = `${(n / 1_000).toFixed(0)}K`;
  else display = String(n);
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
  // When true, the value is already in ACTUAL currency units — skip the
  // unit-multiplier conversion that the rest of the workpaper uses.
  noUnitScale?: boolean;
}

const HEADLINE_ASSUMPTIONS: HeadlineAssumption[] = [
  { sourceId: 'target_valuation', label: 'Target valuation', path: ['engagement', 'target_valuation'], format: 'currency', noUnitScale: true },
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

function formatAssumption(raw: unknown, fmt: HeadlineAssumption['format'], digits: number | undefined, currency: string, unit: string, noUnitScale?: boolean): string {
  if (raw == null) return '—';
  const n = Number(raw);
  if (!Number.isFinite(n)) return '—';
  if (fmt === 'percent') {
    return `${(n * 100).toFixed(2)}%`;
  }
  if (fmt === 'number') {
    return n.toFixed(digits ?? 2);
  }
  // currency: apply unit multiplier so we display human-readable scale —
  // EXCEPT for fields flagged noUnitScale (target_valuation), which are
  // already in actual currency units.
  let actual: number;
  if (noUnitScale) {
    actual = n;
  } else {
    const u = unit.trim().toLowerCase();
    const mult =
      u === "'000" || u === '000' ? 1_000 :
      u === "'000000" || u === 'mm' || u === "'mm" ? 1_000_000 :
      1;
    actual = n * mult;
  }
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
                {formatAssumption(r.value, r.format, r.digits, currency, unit, r.noUnitScale)}
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
  valuationDate,
  onValuationDateChange,
  currencyLabel,
  savedValue,
  onSave,
  saving,
  savedValuationDate,
  onSaveValuationDate,
  savingValuationDate,
}: {
  targetValuation: string;
  onChange: (v: string) => void;
  valuationDate: string;
  onValuationDateChange: (v: string) => void;
  currencyLabel: string;
  savedValue: number | null;
  onSave: () => void;
  saving: boolean;
  savedValuationDate: string | null;
  onSaveValuationDate: () => void;
  savingValuationDate: boolean;
}) {
  // currencyLabel may arrive as "USD '000" — strip the unit suffix for the
  // target_valuation display because the input is ACTUAL currency, not
  // unit-scaled. The runtime stored value matches the typed number 1:1.
  const currencyCode = (currencyLabel.match(/^(\S+)/)?.[1]) || currencyLabel;
  const preview = formatTargetPreview(targetValuation, currencyCode);
  const trimmed = targetValuation.trim();
  const currentNumeric = trimmed ? Number(trimmed) : null;
  const isDirty =
    (currentNumeric === null && savedValue !== null) ||
    (currentNumeric !== null && currentNumeric !== savedValue);
  const trimmedDate = valuationDate.trim();
  const currentDate = trimmedDate && /^\d{4}-\d{2}-\d{2}$/.test(trimmedDate) ? trimmedDate : null;
  const savedDateNormalized = savedValuationDate ? savedValuationDate.slice(0, 10) : null;
  const isDateDirty =
    (currentDate === null && savedDateNormalized !== null) ||
    (currentDate !== null && currentDate !== savedDateNormalized);
  return (
    <div className="rounded-2xl border bg-card p-4 flex items-start gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20 mt-0.5">
        <Target className="h-4 w-4 text-primary" strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Run configuration</h2>
          <p className="text-[11px] text-muted-foreground/80">
            Per-run knobs the producer treats as authoritative. Target saves to the company record; date is per-run.
          </p>
        </div>

        {/* Row 1 — Target valuation */}
        <div className="flex items-center gap-3 flex-wrap">
          <Label htmlFor="target-valuation" className="text-xs font-medium w-32 shrink-0">
            Target valuation
          </Label>
          <Input
            id="target-valuation"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="e.g. 500000000"
            value={targetValuation}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-52 text-sm tabular-nums"
          />
          <span className="text-[11px] text-muted-foreground/80 font-mono whitespace-nowrap">{currencyCode}</span>
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
          {preview && (
            <span className="text-[11px] font-medium text-primary tabular-nums whitespace-nowrap">{preview}</span>
          )}
        </div>

        {/* Row 2 — Valuation date (Eric item 6) */}
        <div className="flex items-center gap-3 flex-wrap">
          <Label htmlFor="valuation-date" className="text-xs font-medium w-32 shrink-0">
            Valuation date
          </Label>
          <Input
            id="valuation-date"
            type="date"
            value={valuationDate}
            onChange={(e) => onValuationDateChange(e.target.value)}
            className="h-9 w-44 text-sm tabular-nums"
          />
          <button
            type="button"
            onClick={onSaveValuationDate}
            disabled={savingValuationDate || !isDateDirty}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors',
              savingValuationDate || !isDateDirty
                ? 'cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground'
                : 'cursor-pointer bg-card hover:bg-muted',
            )}
          >
            {savingValuationDate ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving…
              </>
            ) : !isDateDirty && savedDateNormalized !== null ? (
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
          <span className="text-[11px] text-muted-foreground/80 whitespace-nowrap">
            Anchors forecasts, risk-free rate, comp multiples
          </span>
        </div>
      </div>
    </div>
  );
}


function PriorityDocsCard({
  documents,
  companyId,
}: {
  documents: Document[];
  companyId: string;
}) {
  // Same priority taxonomy as the producer prompt. Each entry: {category id,
  // human label, tier (primary = must-have, secondary = strengthens)}.
  const PRIORITY_DOCS: { id: string; label: string; tier: 'primary' | 'secondary' }[] = [
    { id: 'audit_report',         label: 'Audited financial statements',  tier: 'primary' },
    { id: 'management_accounts',  label: 'Management accounts (interim)', tier: 'primary' },
    { id: 'projections',          label: 'Financial projections / BDP',    tier: 'primary' },
    { id: 'cap_table',            label: 'Cap table',                       tier: 'secondary' },
    { id: 'shareholder_agreement',label: 'Shareholder agreement',           tier: 'secondary' },
    { id: 'tax_return',           label: 'Tax returns',                     tier: 'secondary' },
    { id: 'board_minutes',        label: 'Board minutes',                   tier: 'secondary' },
  ];
  const hasDoc = (cat: string) =>
    documents.some(d =>
      (d.category || '').trim() === cat ||
      (Array.isArray(d.categories) && d.categories.includes(cat))
    );
  const primaryCount = PRIORITY_DOCS.filter(p => p.tier === 'primary' && hasDoc(p.id)).length;
  const primaryTotal = PRIORITY_DOCS.filter(p => p.tier === 'primary').length;

  return (
    <div className="rounded-2xl border bg-card p-4 flex items-start gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20 mt-0.5">
        <FileSpreadsheet className="h-4 w-4 text-primary" strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-semibold tracking-tight">Priority financial documents</h2>
          <span className="text-[10px] font-mono text-muted-foreground/70 px-2 py-0.5 rounded-full bg-muted/40">
            {primaryCount}/{primaryTotal} core uploaded
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground/80">
          The AI weighs these categories first when extracting financial data. Missing primary docs limit accuracy; missing secondary docs limit defensibility.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRIORITY_DOCS.map(p => {
            const present = hasDoc(p.id);
            return (
              <div
                key={p.id}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs',
                  present
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : p.tier === 'primary'
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-border/60 bg-muted/20'
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {present ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : p.tier === 'primary' ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 shrink-0" />
                  )}
                  <span className="truncate font-medium">{p.label}</span>
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 shrink-0">
                  {p.tier}
                </span>
              </div>
            );
          })}
        </div>
        <a
          href={`/companies/${companyId}/documents`}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium transition-colors cursor-pointer hover:bg-muted self-start"
        >
          <Upload className="h-3 w-3" strokeWidth={2.25} />
          Manage uploads
        </a>
      </div>
    </div>
  );
}


function BdpCard({
  value,
  onChange,
  savedValue,
  onSave,
  saving,
}: {
  value: string;
  onChange: (v: string) => void;
  savedValue: string;
  onSave: () => void;
  saving: boolean;
}) {
  const isDirty = value.trim() !== (savedValue ?? '').trim();
  return (
    <div className="rounded-2xl border bg-card p-4 flex items-start gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20 mt-0.5">
        <FileText className="h-4 w-4 text-primary" strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Business development plan</h2>
          <p className="text-[11px] text-muted-foreground/80">
            Narrative the AI treats as authoritative for growth / margin justification. Cite specific drivers (new product launches, geographic expansion, signed contracts, capex programs) so every projection lever traces to a plan item.
          </p>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={'e.g. "Q3 2025: launch Atlas migration, enabling enterprise tier and unlocking ~30% Y1 revenue lift. Q4 2025: Singapore office opens, opening APAC channel. 2026: long-dated supply contract with TopMart guarantees 60% of FY2026 revenue."'}
          rows={6}
          className="w-full rounded-md border bg-card px-3 py-2 text-sm leading-snug font-mono resize-vertical"
        />
        <div className="flex items-center gap-2">
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
              <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
            ) : !isDirty ? (
              <><Check className="h-3 w-3" /> Saved</>
            ) : (
              <><Save className="h-3 w-3" strokeWidth={2.25} /> Save</>
            )}
          </button>
          <span className="text-[11px] text-muted-foreground/60">
            {value.trim().length} chars
          </span>
        </div>
      </div>
    </div>
  );
}


function PinnedCocosCard({
  cocos,
  draft,
  onChange,
  savedPinned,
  onSave,
  saving,
}: {
  cocos: CocoSummary[];
  draft: Record<string, { include: boolean; selected_for_wacc: boolean }>;
  onChange: (next: Record<string, { include: boolean; selected_for_wacc: boolean }>) => void;
  savedPinned: Record<string, { include?: boolean; selected_for_wacc?: boolean }>;
  onSave: () => void;
  saving: boolean;
}) {
  // Dirty when any ticker's draft differs from saved
  const isDirty = (() => {
    for (const [ticker, d] of Object.entries(draft)) {
      const s = savedPinned[ticker];
      if (!s) return true;
      if ((s.include ?? false) !== d.include) return true;
      if ((s.selected_for_wacc ?? false) !== d.selected_for_wacc) return true;
    }
    // Check if any saved key was removed from draft
    for (const ticker of Object.keys(savedPinned)) {
      if (!(ticker in draft)) return true;
    }
    return false;
  })();

  const toggle = (ticker: string, field: 'include' | 'selected_for_wacc', value: boolean) => {
    const cur = draft[ticker] ?? { include: false, selected_for_wacc: false };
    const next = { ...cur, [field]: value };
    // selected_for_wacc=true implies include=true
    if (field === 'selected_for_wacc' && value) next.include = true;
    onChange({ ...draft, [ticker]: next });
  };

  return (
    <div className="rounded-2xl border bg-card p-4 flex items-start gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20 mt-0.5">
        <Target className="h-4 w-4 text-primary" strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Pinned CoCo selection</h2>
          <p className="text-[11px] text-muted-foreground/80">
            Lock which comparable companies are included and which feed the WACC β derivation. Pinned selections persist across regenerates and override the LLM's choices.
          </p>
        </div>
        <div className="rounded-lg border bg-muted/20 overflow-hidden">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-x-3 px-3 py-2 border-b text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
            <span>Tier</span>
            <span>Company / Ticker</span>
            <span className="text-center w-16">Include</span>
            <span className="text-center w-16">WACC</span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y">
            {cocos.map((c, i) => {
              const ticker = (c.ticker ?? '').trim();
              if (!ticker) return null;
              const row = draft[ticker] ?? { include: c.include ?? false, selected_for_wacc: c.selected_for_wacc ?? false };
              return (
                <div key={`${ticker}-${i}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-x-3 px-3 py-2 items-center text-xs">
                  <span className="font-mono text-muted-foreground tabular-nums">T{c.tier ?? '?'}</span>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.company ?? '(unnamed)'}</div>
                    <div className="truncate text-[10px] text-muted-foreground/70 font-mono">{ticker}{c.business_description ? ` · ${c.business_description}` : ''}</div>
                  </div>
                  <div className="flex items-center justify-center w-16">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-primary"
                      checked={row.include}
                      onChange={(e) => toggle(ticker, 'include', e.target.checked)}
                    />
                  </div>
                  <div className="flex items-center justify-center w-16">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-primary"
                      checked={row.selected_for_wacc}
                      onChange={(e) => toggle(ticker, 'selected_for_wacc', e.target.checked)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
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
              <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
            ) : !isDirty ? (
              <><Check className="h-3 w-3" /> Saved</>
            ) : (
              <><Save className="h-3 w-3" strokeWidth={2.25} /> Save</>
            )}
          </button>
          <span className="text-[11px] text-muted-foreground/70">
            Selecting for WACC implies include.
          </span>
        </div>
      </div>
    </div>
  );
}


// ── Additional revenue streams ──────────────────────────────────────────────

function streamToDraft(s: RevenueStreamWire): RevenueStreamDraft {
  const pct = (v: number | null | undefined) => (v == null ? '' : String(v * 100));
  return {
    name: s.name ?? '',
    description: s.description ?? '',
    base_year_revenue: s.base_year_revenue != null ? String(s.base_year_revenue) : '',
    start_year: s.start_year != null ? String(s.start_year) : '1',
    growth_override: pct(s.growth_override),
    gross_margin_override: pct(s.gross_margin_override),
    opex_pct_override: pct(s.opex_pct_override),
    contractual_support: s.contractual_support ?? '',
  };
}

function streamsToWire(drafts: RevenueStreamDraft[]): RevenueStreamWire[] {
  const out: RevenueStreamWire[] = [];
  for (const d of drafts) {
    const name = d.name.trim();
    const base = Number(d.base_year_revenue);
    if (!name || !Number.isFinite(base) || base <= 0) continue;
    const pct = (raw: string): number | null => {
      if (!raw.trim()) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n / 100 : null;
    };
    const startRaw = Number(d.start_year);
    out.push({
      name,
      description: d.description.trim() || null,
      base_year_revenue: base,
      start_year: Number.isFinite(startRaw) && startRaw >= 0 ? Math.floor(startRaw) : 1,
      growth_override: pct(d.growth_override),
      gross_margin_override: pct(d.gross_margin_override),
      opex_pct_override: pct(d.opex_pct_override),
      contractual_support: d.contractual_support.trim() || null,
    });
  }
  return out;
}

const EMPTY_STREAM_DRAFT: RevenueStreamDraft = {
  name: '',
  description: '',
  base_year_revenue: '',
  start_year: '1',
  growth_override: '',
  gross_margin_override: '',
  opex_pct_override: '',
  contractual_support: '',
};

function RevenueStreamsCard({
  drafts,
  onChange,
  savedStreams,
  onSave,
  saving,
}: {
  drafts: RevenueStreamDraft[];
  onChange: (next: RevenueStreamDraft[]) => void;
  savedStreams: RevenueStreamWire[];
  onSave: () => void;
  saving: boolean;
}) {
  const isDirty = JSON.stringify(streamsToWire(drafts)) !== JSON.stringify(streamsToWire(savedStreams.map(streamToDraft)));
  const addRow = () => onChange([...drafts, { ...EMPTY_STREAM_DRAFT }]);
  const updateRow = (idx: number, patch: Partial<RevenueStreamDraft>) => {
    onChange(drafts.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeRow = (idx: number) => onChange(drafts.filter((_, i) => i !== idx));

  return (
    <div className="rounded-2xl border bg-card p-4 flex items-start gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20 mt-0.5">
        <Sparkles className="h-4 w-4 text-primary" strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Additional revenue streams</h2>
          <p className="text-[11px] text-muted-foreground/80">
            User-defined streams added to the DCF projections. Leave the growth override blank and the AI
            researches an appropriate market growth rate (industry reports, sector statistics) at generation
            time. COGS and related opex scale with each stream and are broken down per stream in the outputs.
          </p>
        </div>

        {drafts.length === 0 && (
          <p className="text-[11px] text-muted-foreground/60 italic">
            No additional revenue streams. Add one to layer a new revenue line into the DCF.
          </p>
        )}

        <div className="space-y-3">
          {drafts.map((row, idx) => (
            <div key={idx} className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  placeholder="Stream name (e.g. EV charging services)"
                  value={row.name}
                  onChange={(e) => updateRow(idx, { name: e.target.value })}
                  className="h-9 w-72 text-sm"
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="Base-year revenue (actual currency)"
                  value={row.base_year_revenue}
                  onChange={(e) => updateRow(idx, { base_year_revenue: e.target.value })}
                  className="h-9 w-64 text-sm tabular-nums"
                />
                <div className="flex items-center gap-1.5">
                  <Label className="text-[11px] text-muted-foreground/70">Starts</Label>
                  <select
                    value={row.start_year}
                    onChange={(e) => updateRow(idx, { start_year: e.target.value })}
                    className="h-9 rounded-md border bg-card px-2 text-xs cursor-pointer"
                  >
                    {['0', '1', '2', '3', '4', '5'].map((y) => (
                      <option key={y} value={y}>{y === '0' ? 'Y0 (existing)' : `Y${y}`}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  title="Remove this stream"
                  className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors cursor-pointer hover:bg-muted hover:text-foreground"
                >
                  ×
                </button>
              </div>
              <Input
                placeholder="Description — what this stream is, who buys it (used in the report narrative)"
                value={row.description}
                onChange={(e) => updateRow(idx, { description: e.target.value })}
                className="h-9 text-sm"
              />
              <div className="flex items-center gap-3 flex-wrap">
                {([
                  ['growth_override', 'Growth override %', 'blank = AI researches market growth'],
                  ['gross_margin_override', 'Gross margin %', 'blank = AI estimates'],
                  ['opex_pct_override', 'Related opex %', 'S&M/distribution as % of stream revenue'],
                ] as const).map(([key, label, hint]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <Label className="text-[11px] text-muted-foreground/70 whitespace-nowrap" title={hint}>{label}</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      placeholder="—"
                      value={row[key]}
                      onChange={(e) => updateRow(idx, { [key]: e.target.value })}
                      className="h-9 w-24 text-sm tabular-nums"
                    />
                  </div>
                ))}
              </div>
              <Input
                placeholder="Contractual support (signed contracts, backlog, MOUs) — blank flags the stream as unproven"
                value={row.contractual_support}
                onChange={(e) => updateRow(idx, { contractual_support: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium transition-colors cursor-pointer hover:bg-muted"
          >
            + Add revenue stream
          </button>
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
              <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
            ) : !isDirty ? (
              <><Check className="h-3 w-3" /> Saved</>
            ) : (
              <><Save className="h-3 w-3" strokeWidth={2.25} /> Save</>
            )}
          </button>
          <p className="text-[10px] text-muted-foreground/60">
            Changes apply on the next Generate/Regenerate run.
          </p>
        </div>
      </div>
    </div>
  );
}


// ── Company-specific risk premium ───────────────────────────────────────────
// Dedicated, always-visible shortcut to the `specific_risk_premium_pm` pinned
// parameter — reads and writes the SAME pinnedDrafts state as PinnedParamsCard
// so the two views can never diverge.

const RISK_PREMIUM_KEY = 'specific_risk_premium_pm';

function RiskPremiumCard({
  pinnedDrafts,
  onChangePinned,
  savedOverrides,
  onSave,
  saving,
}: {
  pinnedDrafts: Array<{ key: string; value: string }>;
  onChangePinned: (next: Array<{ key: string; value: string }>) => void;
  savedOverrides: Record<string, number | null>;
  onSave: () => void;
  saving: boolean;
}) {
  const row = pinnedDrafts.find((r) => r.key === RISK_PREMIUM_KEY);
  const value = row?.value ?? '';
  const savedRaw = savedOverrides[RISK_PREMIUM_KEY];
  const savedDisplay = savedRaw != null ? savedRaw * 100 : null;
  const draftNum = value.trim() ? Number(value) : null;
  const isDirty =
    (draftNum == null) !== (savedDisplay == null) ||
    (draftNum != null && savedDisplay != null && Math.abs(draftNum - savedDisplay) > 1e-9);

  const setValue = (v: string) => {
    if (row) {
      onChangePinned(pinnedDrafts.map((r) => (r.key === RISK_PREMIUM_KEY ? { ...r, value: v } : r)));
    } else {
      onChangePinned([...pinnedDrafts, { key: RISK_PREMIUM_KEY, value: v }]);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-4 flex items-start gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20 mt-0.5">
        <AlertTriangle className="h-4 w-4 text-primary" strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Company-Specific Risk Premium (%)</h2>
          <p className="text-[11px] text-muted-foreground/80">
            Feeds the WACC cost of equity on top of base CAPM (Rf + β×ERP), country risk and size premium —
            a higher premium raises the discount rate and lowers the enterprise value. The WACC build-up
            in the workpaper and report shows how it combines with the other components.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="e.g. 2.5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-9 w-32 text-sm tabular-nums"
          />
          <span className="text-[11px] text-muted-foreground/70 font-mono">%</span>
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
              <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
            ) : !isDirty ? (
              <><Check className="h-3 w-3" /> Saved</>
            ) : (
              <><Save className="h-3 w-3" strokeWidth={2.25} /> Save</>
            )}
          </button>
          {savedDisplay != null && (
            <p className="text-[10px] text-muted-foreground/60">
              Pinned at {savedDisplay.toFixed(2)}% — the producer preserves this verbatim across regenerates.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}


function PinnedParamsCard({
  drafts,
  onChange,
  savedOverrides,
  onSave,
  saving,
}: {
  drafts: Array<{ key: string; value: string }>;
  onChange: (next: Array<{ key: string; value: string }>) => void;
  savedOverrides: Record<string, number | null>;
  onSave: () => void;
  saving: boolean;
}) {
  // Detect dirty: compare current draft set vs savedOverrides.
  const draftWire: Record<string, number | null> = (() => {
    const out: Record<string, number | null> = {};
    for (const row of drafts) {
      if (!row.key || !row.value.trim()) continue;
      const param = PINNABLE_BY_KEY[row.key];
      if (!param) continue;
      const n = Number(row.value);
      if (!Number.isFinite(n)) continue;
      out[row.key] = param.type === 'percent' ? n / 100 : n;
    }
    return out;
  })();
  const isDirty = (() => {
    const draftKeys = Object.keys(draftWire);
    const savedKeys = Object.keys(savedOverrides).filter(k => savedOverrides[k] != null);
    if (draftKeys.length !== savedKeys.length) return true;
    for (const k of draftKeys) {
      const dv = draftWire[k];
      const sv = savedOverrides[k];
      if (sv == null || dv == null) return true;
      if (Math.abs(dv - sv) > 1e-9) return true;
    }
    return false;
  })();
  const usedKeys = new Set(drafts.map(r => r.key).filter(Boolean));
  const addRow = () => {
    // Pick the first param key that isn't already in the drafts.
    const next = PINNABLE_PARAMS.find(p => !usedKeys.has(p.key));
    if (!next) return;
    onChange([...drafts, { key: next.key, value: '' }]);
  };
  const updateRow = (idx: number, patch: Partial<{ key: string; value: string }>) => {
    onChange(drafts.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };
  const removeRow = (idx: number) => {
    onChange(drafts.filter((_, i) => i !== idx));
  };

  return (
    <div className="rounded-2xl border bg-card p-4 flex items-start gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20 mt-0.5">
        <Lightbulb className="h-4 w-4 text-primary" strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Pinned parameters</h2>
          <p className="text-[11px] text-muted-foreground/80">
            Values the producer must preserve verbatim across regenerates. Other params calibrate around these to hit the target valuation.
          </p>
        </div>

        {drafts.length === 0 && (
          <p className="text-[11px] text-muted-foreground/60 italic">
            No pinned parameters. Add one to lock a specific value across regenerates.
          </p>
        )}

        <div className="space-y-2">
          {drafts.map((row, idx) => {
            const param = PINNABLE_BY_KEY[row.key];
            const unitHint = param?.type === 'percent' ? '%' : param?.type === 'currency' ? "(workpaper unit)" : '';
            const placeholder = param?.type === 'percent' ? 'e.g. 25' : param?.type === 'currency' ? 'e.g. 45000' : 'value';
            return (
              <div key={idx} className="flex items-center gap-2 flex-wrap">
                <select
                  value={row.key}
                  onChange={(e) => updateRow(idx, { key: e.target.value, value: '' })}
                  className="h-9 w-64 rounded-md border bg-card px-2 text-xs cursor-pointer"
                >
                  {PINNABLE_PARAMS.map(p => (
                    <option key={p.key} value={p.key} disabled={p.key !== row.key && usedKeys.has(p.key)}>
                      {p.section} — {p.label}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder={placeholder}
                  value={row.value}
                  onChange={(e) => updateRow(idx, { value: e.target.value })}
                  className="h-9 w-32 text-sm tabular-nums"
                />
                <span className="text-[11px] text-muted-foreground/70 font-mono">{unitHint}</span>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  title="Remove this pin"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors cursor-pointer hover:bg-muted hover:text-foreground"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={addRow}
            disabled={usedKeys.size >= PINNABLE_PARAMS.length}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium transition-colors cursor-pointer hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add parameter
          </button>
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
              <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
            ) : !isDirty ? (
              <><Check className="h-3 w-3" /> Saved</>
            ) : (
              <><Save className="h-3 w-3" strokeWidth={2.25} /> Save</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


function WorkpaperHeaderCard({
  xlsxUrl,
  filename,
  generatedAt,
  errorCount,
  companyId,
  reportId,
  onRegenerate,
  onReupload,
}: {
  xlsxUrl: string;
  filename: string;
  generatedAt: string;
  errorCount: number;
  companyId: string;
  reportId: string | null;
  onRegenerate: () => void;
  onReupload: () => void;
}) {
  const downloadHref = uploadUrl(xlsxUrl);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
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
      </div>
      <div className="grid grid-cols-2 md:grid-flow-col md:auto-cols-fr gap-2">
        <button
          onClick={onReupload}
          title="Upload an edited xlsx (or inputs JSON) to regenerate the workpaper with your manual overrides"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium transition-all duration-150 cursor-pointer hover:bg-muted active:translate-y-px"
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={2.25} />
          Re-upload
        </button>
        <button
          onClick={onRegenerate}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium transition-all duration-150 cursor-pointer hover:bg-muted active:translate-y-px"
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
          Regenerate
        </button>
        {downloadHref && (
          <a
            href={downloadHref}
            download={filename}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_-4px_oklch(from_var(--primary)_l_c_h_/_0.5),inset_0_1px_0_oklch(1_0_0/0.2)] transition-all duration-150 cursor-pointer hover:brightness-110 active:translate-y-px"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
            Download
          </a>
        )}
        {reportId && (
          <a
            href={`/companies/${companyId}/reports/${reportId}`}
            title="View the written valuation report that explains every assumption in this workpaper"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium transition-all duration-150 cursor-pointer hover:bg-muted active:translate-y-px"
          >
            <FileText className="h-3.5 w-3.5" strokeWidth={2.25} />
            View Report
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
