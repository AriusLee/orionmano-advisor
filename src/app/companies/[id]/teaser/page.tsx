'use client';

import { FileBarChart } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export default function TeaserPage() {
  return (
    <ComingSoon
      icon={FileBarChart}
      title="Teaser"
      tagline="Coming Soon"
      description="Concise 2-4 page investor teaser — highlighting company snapshot, investment thesis, key metrics, and transaction overview."
      features={[
        'Company snapshot with industry positioning',
        'Financial highlights and growth trajectory',
        'Transaction summary & use of proceeds',
        'MVPI-branded PDF with contact block',
      ]}
      status="In active development"
    />
  );
}
