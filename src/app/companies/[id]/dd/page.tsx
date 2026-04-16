'use client';

import { FileSearch } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export default function DDPage() {
  return (
    <ComingSoon
      icon={FileSearch}
      title="Due Diligence"
      tagline="Coming Soon"
      description="Financial DD assessment with AI-assisted analytical review, risk identification, and internal controls evaluation — built on the same agentic core as Gap Analysis."
      features={[
        'Analytical review of balance sheet, P&L, and cash flow',
        'Internal control & SOX readiness evaluation',
        'Legal, tax, and related-party exposure scan',
        'Evidence-backed findings with document citations',
      ]}
      status="In active development"
    />
  );
}
