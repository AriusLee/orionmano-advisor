'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { FileBarChart, Loader2, CheckCircle2, FileText, List } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GenerateReportDialog } from '@/components/reports/generate-report-dialog';
import { UploadZone } from '@/components/documents/upload-zone';
import { useCompanyStore } from '@/stores/company-store';

interface Document {
  id: string;
  filename: string;
  extraction_status: string;
  extracted_data: Record<string, unknown> | null;
}

const TEASER_SECTIONS = [
  'Company Snapshot',
  'Investment Highlights',
  'Key Financial Metrics',
  'Revenue Breakdown',
  'Market Opportunity',
  'Competitive Advantages',
  'Transaction Overview',
];

const SUGGESTED_FILES = [
  'Audited financial statements',
  'Company profile / pitch deck',
  'Management projections',
  'Cap table / shareholder register',
  'Corporate structure chart',
];

export default function TeaserPage({ params }: { params: Promise<{ id: string }> }) {
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
  const isReady = extractedDocs.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FileBarChart className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Company Teaser</h1>
            <p className="text-sm text-muted-foreground">
              Concise 2-4 page summary with key metrics for potential investors
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isReady && (
            <>
              <GenerateReportDialog companyId={id} moduleType="teaser" moduleName="Company Teaser" onGenerated={loadData}>
                <Button variant="outline" size="sm" className="cursor-pointer gap-2">
                  <FileText className="h-3.5 w-3.5" /> Generate Report
                </Button>
              </GenerateReportDialog>
              <Button
                variant={rightPanel === 'reports' ? 'secondary' : 'outline'}
                size="sm" className="cursor-pointer gap-2"
                onClick={() => openReports('teaser')}
              >
                <List className="h-3.5 w-3.5" /> Reports
              </Button>
            </>
          )}
        </div>
      </div>

      {!isReady && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Company Materials</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              The teaser summarizes company highlights, key financial metrics, and transaction overview
              for potential investors. Upload financial statements and company materials to get started.
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
                {extractedDocs.length} document(s) processed. Generate a Company Teaser to create
                a concise investor-ready summary.
              </p>
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
              <UploadZone companyId={id} suggestedFiles={[]} documents={docs.filter(d => d.extraction_status !== 'completed')} onUploaded={loadData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Teaser Sections</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {TEASER_SECTIONS.map(s => (
                  <div key={s} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span className="flex items-center gap-2"><FileBarChart className="h-4 w-4 text-primary/60 shrink-0" /> {s}</span>
                    <span className="text-xs text-muted-foreground">Ready</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <GenerateReportDialog companyId={id} moduleType="teaser" moduleName="Company Teaser" onGenerated={loadData}>
              <Button variant="outline" className="cursor-pointer gap-2"><FileText className="h-4 w-4" /> Generate Report</Button>
            </GenerateReportDialog>
            <Button variant={rightPanel === 'reports' ? 'secondary' : 'outline'} className="cursor-pointer gap-2" onClick={() => openReports('teaser')}>
              <List className="h-4 w-4" /> View Reports
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
