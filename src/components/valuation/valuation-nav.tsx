'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, History, Landmark, MessagesSquare, Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Sub-navigation shared by the valuation pages (Eric 2026-10): the workpaper
 * itself, its version history, the confirmed historical figures it is built
 * on, counterparty Q&A, and the market-data check.
 */
export function ValuationNav({ companyId }: { companyId: string }) {
  const pathname = usePathname();
  const base = `/companies/${companyId}/valuation`;
  const items = [
    { href: base, label: 'Workpaper', icon: BarChart3 },
    { href: `${base}/versions`, label: 'Versions', icon: History },
    { href: `${base}/financials`, label: 'Historical figures', icon: Landmark },
    { href: `${base}/qa`, label: 'Counterparty Q&A', icon: MessagesSquare },
    { href: `${base}/market-data`, label: 'Market data', icon: Globe2 },
  ];
  return (
    <nav className="flex flex-wrap gap-1 border-b border-border/60 pb-px">
      {items.map((item) => {
        const active = item.href === base ? pathname === base : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors cursor-pointer',
              active
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ValuationPageHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof BarChart3;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight leading-none">{title}</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
