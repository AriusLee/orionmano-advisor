'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { FileSearch, Loader2, CheckCircle2, FileText, List } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GenerateReportDialog } from '@/components/reports/generate-report-dialog';
import { SectionPreview } from '@/components/reports/section-preview';
import { DDCharts } from '@/components/reports/module-charts';
import { UploadZone } from '@/components/documents/upload-zone';
import { useCompanyStore } from '@/stores/company-store';

interface Document {
  id: string;
  filename: string;
  extraction_status: string;
  extracted_data: Record<string, unknown> | null;
}

const DD_SECTIONS = [
  'Scope of Engagement',
  'Business Overview & Corporate Structure',
  'Key Financials — Balance Sheet',
  'Key Financials — Income Statement',
  'Key Financials — Cash Flow Statement',
  'Key Financials — Focus Areas',
  'Internal Control Evaluation',
  'Legal Proceedings & Prior Fundraising',
  'Taxation',
  'Key Findings & Suggestions',
];

const SUGGESTED_FILES = [
  'Audited financial statements (2-3 years)',
  'Management accounts',
  'Tax returns & filings',
  'Corporate structure chart',
  'Shareholder agreements',
  'Material contracts',
  'Bank facility agreements',
  'Legal opinion letters',
  'Interview transcripts',
];

export default function DDPage({ params }: { params: Promise<{ id: string }> }) {
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
            <FileSearch className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Due Diligence</h1>
            <p className="text-sm text-muted-foreground">
              Financial DD assessment — analytical review, risk identification, internal controls
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isReady && (
            <>
              <GenerateReportDialog companyId={id} moduleType="dd_report" moduleName="Due Diligence" onGenerated={loadData}>
                <Button variant="outline" size="sm" className="cursor-pointer gap-2"><FileText className="h-3.5 w-3.5" /> Generate Report</Button>
              </GenerateReportDialog>
              <Button variant={rightPanel === 'reports' ? 'secondary' : 'outline'} size="sm" className="cursor-pointer gap-2" onClick={() => openReports('dd_report')}>
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
            <CardTitle className="text-base">Upload Financial & Corporate Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Drop your audited financial statements, tax filings, contracts, and corporate documents.
              AI will auto-extract and analyze the data.
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
                {extractedDocs.length} document(s) processed. {hasFinancialData ? 'Financial data extracted.' : 'Upload financial statements for deeper analysis.'}
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

          <DDCharts />

          <SectionPreview
            companyId={id}
            reportType="dd_report"
            sections={DD_SECTIONS}
            icon={<FileSearch className="h-4 w-4 text-primary/60 shrink-0" />}
          />

          <div className="flex gap-2">
            <GenerateReportDialog companyId={id} moduleType="dd_report" moduleName="Due Diligence" onGenerated={loadData}>
              <Button variant="outline" className="cursor-pointer gap-2"><FileText className="h-4 w-4" /> Generate Report</Button>
            </GenerateReportDialog>
            <Button variant={rightPanel === 'reports' ? 'secondary' : 'outline'} className="cursor-pointer gap-2" onClick={() => openReports('dd_report')}>
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
