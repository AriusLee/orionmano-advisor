'use client';

import { FileSignature } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export default function EngagementLetterPage() {
  return (
    <ComingSoon
      icon={FileSignature}
      title="Engagement Letter"
      tagline="Coming Soon"
      description="MVPI engagement letter generation — scope, fees, deliverables, and terms drafted from the client's configured engagement profile."
      features={[
        'Structured scope & deliverables matrix',
        'Fee schedule with milestone billing',
        'Standard indemnity, confidentiality, and governing-law clauses',
        'Branded PDF with counter-signature block',
      ]}
      status="In active development"
    />
  );
}
