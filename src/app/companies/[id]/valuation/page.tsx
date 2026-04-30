'use client';

import { use, useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiJson, apiFetch, uploadUrl } from '@/lib/api';
import { EmptyDataState } from '@/components/empty-data-state';
import { GeneratingState } from '@/components/generating-state';
import { ValuationDashboard, type ValuationSummary } from '@/components/reports/valuation-dashboard';

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
  const [docs, setDocs] = useState<Document[]>([]);
  const [company, setCompany] = useState<CompanyMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('Loading extracted documents…');
  const [result, setResult] = useState<WorkpaperResult | null>(null);
  const [latest, setLatest] = useState<LatestSummary | null>(null);

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
        if (l && l.summary) setLatest(l as LatestSummary);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      }>(`/companies/${id}/valuation/generate-workpaper`, { method: 'POST' });

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
          />
          <ValuationDashboard
            summary={latest.summary}
            generatedAt={latest.generated_at}
            xlsxUrl={latest.xlsx_url}
            warnings={latest.warnings}
          />
        </div>
      ) : result ? (
        <WorkpaperResultCard
          result={result}
          onRegenerate={handleGenerate}
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

function WorkpaperHeaderCard({
  xlsxUrl,
  filename,
  generatedAt,
  errorCount,
  onRegenerate,
}: {
  xlsxUrl: string;
  filename: string;
  generatedAt: string;
  errorCount: number;
  onRegenerate: () => void;
}) {
  const downloadHref = uploadUrl(xlsxUrl);
  return (
    <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
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
      <div className="flex shrink-0 items-center gap-2">
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
}: {
  result: WorkpaperResult;
  onRegenerate: () => void;
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
          <div className="flex shrink-0 items-center gap-2">
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
