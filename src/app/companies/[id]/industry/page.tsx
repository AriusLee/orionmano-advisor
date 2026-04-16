'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { Globe, Loader2, FileText, List } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { GenerateReportDialog } from '@/components/reports/generate-report-dialog';
import { SectionPreview } from '@/components/reports/section-preview';
import { EmptyDataState } from '@/components/empty-data-state';
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

interface Company {
  id: string;
  name: string;
  industry: string | null;
  sub_industry: string | null;
  description: string | null;
  website: string | null;
}

const REQUIRED_DOCS = ['company_profile'];
const RECOMMENDED_DOCS = ['management_accounts', 'material_contract', 'projections'];
const REPORT_TYPE = 'industry_report';

const ANALYSIS_SECTIONS = [
  'Industry Overview & Market Context',
  'Market Size & Growth Trajectory',
  'Geographic Market Distribution',
  'Growth Drivers & Tailwinds',
  'Market Segment Deep Dive',
  'Competitive Landscape',
  'Industry Trends & Evolution',
  'Challenges & Headwinds',
  'Market Outlook & Opportunities',
  'Strategic Recommendations',
];

export default function IndustryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { openReports, rightPanel } = useCompanyStore();
  const [company, setCompany] = useState<Company | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);

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
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Page gates on report existence, not doc availability. Docs gate generation
  // inside GenerateReportDialog; here we only care whether output is on file.
  const hasReport = reports.some(
    (r) => r.report_type === REPORT_TYPE && (r.status === 'draft' || r.status === 'approved'),
  );

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
        {hasReport && (
          <div className="flex items-center gap-2">
            <GenerateReportDialog
              companyId={id}
              moduleType={REPORT_TYPE}
              moduleName="Industry Expert"
              onGenerated={loadData}
            >
              <Button variant="outline" size="sm" className="cursor-pointer gap-2">
                <FileText className="h-3.5 w-3.5" /> Regenerate
              </Button>
            </GenerateReportDialog>
            <Button
              variant={rightPanel === 'reports' ? 'secondary' : 'outline'}
              size="sm"
              className="cursor-pointer gap-2"
              onClick={() => openReports(REPORT_TYPE)}
            >
              <List className="h-3.5 w-3.5" /> Reports
            </Button>
          </div>
        )}
      </div>

      {!hasReport ? (
        <EmptyDataState
          icon={Globe}
          title="Industry Expert Analysis"
          description="Upload company context so our market research agent can position you against the right peers, segments, and growth drivers."
          requiredCategories={REQUIRED_DOCS}
          recommendedCategories={RECOMMENDED_DOCS}
          documents={docs}
          companyWebsite={company?.website}
          cta={
            <GenerateReportDialog
              companyId={id}
              moduleType={REPORT_TYPE}
              moduleName="Industry Expert"
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
        <SectionPreview
          companyId={id}
          reportType={REPORT_TYPE}
          sections={ANALYSIS_SECTIONS}
          icon={<Globe className="h-4 w-4 text-primary/60 shrink-0" />}
        />
      )}
    </div>
  );
}
