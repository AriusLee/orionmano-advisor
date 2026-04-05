'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, Loader2, CheckCircle2, FileText, List } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GenerateReportDialog } from '@/components/reports/generate-report-dialog';
import { SectionPreview } from '@/components/reports/section-preview';
import { GapAnalysisCharts } from '@/components/reports/module-charts';
import { UploadZone } from '@/components/documents/upload-zone';
import { useCompanyStore } from '@/stores/company-store';

interface Document {
  id: string;
  filename: string;
  extraction_status: string;
  extracted_data: Record<string, unknown> | null;
}

const GAP_ANALYSIS_SECTIONS = [
  'Nasdaq Listing Requirements — Financial Standards',
  'Financial Analysis — Financial Highlights',
  'Financial Analysis — Other Metrics',
  'Industry Considerations',
  'Financial Gaps & Recommendations',
  'Governance Gaps & Recommendations',
  'Reporting & Disclosure Gaps',
  'Industry-Specific Gaps',
  'Conclusion & Priority Actions',
];

const SUGGESTED_FILES = [
  'Corporate proposal / company profile',
  'Audited financial statements (2 years)',
  'Current management reports (balance sheet & P&L)',
  'Shareholder structure & cap table',
];

export default function GapAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { openReports, rightPanel } = useCompanyStore();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    apiJson<Document[]>(`/companies/${id}/documents`)
      .then(setDocs)
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

  const extractedDocs = docs.filter(d => d.extraction_status === 'completed' && d.extracted_data);
  const hasFinancialData = extractedDocs.some(d => {
    const data = d.extracted_data as Record<string, unknown> | null;
    return data && ('financial_data' in data || 'income_statement' in data);
  });
  const isReady = extractedDocs.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ClipboardCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gap Analysis</h1>
            <p className="text-sm text-muted-foreground">
              Nasdaq IPO readiness assessment — financial standards, governance, reporting, industry gaps
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isReady && (
            <>
              <GenerateReportDialog companyId={id} moduleType="gap_analysis" moduleName="Gap Analysis" onGenerated={loadData}>
                <Button variant="outline" size="sm" className="cursor-pointer gap-2"><FileText className="h-3.5 w-3.5" /> Generate Report</Button>
              </GenerateReportDialog>
              <Button variant={rightPanel === 'reports' ? 'secondary' : 'outline'} size="sm" className="cursor-pointer gap-2" onClick={() => openReports('gap_analysis')}>
                <List className="h-3.5 w-3.5" /> Reports
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Upload zone — always visible when not ready */}
      {!isReady && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Key Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Upload the 4 key documents to generate a Gap Analysis: corporate profile, 2-year audited financials,
              current management reports, and shareholder structure. AI will assess Nasdaq listing readiness.
            </p>
            <UploadZone companyId={id} suggestedFiles={SUGGESTED_FILES} documents={docs} onUploaded={loadData} />
          </CardContent>
        </Card>
      )}

      {isReady && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Data Available
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {extractedDocs.length} document(s) processed. {hasFinancialData ? 'Financial data extracted — ready for gap analysis.' : 'Upload audited financial statements for complete analysis.'}
              </p>
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-2">Processed Documents ({extractedDocs.length})</h3>
                <div className="space-y-2">
                  {extractedDocs.map(d => (
                    <div key={d.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary/60" /> {d.filename}</span>
                      <Badge variant="default">Extracted</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <GapAnalysisCharts />

          <SectionPreview
            companyId={id}
            reportType="gap_analysis"
            sections={GAP_ANALYSIS_SECTIONS}
            icon={<ClipboardCheck className="h-4 w-4 text-primary/60 shrink-0" />}
          />

          <div className="flex gap-2">
            <GenerateReportDialog companyId={id} moduleType="gap_analysis" moduleName="Gap Analysis" onGenerated={loadData}>
              <Button variant="outline" className="cursor-pointer gap-2"><FileText className="h-4 w-4" /> Generate Report</Button>
            </GenerateReportDialog>
            <Button variant={rightPanel === 'reports' ? 'secondary' : 'outline'} className="cursor-pointer gap-2" onClick={() => openReports('gap_analysis')}>
              <List className="h-4 w-4" /> View Reports
            </Button>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Upload Additional Documents</CardTitle></CardHeader>
            <CardContent>
              <UploadZone companyId={id} suggestedFiles={SUGGESTED_FILES} documents={docs.filter(d => d.extraction_status !== 'completed')} onUploaded={loadData} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
