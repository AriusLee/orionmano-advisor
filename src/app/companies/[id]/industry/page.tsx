'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { Globe, Loader2, CheckCircle2, FileText, List } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
}

const REQUIRED_DOCS = [
  'company_profile',
  'management_accounts',
];

const RECOMMENDED_DOCS = [
  'material_contract',
  'projections',
];

interface Company {
  id: string;
  name: string;
  industry: string | null;
  sub_industry: string | null;
  description: string | null;
}

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
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    Promise.all([
      apiJson<Company>(`/companies/${id}`),
      apiJson<Document[]>(`/companies/${id}/documents`),
    ]).then(([c, d]) => {
      setCompany(c);
      setDocs(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const extractedDocs = docs.filter(d => d.extraction_status === 'completed' && d.extracted_data);
  // Ready only when every Required category from the checklist has at least one received doc.
  // Keeps the page honest — just having `company.industry` set at creation time isn't enough.
  const isReady = REQUIRED_DOCS.every((catId) =>
    docs.some((d) => d.extraction_status === 'completed' && (d.category || '').trim() === catId)
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
        <div className="flex items-center gap-2">
          {isReady && (
            <>
              <GenerateReportDialog companyId={id} moduleType="industry_report" moduleName="Industry Expert" onGenerated={loadData}>
                <Button variant="outline" size="sm" className="cursor-pointer gap-2">
                  <FileText className="h-3.5 w-3.5" /> Generate Report
                </Button>
              </GenerateReportDialog>
              <Button
                variant={rightPanel === 'reports' ? 'secondary' : 'outline'}
                size="sm" className="cursor-pointer gap-2"
                onClick={() => openReports('industry_report')}
              >
                <List className="h-3.5 w-3.5" /> Reports
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Empty state — polished onboarding view with auto-checklist */}
      {!isReady && (
        <EmptyDataState
          icon={Globe}
          title="Industry Expert Analysis"
          tagline="Awaiting Documents"
          description="Upload company context so our market research agent can position you against the right peers, segments, and growth drivers."
          requiredCategories={REQUIRED_DOCS}
          recommendedCategories={RECOMMENDED_DOCS}
          documents={docs}
        />
      )}

      {/* Ready state — real company context + planned report outline + generate CTA */}
      {isReady && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Context Ready
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Company context is available. Generate the Industry Expert Report to produce market sizing, competitive positioning, and strategic recommendations grounded in your uploaded materials.
              </p>
              {company?.industry && (
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-semibold mb-2">Company Context</h3>
                  <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                    <div><dt className="text-muted-foreground">Industry</dt><dd className="font-medium">{company.industry}</dd></div>
                    {company.sub_industry && <div><dt className="text-muted-foreground">Sub-industry</dt><dd className="font-medium">{company.sub_industry}</dd></div>}
                    {company.description && <div className="sm:col-span-2"><dt className="text-muted-foreground">Description</dt><dd className="font-medium">{company.description}</dd></div>}
                  </dl>
                </div>
              )}
              {extractedDocs.length > 0 && (
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-semibold mb-2">Data Sources ({extractedDocs.length})</h3>
                  <div className="space-y-2">
                    {extractedDocs.map(d => (
                      <div key={d.id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary/60" /> {d.filename}</span>
                        <Badge variant="default">Extracted</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <SectionPreview
            companyId={id}
            reportType="industry_report"
            sections={ANALYSIS_SECTIONS}
            icon={<Globe className="h-4 w-4 text-primary/60 shrink-0" />}
          />

          <div className="flex gap-2">
            <GenerateReportDialog companyId={id} moduleType="industry_report" moduleName="Industry Expert" onGenerated={loadData}>
              <Button variant="outline" className="cursor-pointer gap-2"><FileText className="h-4 w-4" /> Generate Report</Button>
            </GenerateReportDialog>
            <Button variant={rightPanel === 'reports' ? 'secondary' : 'outline'} className="cursor-pointer gap-2" onClick={() => openReports('industry_report')}>
              <List className="h-4 w-4" /> View Reports
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
