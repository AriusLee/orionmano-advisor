'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { Globe, Loader2, FileText, Edit3, Save, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { IndustryReportDashboard } from '@/components/reports/industry-report-dashboard';
import { EmptyDataState } from '@/components/empty-data-state';
import { GeneratingState } from '@/components/generating-state';

interface Document {
  id: string;
  filename: string;
  extraction_status: string;
  extracted_data: Record<string, unknown> | null;
  category?: string | null;
  categories?: string[] | null;
}

interface ReportMeta {
  id: string;
  report_type: string;
  status: string;
  progress_message?: string | null;
  created_at: string;
}

interface ReportDetail {
  id: string;
  status: string;
  progress_message?: string | null;
  sections: Array<{ id: string }>;
}

interface Company {
  id: string;
  name: string;
  industry: string | null;
  sub_industry: string | null;
  description: string | null;
  website: string | null;
  report_tier: string;
  industry_report_addendum: string | null;
}

const REQUIRED_DOCS = ['company_profile'];
const RECOMMENDED_DOCS = ['management_accounts', 'material_contract', 'projections'];
const REPORT_TYPE = 'industry_report';

export default function IndustryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [company, setCompany] = useState<Company | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [sectionsGenerated, setSectionsGenerated] = useState(0);
  // Eric 2026-05-23 — analyst-supplied addendum, persisted on the company row.
  // Generator injects into the industry_report system prompt on next regen.
  const [addendumDraft, setAddendumDraft] = useState('');
  const [savedAddendum, setSavedAddendum] = useState('');
  const [savingAddendum, setSavingAddendum] = useState(false);

  const loadData = useCallback(() => {
    Promise.all([
      apiJson<Company>(`/companies/${id}`),
      apiJson<Document[]>(`/companies/${id}/documents`),
      apiJson<ReportMeta[]>(`/companies/${id}/reports`),
    ])
      .then(([c, d, r]) => {
        setCompany(c);
        setDocs(d);
        setReports(r);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Sync addendum state with company.industry_report_addendum. We refresh the
  // "savedValue" comparator on every poll (so dirty-state stays accurate if
  // someone else saved), but only overwrite the draft when the user has no
  // pending edits — i.e., draft still equals the previously-known saved value.
  useEffect(() => {
    if (!company) return;
    const next = (company.industry_report_addendum ?? '') as string;
    setSavedAddendum((prev) => {
      if (prev === next) return prev;
      setAddendumDraft((draft) => (draft === prev ? next : draft));
      return next;
    });
  }, [company]);

  const handleSaveAddendum = async () => {
    const trimmed = addendumDraft.trim();
    setSavingAddendum(true);
    try {
      const updated = await apiJson<{ industry_report_addendum?: string | null }>(
        `/companies/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ industry_report_addendum: trimmed || null }),
        },
      );
      const val = (updated.industry_report_addendum ?? '') as string;
      setSavedAddendum(val);
      setAddendumDraft(val);
      toast.success('Saved — applied on next regenerate.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingAddendum(false);
    }
  };

  const generatingReport = reports.find(
    (r) => r.report_type === REPORT_TYPE && (r.status === 'pending' || r.status === 'generating'),
  );

  useEffect(() => {
    if (!generatingReport) {
      setSectionsGenerated(0);
      return;
    }
    let cancelled = false;
    const fetchDetail = () => {
      apiJson<ReportDetail>(`/companies/${id}/reports/${generatingReport.id}`)
        .then((d) => { if (!cancelled) setSectionsGenerated(d.sections?.length ?? 0); })
        .catch(() => {});
    };
    fetchDetail();
    const interval = setInterval(fetchDetail, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [id, generatingReport?.id]);

  const hasReport = reports.some(
    (r) => r.report_type === REPORT_TYPE && (r.status === 'draft' || r.status === 'approved'),
  );

  const handleGenerate = async () => {
    if (!company) return;
    setStarting(true);
    try {
      await apiJson(`/companies/${id}/reports/generate`, {
        method: 'POST',
        body: JSON.stringify({ report_type: REPORT_TYPE, tier: company.report_tier || 'standard' }),
      });
      toast.success('Industry expert generation started');
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start generation');
      setStarting(false);
    }
  };

  useEffect(() => {
    if (starting && (generatingReport || hasReport)) setStarting(false);
  }, [starting, generatingReport, hasReport]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Module header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Industry Expert Analysis</h1>
            <p className="text-sm text-muted-foreground">
              Comprehensive market research, competitive landscape, and strategic positioning
            </p>
          </div>
        </div>
      </div>

      {/* Analyst-supplied addendum — visible in every state so the analyst can
          seed it pre-generation, edit during a run, or revise post-generation;
          the next /reports/generate POST picks it up via the system prompt. */}
      <IndustryReportAddendumCard
        value={addendumDraft}
        onChange={setAddendumDraft}
        savedValue={savedAddendum}
        onSave={handleSaveAddendum}
        saving={savingAddendum}
      />

      {hasReport ? (
        <IndustryReportDashboard companyId={id} reportType={REPORT_TYPE} />
      ) : generatingReport || starting ? (
        <GeneratingState
          icon={Globe}
          title="Industry Expert Analysis"
          progressMessage={generatingReport?.progress_message}
          startedAt={generatingReport?.created_at ?? null}
          sectionsGenerated={sectionsGenerated}
        />
      ) : (
        <EmptyDataState
          icon={Globe}
          title="Industry Expert Analysis"
          description="Upload company context so our market research agent can position you against the right peers, segments, and growth drivers."
          requiredCategories={REQUIRED_DOCS}
          recommendedCategories={RECOMMENDED_DOCS}
          documents={docs}
          companyWebsite={company?.website}
          cta={
            <button
              onClick={handleGenerate}
              disabled={starting}
              className="group relative inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_-4px_oklch(from_var(--primary)_l_c_h_/_0.5),inset_0_1px_0_oklch(1_0_0/0.2)] transition-all duration-150 cursor-pointer hover:brightness-110 hover:shadow-[0_6px_20px_-4px_oklch(from_var(--primary)_l_c_h_/_0.6),inset_0_1px_0_oklch(1_0_0/0.25)] active:brightness-95 active:translate-y-px disabled:opacity-70 disabled:cursor-wait"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} /> : <FileText className="h-4 w-4" strokeWidth={2.25} />}
              {starting ? 'Starting…' : 'Generate Report'}
            </button>
          }
        />
      )}
    </div>
  );
}

// Persisted on the company row (industry_report_addendum). The next industry-
// report regen injects this text into the system prompt as authoritative
// analyst context.
function IndustryReportAddendumCard({
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
        <Edit3 className="h-4 w-4 text-primary" strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Additional disclosures</h2>
          <p className="text-[11px] text-muted-foreground/80">
            Optional context the AI treats as authoritative when generating the industry report — business development plan highlights, recent product launches, signed contracts, niche segment focus, anything Eric or the client flagged that public sources won&apos;t surface. Saved per-company; the next Regenerate picks it up.
          </p>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={'e.g. "Company launched DTC e-commerce channel in Q1 2026, on track to reach 25% revenue share by Y3. Signed exclusive distribution agreement with TopMart covering Southeast Asia, locking in 30% FY2026 volume. Long-dated supply contract with Universal Holdings effective 2026Q3."'}
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
              <><CheckCircle2 className="h-3 w-3" /> Saved</>
            ) : (
              <><Save className="h-3 w-3" strokeWidth={2.25} /> Save</>
            )}
          </button>
          <span className="text-[11px] text-muted-foreground/70">
            {savedValue ? `${savedValue.length} char${savedValue.length === 1 ? '' : 's'} on record` : 'Not yet saved'}
          </span>
        </div>
      </div>
    </div>
  );
}
