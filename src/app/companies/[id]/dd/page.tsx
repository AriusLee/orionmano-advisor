'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { FileSearch, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { apiJson } from '@/lib/api';
import { EmptyDataState } from '@/components/empty-data-state';
import { GeneratingState } from '@/components/generating-state';
import { DDReportDashboard } from '@/components/reports/dd-report-dashboard';
import { Button } from '@/components/ui/button';
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
  tier?: string;
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

const REPORT_TYPE = 'dd_report';

const REQUIRED_DOCS = ['audit_report', 'management_accounts'];

const RECOMMENDED_DOCS = [
  'tax_return',
  'material_contract',
  'board_minutes',
  'shareholder_agreement',
  'projections',
  'legal',
];

export default function DDPage({ params }: { params: Promise<{ id: string }> }) {
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
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

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

  const latestReport = reports
    .filter((r) => r.report_type === REPORT_TYPE && (r.status === 'draft' || r.status === 'approved'))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const hasReport = !!latestReport;

  const handleGenerate = async () => {
    if (!company) return;
    setStarting(true);
    try {
      await apiJson(`/companies/${id}/reports/generate`, {
        method: 'POST',
        body: JSON.stringify({ report_type: REPORT_TYPE, tier: company.report_tier || 'standard' }),
      });
      toast.success('Due diligence generation started');
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
    <div className="space-y-6 stagger-children">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <FileSearch className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight leading-none">Due Diligence</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Transaction-grade FDD — QoE bridge, net debt + debt-like items, working capital peg, key findings
            </p>
          </div>
        </div>
        {hasReport && (
          <Button onClick={handleGenerate} disabled={starting} variant="outline" className="cursor-pointer">
            {starting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
            {starting ? 'Starting…' : 'Regenerate'}
          </Button>
        )}
      </div>

      {hasReport ? (
        <DDReportDashboard companyId={id} reportId={latestReport.id} />
      ) : generatingReport || starting ? (
        <GeneratingState
          icon={FileSearch}
          title="Due Diligence"
          progressMessage={generatingReport?.progress_message}
          startedAt={generatingReport?.created_at ?? null}
          sectionsGenerated={sectionsGenerated}
        />
      ) : (
        <EmptyDataState
          icon={FileSearch}
          title="Due Diligence"
          description="Upload audited financials and interim management accounts so our DD agent can build the QoE bridge, net-debt schedule, and working-capital peg. Recommended: tax returns, material contracts, board minutes for adjustment support."
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
