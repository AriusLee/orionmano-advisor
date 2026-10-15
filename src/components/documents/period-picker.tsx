'use client';

import { useEffect, useId, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PeriodOption {
  label: string;
  locked: boolean;
}

/**
 * "This upload is for period …" (Eric 2026-10). Tagging an upload to a period
 * means extraction only updates that period; any other periods the document
 * shows as comparatives are checked against what we hold and never written.
 * Free text with suggestions: FY2025, H1_2026 … Empty = no specific period.
 */
export function PeriodPicker({
  companyId,
  value,
  onChange,
  className,
  compact = false,
}: {
  companyId: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const listId = useId();
  const [options, setOptions] = useState<PeriodOption[]>([]);

  useEffect(() => {
    apiJson<PeriodOption[]>(`/companies/${companyId}/financials/period-options`)
      .then(setOptions)
      .catch(() => setOptions([]));
  }, [companyId]);

  // Suggest the next fiscal year too, so a new year's accounts can be tagged
  // before that period exists.
  const years = options.map((o) => Number(o.label.match(/\d{4}/)?.[0])).filter(Boolean);
  const next = years.length ? `FY${Math.max(...years) + 1}` : `FY${new Date().getFullYear()}`;
  const suggestions = [...new Set([next, ...options.map((o) => o.label)])];
  const locked = options.find((o) => o.label.toUpperCase() === value.trim().toUpperCase())?.locked;

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      onClick={(e) => e.stopPropagation()}
    >
      <CalendarRange className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {!compact && <span className="shrink-0 text-[11px] text-muted-foreground">Financials for period</span>}
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Any (e.g. FY2025)"
        className="h-7 w-32 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary/60"
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {locked && (
        <span className="shrink-0 text-[10px] text-amber-400" title="This period is locked — differences will be flagged for review, not applied">
          locked
        </span>
      )}
    </div>
  );
}
