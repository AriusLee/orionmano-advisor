'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { GapAnalysisDashboard } from '@/components/reports/gap-analysis-dashboard';
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
  'management_accounts',
  'cap_table',
  'company_profile',
];

const RECOMMENDED_DOCS = [
  'audit_report',
  'org_chart',
  'tax_return',
  'projections',
  'shareholder_agreement',
  'board_minutes',
];

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

  // Ready only when every Required category from the checklist has at least one received doc.
  const isReady = REQUIRED_DOCS.every((catId) =>
    docs.some((d) => d.extraction_status === 'completed' && (d.category || '').trim() === catId)
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

      {!isReady ? (
        <EmptyDataState
          icon={ClipboardCheck}
          title="Gap Analysis"
          tagline="Awaiting Documents"
          description="Upload the minimum set of corporate and financial documents — we'll auto-classify them and unlock your IPO readiness assessment. Missing items on the recommended list become findings."
          requiredCategories={REQUIRED_DOCS}
          recommendedCategories={RECOMMENDED_DOCS}
          documents={docs}
        />
      ) : (
        <GapAnalysisDashboard companyId={id} />
      )}
    </div>
  );
}
