'use client';

import { Megaphone } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export default function IrReleasesPage() {
  return (
    <ComingSoon
      icon={Megaphone}
      title="IR Releases"
      tagline="Coming Soon"
      description="Investor relations announcements and press releases — drafted from financial events, operational updates, and milestone triggers with MVPI branding."
      features={[
        'Templated release formats (results, milestones, transactions)',
        'Tone & disclosure guardrails per listing venue',
        'One-click export to PDF and distribution-ready HTML',
        'Version history and approval workflow',
      ]}
      status="In active development"
    />
  );
}
