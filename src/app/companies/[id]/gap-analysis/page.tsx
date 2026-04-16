'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { GapAnalysisDashboard } from '@/components/reports/gap-analysis-dashboard';
import { useCompanyStore } from '@/stores/company-store';

interface Document {
  id: string;
  filename: string;
  extraction_status: string;
  extracted_data: Record<string, unknown> | null;
}

export default function GapAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { openReports } = useCompanyStore();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    openReports('gap_analysis');
  }, [openReports]);

  useEffect(() => {
    apiJson<Document[]>(`/companies/${id}/documents`)
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const extractedDocs = docs.filter(d => d.extraction_status === 'completed' && d.extracted_data);
  const isReady = extractedDocs.length > 0;

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

      {!isReady ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-1">No Documents Yet</p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
            Upload company documents in the Documents tab to get started. The AI will extract data and generate a gap analysis.
          </p>
        </div>
      ) : (
        <GapAnalysisDashboard companyId={id} />
      )}
    </div>
  );
}
