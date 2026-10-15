/** Number formatting shared by the valuation pages. */

export function fmtMoney(v: number | null | undefined, currency?: string | null, unit?: string | null): string {
  if (v == null || Number.isNaN(v)) return '—';
  const n = v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return [currency, n, unit].filter(Boolean).join(' ');
}

export function fmtNumber(v: number | null | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPct(v: number | null | undefined, digits = 1, signed = false): string {
  if (v == null || Number.isNaN(v)) return '—';
  const s = (v * 100).toFixed(digits);
  return `${signed && v > 0 ? '+' : ''}${s}%`;
}

export function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

/** "−4.4%" style change, coloured by the caller. */
export function changeTone(v: number | null | undefined): string {
  if (v == null || Math.abs(v) < 0.0005) return 'text-muted-foreground';
  return v > 0 ? 'text-emerald-400' : 'text-rose-400';
}
