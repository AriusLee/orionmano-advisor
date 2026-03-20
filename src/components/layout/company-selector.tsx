'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Building2, Plus, Check } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Company {
  id: string;
  name: string;
  industry: string | null;
}

interface CompanySelectorProps {
  companyId: string;
  companyName?: string;
}

export function CompanySelector({ companyId, companyName }: CompanySelectorProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user) {
      apiJson<Company[]>('/companies').then(setCompanies).catch(() => {});
    }
  }, [user]);

  const handleSelect = (id: string) => {
    setOpen(false);
    router.push(`/companies/${id}`);
  };

  return (
    <>
      <span className="text-muted-foreground/50">/</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
          {companyName || 'Select Company'}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1">
          <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Switch Company</p>
          <div className="my-1 h-px bg-border" />
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors cursor-pointer',
                c.id === companyId ? 'bg-accent' : 'hover:bg-accent/50'
              )}
            >
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.name}</p>
                {c.industry && <p className="text-xs text-muted-foreground truncate">{c.industry}</p>}
              </div>
              {c.id === companyId && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>
          ))}
          <div className="my-1 h-px bg-border" />
          <button
            onClick={() => { setOpen(false); router.push('/companies/new'); }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">New Company</span>
          </button>
        </PopoverContent>
      </Popover>
    </>
  );
}
