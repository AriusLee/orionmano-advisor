'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiJson } from '@/lib/api';
import { GapAnalysisDashboard } from '@/components/reports/gap-analysis-dashboard';
import { EmptyDataState } from '@/components/empty-data-state';
import { GeneratingState } from '@/components/generating-state';
import { useCompanyStore } from '@/stores/company-store';

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

interface CompanyMeta {
  website: string | null;
  report_tier: string;
}

const REPORT_TYPE = 'gap_analysis';

const REQUIRED_DOCS = [
  'cap_table',
  'org_chart',
  'company_profile',
];

const RECOMMENDED_DOCS = [
  'management_accounts',
  'audit_report',
  'tax_return',
  'projections',
  'shareholder_agreement',
  'board_minutes',
];

export default function GapAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { openReports } = useCompanyStore();
  const [docs, setDocs] = useState<Document[]>([]);
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [company, setCompany] = useState<CompanyMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [sectionsGenerated, setSectionsGenerated] = useState(0);

  useEffect(() => {
    openReports(REPORT_TYPE);
  }, [openReports]);

  const loadData = useCallback(() => {
    Promise.all([
      apiJson<Document[]>(`/companies/${id}/documents`),
      apiJson<ReportMeta[]>(`/companies/${id}/reports`),
      apiJson<CompanyMeta>(`/companies/${id}`),
    ])
      .then(([d, r, c]) => {
        setDocs(d);
        setReports(r);
        setCompany(c);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const generatingReport = reports.find(
    (r) => r.report_type === REPORT_TYPE && (r.status === 'pending' || r.status === 'generating'),
  );

  // Fetch section count for the in-progress report so we can show "X sections drafted"
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
    const interval = setInterval(fetchDetail, 2500);
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
      toast.success('Gap analysis generation started');
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start generation');
      setStarting(false);
    }
  };

  // Clear optimistic flag once the backend report shows up in the poll (or generation finished).
  useEffect(() => {
    if (starting && (generatingReport || hasReport)) setStarting(false);
  }, [starting, generatingReport, hasReport]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 stagger-children">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
          <ClipboardCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight leading-none">Gap Analysis</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Nasdaq IPO readiness assessment — financial standards, governance, reporting, industry gaps
          </p>
        </div>
      </div>

      {hasReport ? (
        <GapAnalysisDashboard companyId={id} />
      ) : generatingReport || starting ? (
        <GeneratingState
          icon={ClipboardCheck}
          title="Gap Analysis"
          progressMessage={generatingReport?.progress_message}
          startedAt={generatingReport?.created_at ?? null}
          sectionsGenerated={sectionsGenerated}
        />
      ) : (
        <EmptyDataState
          icon={ClipboardCheck}
          title="Gap Analysis"
          description="Upload the minimum set of corporate and financial documents — we'll auto-classify them and unlock your IPO readiness assessment. Missing items on the recommended list become findings."
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
