'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Companies', href: '/companies', icon: Building2 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === href || pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside className={cn('flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground', className)}>
      {/* Logo */}
      <div className="flex h-14 items-center px-6">
        <div>
          <h1 className="text-lg font-bold tracking-wider">ORIONMANO</h1>
          <p className="mt-0.5 text-[9px] text-muted-foreground/60 tracking-[0.22em] uppercase">Assurance Services</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
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
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
