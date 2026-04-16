'use client';

import { BarChart3 } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export default function ValuationPage() {
  return (
    <ComingSoon
      icon={BarChart3}
      title="Valuation"
      tagline="Coming Soon"
      description="Enterprise valuation with DCF, comparable companies, and sensitivity analysis — wired to the same extracted financial data that powers Gap Analysis."
      features={[
        'DCF model with WACC derivation and terminal value',
        'Comparable-company multiples & implied cross-check',
        'EV-to-equity bridge (net debt, DLOM, DLOC)',
        'Sensitivity matrix over WACC × terminal growth',
      ]}
      status="In active development"
    />
  );
}
