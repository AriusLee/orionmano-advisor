'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { BarChart3, Loader2, CheckCircle2, FileText, List, Clock } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GenerateReportDialog } from '@/components/reports/generate-report-dialog';
import { SectionPreview } from '@/components/reports/section-preview';
import { ValuationCharts } from '@/components/reports/module-charts';
import { UploadZone } from '@/components/documents/upload-zone';
import { useCompanyStore } from '@/stores/company-store';

interface Document {
  id: string;
  filename: string;
  extraction_status: string;
  extracted_data: Record<string, unknown> | null;
}

const VALUATION_SECTIONS = [
  'Financial Projection Highlights',
  'DCF Analysis — FCFF & Present Value',
  'Discount Rate / WACC Derivation',
  'Comparable Company Benchmarking',
  'Implied Multiples Cross-Check',
  'EV-to-Equity Bridge (Net Debt, DLOM, DLOC)',
  'Sensitivity Analysis (WACC vs Terminal Growth)',
  'Key Assumptions & Limitations',
];

const SUGGESTED_FILES = [
  'Audited financial statements (2-3 years)',
  'Financial projections (3-5 years)',
  'Management budget & forecasts',
  'Comparable company list',
  'Prior valuations or term sheets',
  'Cap table / shareholder register',
  'Industry market reports',
];

export default function ValuationPage({ params }: { params: Promise<{ id: string }> }) {
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
    return data && ('financial_data' in data);
  });
  const isReady = hasFinancialData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Valuation</h1>
            <p className="text-sm text-muted-foreground">
              Enterprise valuation — DCF, comparable companies, sensitivity analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isReady && (
            <>
              <GenerateReportDialog companyId={id} moduleType="valuation_report" moduleName="Valuation" onGenerated={loadData}>
                <Button variant="outline" size="sm" className="cursor-pointer gap-2"><FileText className="h-3.5 w-3.5" /> Generate Report</Button>
              </GenerateReportDialog>
              <Button variant={rightPanel === 'reports' ? 'secondary' : 'outline'} size="sm" className="cursor-pointer gap-2" onClick={() => openReports('valuation_report')}>
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
            <CardTitle className="text-base">
              {extractedDocs.length > 0 && !hasFinancialData
                ? 'Financial Statements Required'
                : 'Upload Valuation Materials'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {extractedDocs.length > 0 && !hasFinancialData
                ? 'Documents processed but no financial statements detected. Upload audited P&L, Balance Sheet, and Cash Flow to enable valuation.'
                : 'Drop your financial statements, projections, and comparable data. AI will auto-extract and build the valuation model.'}
            </p>
            <UploadZone companyId={id} suggestedFiles={SUGGESTED_FILES} documents={docs} onUploaded={loadData} />
          </CardContent>
        </Card>
      )}

      {!isReady && extractedDocs.length > 0 && !hasFinancialData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-amber-500" /> Partial Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {extractedDocs.length} document(s) extracted but financial data not found. Upload audited financial statements to proceed.
            </p>
          </CardContent>
        </Card>
      )}

      {isReady && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Financial Data Available
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Financial data extracted. Generate a Valuation Report for DCF analysis, comparable company multiples, and valuation reconciliation.
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
            </CardContent>
          </Card>

          <ValuationCharts />

          <SectionPreview
            companyId={id}
            reportType="valuation_report"
            sections={VALUATION_SECTIONS}
            icon={<BarChart3 className="h-4 w-4 text-primary/60 shrink-0" />}
          />

          <div className="flex gap-2">
            <GenerateReportDialog companyId={id} moduleType="valuation_report" moduleName="Valuation" onGenerated={loadData}>
              <Button variant="outline" className="cursor-pointer gap-2"><FileText className="h-4 w-4" /> Generate Report</Button>
            </GenerateReportDialog>
            <Button variant={rightPanel === 'reports' ? 'secondary' : 'outline'} className="cursor-pointer gap-2" onClick={() => openReports('valuation_report')}>
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
