'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, FileText, Loader2 } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { GapAnalysisDashboard } from '@/components/reports/gap-analysis-dashboard';
import { EmptyDataState } from '@/components/empty-data-state';
import { GenerateReportDialog } from '@/components/reports/generate-report-dialog';
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
  const [companyWebsite, setCompanyWebsite] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    openReports(REPORT_TYPE);
  }, [openReports]);

  const loadData = useCallback(() => {
    Promise.all([
      apiJson<Document[]>(`/companies/${id}/documents`),
      apiJson<ReportMeta[]>(`/companies/${id}/reports`),
      apiJson<{ website: string | null }>(`/companies/${id}`),
    ])
      .then(([d, r, c]) => {
        setDocs(d);
        setReports(r);
        setCompanyWebsite(c.website || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  // Page gates on report existence, not doc availability. This mirrors how the
  // Industry Expert page behaves — the module only reveals its dashboard once
  // actual output exists, so no more "Context Ready" dead-end.
  const hasReport = reports.some(
    (r) => r.report_type === REPORT_TYPE && (r.status === 'draft' || r.status === 'approved'),
  );

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

      {!hasReport ? (
        <EmptyDataState
          icon={ClipboardCheck}
          title="Gap Analysis"
          description="Upload the minimum set of corporate and financial documents — we'll auto-classify them and unlock your IPO readiness assessment. Missing items on the recommended list become findings."
          requiredCategories={REQUIRED_DOCS}
          recommendedCategories={RECOMMENDED_DOCS}
          documents={docs}
          companyWebsite={companyWebsite}
          cta={
            <GenerateReportDialog
              companyId={id}
              moduleType={REPORT_TYPE}
              moduleName="Gap Analysis"
              onGenerated={loadData}
            >
              <button className="group relative inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_-4px_oklch(from_var(--primary)_l_c_h_/_0.5),inset_0_1px_0_oklch(1_0_0/0.2)] transition-all duration-150 cursor-pointer hover:brightness-110 hover:shadow-[0_6px_20px_-4px_oklch(from_var(--primary)_l_c_h_/_0.6),inset_0_1px_0_oklch(1_0_0/0.25)] active:brightness-95 active:translate-y-px">
                <FileText className="h-4 w-4" strokeWidth={2.25} />
                Generate Report
              </button>
            </GenerateReportDialog>
          }
        />
      ) : (
        <GapAnalysisDashboard companyId={id} />
      )}
    </div>
  );
}
