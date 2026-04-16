'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  LayoutDashboard,
  Upload,
  FileText,
  Globe,
  ClipboardCheck,
  FileSearch,
  BarChart3,
  FileBarChart,
  Presentation,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompanySidebarProps {
  companyId: string;
  className?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

function getNavSections(companyId: string): NavSection[] {
  const base = `/companies/${companyId}`;
  return [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', href: base, icon: LayoutDashboard },
      ],
    },
    {
      title: 'Advisory Modules',
      items: [
        { label: 'Gap Analysis', href: `${base}/gap-analysis`, icon: ClipboardCheck },
        { label: 'Industry Expert', href: `${base}/industry`, icon: Globe },
        { label: 'Due Diligence', href: `${base}/dd`, icon: FileSearch },
        { label: 'Valuation', href: `${base}/valuation`, icon: BarChart3 },
      ],
    },
    {
      title: 'Data',
      items: [
        { label: 'Documents', href: `${base}/documents`, icon: Upload },
        { label: 'Decks & Materials', href: `${base}/decks`, icon: Presentation },
        { label: 'Company Teaser', href: `${base}/teaser`, icon: FileBarChart },
      ],
    },
    {
      items: [
        { label: 'Settings', href: `${base}/settings`, icon: Settings },
      ],
    },
  ];
}

export function CompanySidebar({ companyId, className }: CompanySidebarProps) {
  const pathname = usePathname();
  const navSections = getNavSections(companyId);

  function isActive(href: string) {
    if (href === `/companies/${companyId}`) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={cn(
        'flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground',
        className
      )}
    >
      {/* Back link */}
      <div className="flex h-14 items-center px-4">
        <Link
          href="/companies"
          className="cursor-pointer flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All Companies
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {navSections.map((section, sIdx) => (
          <div key={sIdx}>
            {section.title && (
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                {section.title}
              </p>
            )}
            {!section.title && sIdx > 0 && (
              <div className="my-2 border-t border-sidebar-border" />
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full transition-all',
                        active ? 'bg-primary opacity-100' : 'bg-primary opacity-0 group-hover:opacity-40'
                      )}
                    />
                    <item.icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        active ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground'
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
