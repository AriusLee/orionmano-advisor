'use client';

import { Presentation } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export default function DecksPage() {
  return (
    <ComingSoon
      icon={Presentation}
      title="Decks"
      tagline="Coming Soon"
      description="Branded presentation decks — sales, kick-off, and investor presentations — generated from company data with MVPI branding."
      features={[
        'Sales deck for prospective engagements',
        'Kick-off meeting deck with scope & timeline',
        'Full investor presentation (25-35 slides)',
        'One-click PDF export with consistent branding',
      ]}
      status="In active development"
    />
  );
}
