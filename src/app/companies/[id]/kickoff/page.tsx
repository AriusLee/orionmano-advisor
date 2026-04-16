'use client';

import { Rocket } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export default function KickoffPage() {
  return (
    <ComingSoon
      icon={Rocket}
      title="Kick-Off"
      tagline="Coming Soon"
      description="Engagement kick-off materials — scope alignment, timeline, team introductions, and information request list auto-populated from company data."
      features={[
        'Auto-generated scope & deliverables summary',
        'Timeline with milestone checkpoints',
        'Information request checklist',
        'Branded kick-off deck export',
      ]}
      status="In active development"
    />
  );
}
