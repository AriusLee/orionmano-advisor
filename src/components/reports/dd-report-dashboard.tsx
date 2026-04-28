'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { apiJson } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard, splitMetricValue } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';
import {
  Loader2,
  TrendingDown,
  TrendingUp,
  Banknote,
  Scale,
  Activity,
  AlertOctagon,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// ────────────────────────────────────────────────────────
// types
// ────────────────────────────────────────────────────────

interface ReportSection {
  section_key: string;
  section_title: string;
  content: string | null;
}

interface Report {
  id: string;
  report_type: string;
  status: string;
  tier?: string;
  sections: ReportSection[];
}

interface HeadlineMetric {
  label: string;
  value: string;
  basis?: string;
  isInfoRequired: boolean;
}

interface MatterItem {
  title: string;
  body: string;
}

type Priority = 'deal_breaker' | 'price_impacting' | 'informational';

interface Matters {
  deal_breaker: MatterItem[];
  price_impacting: MatterItem[];
  informational: MatterItem[];
}

interface QoEAdjustment {
  description: string;
  bucket: string;
  bucketNum: number | null; // 1..5 or null for headers/totals
  managementProposed: string;
  orionmanoValidated: string;
  source: string;
  comment: string;
  isReported: boolean;
  isAdjusted: boolean;
}

interface NetDebtItem {
  description: string;
  amount: string;
  source: string;
  comment: string;
  isSubtotal: boolean;
  isTotal: boolean;
  isHeader: boolean; // "Plus debt-like items:" header rows
}

interface Finding {
  num: string;
  priority: Priority;
  finding: string;
  analysis: string;
  managementResponse: string;
  suggestion: string;
}

// ────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────

const stripBold = (s: string) => s.replace(/\*\*/g, '').trim();
const isInfoReq = (s: string) => /information required/i.test(s);

function getSection(report: Report | null, key: string): string {
  if (!report) return '';
  return report.sections.find((s) => s.section_key === key)?.content ?? '';
}

// ────────────────────────────────────────────────────────
// parsers
// ────────────────────────────────────────────────────────

/** Parse the headline-numbers markdown table inside the executive_summary section. */
function parseHeadlineNumbers(content: string): HeadlineMetric[] {
  const out: HeadlineMetric[] = [];
  if (!content) return out;

  // Locate the headline-numbers table — look for a metric+value+basis row pattern after "Headline Numbers"
  const headStart = content.toLowerCase().indexOf('headline numbers');
  const slice = headStart >= 0 ? content.slice(headStart) : content;
  const lines = slice.split('\n');

  let inTable = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('|')) {
      if (inTable) break; // table ended
      continue;
    }
    if (line.includes(':---') || line.includes('---')) continue;

    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;

    const label = stripBold(cells[0]);
    if (!label || /^metric$/i.test(label)) {
      inTable = true;
      continue;
    }
    if (!inTable) inTable = true;

    const value = stripBold(cells[1] ?? '');
    const basis = stripBold(cells[2] ?? '');

    out.push({
      label,
      value,
      basis,
      isInfoRequired: isInfoReq(value),
    });
  }
  return out;
}

/** Parse the "Matters for Buyer Attention" subsection. */
function parseMatters(content: string): Matters {
  const result: Matters = { deal_breaker: [], price_impacting: [], informational: [] };
  if (!content) return result;

  const lower = content.toLowerCase();
  const start = lower.indexOf('matters for buyer attention');
  if (start === -1) return result;

  // Stop at the next top-level section after Matters
  let end = lower.indexOf('## 4', start);
  if (end === -1) end = lower.indexOf('recommended next-step', start);
  if (end === -1) end = content.length;
  const block = content.slice(start, end);

  let current: Priority | null = null;
  let pending: MatterItem | null = null;

  const flush = () => {
    if (pending && current) result[current].push(pending);
    pending = null;
  };

  for (const raw of block.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    // Sub-heading (priority bucket)
    const headMatch = line.match(/^#{2,4}\s*(.+)$/);
    if (headMatch) {
      const head = headMatch[1].toLowerCase();
      if (head.includes('deal-breaker') || head.includes('deal breaker')) {
        flush();
        current = 'deal_breaker';
        continue;
      }
      if (head.includes('price-impacting') || head.includes('price impacting')) {
        flush();
        current = 'price_impacting';
        continue;
      }
      if (head.includes('informational')) {
        flush();
        current = 'informational';
        continue;
      }
      if (head.includes('matters for')) continue;
      // Other heading — close current bullet
      continue;
    }

    if (!current) continue;

    // Numbered bullet "1. **Title**" begins a new item
    const numbered = line.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?\s*$/);
    if (numbered) {
      flush();
      pending = { title: stripBold(numbered[1]), body: '' };
      continue;
    }

    // Continuation lines / sub-bullets append to body
    if (pending) {
      pending.body += (pending.body ? '\n' : '') + line.replace(/^-\s+/, '');
    }
  }
  flush();
  return result;
}

/** Parse the QoE bridge dual-column table. */
function parseQoEBridge(content: string): QoEAdjustment[] {
  const out: QoEAdjustment[] = [];
  if (!content) return out;
  const lines = content.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('|')) continue;
    if (line.includes(':---') || line.includes('---|')) continue;

    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    // Expected columns: Adjustment | Bucket | Mgmt | Validated | Source | Comment
    if (cells.length < 4) continue;

    const desc = stripBold(cells[0]);
    if (!desc || /^adjustment$/i.test(desc)) continue;

    const bucket = stripBold(cells[1] ?? '');
    const mgmt = stripBold(cells[2] ?? '');
    const validated = stripBold(cells[3] ?? '');
    const source = stripBold(cells[4] ?? '');
    const comment = stripBold(cells[5] ?? '');

    const bucketMatch = bucket.match(/\((\d)\)/);
    const bucketNum = bucketMatch ? parseInt(bucketMatch[1], 10) : null;

    const isReported = /^reported ebitda/i.test(desc) || desc.toLowerCase().includes('reported ebitda');
    const isAdjusted = /^adjusted ebitda/i.test(desc) || desc.toLowerCase().includes('adjusted ebitda');

    out.push({
      description: desc,
      bucket,
      bucketNum,
      managementProposed: mgmt,
      orionmanoValidated: validated,
      source,
      comment,
      isReported,
      isAdjusted,
    });
  }
  return out;
}

/** Parse the Net Debt + Debt-Like Items schedule table. */
function parseNetDebt(content: string): NetDebtItem[] {
  const out: NetDebtItem[] = [];
  if (!content) return out;
  const lines = content.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('|')) continue;
    if (line.includes(':---') || line.includes('---|')) continue;

    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;

    const description = stripBold(cells[0]);
    if (!description || /^item$/i.test(description)) continue;

    const amount = stripBold(cells[1] ?? '');
    const source = stripBold(cells[2] ?? '');
    const comment = stripBold(cells[3] ?? '');

    const lower = description.toLowerCase();
    const isHeader = /plus debt-like items|debt-like items:$/i.test(description) && !amount;
    const isSubtotal = /sub-total|subtotal/i.test(lower);
    const isTotal = /^total/i.test(lower) || /total net debt/i.test(lower);

    out.push({
      description,
      amount,
      source,
      comment,
      isSubtotal,
      isTotal,
      isHeader,
    });
  }
  return out;
}

/** Parse Key Findings table. */
function parseKeyFindings(content: string): Finding[] {
  const out: Finding[] = [];
  if (!content) return out;
  const lines = content.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('|')) continue;
    if (line.includes(':---') || line.includes('---|')) continue;

    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length < 5) continue;

    const num = stripBold(cells[0]);
    if (!num || num === '#' || /priority/i.test(num)) continue;

    const priorityCell = stripBold(cells[1]).toLowerCase();
    let priority: Priority = 'informational';
    if (priorityCell.includes('deal-breaker') || priorityCell.includes('deal breaker')) priority = 'deal_breaker';
    else if (priorityCell.includes('price-impacting') || priorityCell.includes('price impacting')) priority = 'price_impacting';

    out.push({
      num,
      priority,
      finding: stripBold(cells[2] ?? ''),
      analysis: stripBold(cells[3] ?? ''),
      managementResponse: stripBold(cells[4] ?? ''),
      suggestion: stripBold(cells[5] ?? ''),
    });
  }
  return out;
}

// ────────────────────────────────────────────────────────
// stat card mapping for headline metrics
// ────────────────────────────────────────────────────────

interface StatMapping {
  pattern: RegExp;
  icon: typeof TrendingDown;
  tone: 'primary' | 'positive' | 'warn' | 'danger' | 'muted';
  shortLabel?: string;
}

const STAT_MAPPINGS: StatMapping[] = [
  { pattern: /reported ebitda/i, icon: Activity, tone: 'muted', shortLabel: 'Reported EBITDA' },
  { pattern: /adjusted ebitda/i, icon: TrendingUp, tone: 'primary', shortLabel: 'Adjusted EBITDA' },
  { pattern: /net debt/i, icon: Banknote, tone: 'warn', shortLabel: 'Net Debt + DLI' },
  { pattern: /nwc peg|working capital peg/i, icon: Scale, tone: 'primary', shortLabel: 'NWC Peg' },
  { pattern: /qoe.*ratio|adjustment.*ratio/i, icon: TrendingDown, tone: 'muted', shortLabel: 'QoE Ratio' },
  { pattern: /reported net loss|net loss/i, icon: TrendingDown, tone: 'danger', shortLabel: 'Reported Net Loss' },
  { pattern: /revenue/i, icon: Activity, tone: 'muted', shortLabel: 'Revenue' },
];

function pickStatStyle(label: string): StatMapping {
  for (const m of STAT_MAPPINGS) if (m.pattern.test(label)) return m;
  return { pattern: /./, icon: Activity, tone: 'muted' };
}

// ────────────────────────────────────────────────────────
// sub-widgets
// ────────────────────────────────────────────────────────

function HeadlineStats({ metrics }: { metrics: HeadlineMetric[] }) {
  if (!metrics.length) return null;
  // Cap to first 5 for layout reasons
  const items = metrics.slice(0, 5);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((m, i) => {
        const style = pickStatStyle(m.label);
        const split = splitMetricValue(m.value);
        const tone = m.isInfoRequired ? 'muted' : style.tone;
        const displayLabel = style.shortLabel ?? m.label;
        const displayValue = m.isInfoRequired ? 'Info Required' : split.value;
        const subValue = m.isInfoRequired ? undefined : split.subValue;
        return (
          <StatCard
            key={i}
            label={displayLabel}
            value={displayValue}
            subValue={subValue}
            icon={style.icon}
            tone={tone}
            caption={m.isInfoRequired ? <span className="text-amber-400/90">Awaiting source data</span> : null}
          />
        );
      })}
    </div>
  );
}

const PRIORITY_META: Record<Priority, { label: string; tone: string; icon: typeof AlertOctagon; ring: string; bg: string; iconColor: string }> = {
  deal_breaker: {
    label: 'Deal-breaker',
    tone: 'rose',
    icon: AlertOctagon,
    ring: 'ring-rose-500/30',
    bg: 'bg-rose-500/[0.07]',
    iconColor: 'text-rose-400',
  },
  price_impacting: {
    label: 'Price-impacting',
    tone: 'amber',
    icon: AlertTriangle,
    ring: 'ring-amber-500/30',
    bg: 'bg-amber-500/[0.07]',
    iconColor: 'text-amber-400',
  },
  informational: {
    label: 'Informational',
    tone: 'sky',
    icon: Info,
    ring: 'ring-sky-500/30',
    bg: 'bg-sky-500/[0.07]',
    iconColor: 'text-sky-400',
  },
};

function MattersWidget({ matters }: { matters: Matters }) {
  const total = matters.deal_breaker.length + matters.price_impacting.length + matters.informational.length;
  if (total === 0) return null;

  const sections: Array<{ key: Priority; items: MatterItem[] }> = [
    { key: 'deal_breaker', items: matters.deal_breaker },
    { key: 'price_impacting', items: matters.price_impacting },
    { key: 'informational', items: matters.informational },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Matters for Buyer Attention</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {sections.map(({ key, items }) => {
          if (items.length === 0) return null;
          const meta = PRIORITY_META[key];
          const Icon = meta.icon;
          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md ring-1 ring-inset', meta.bg, meta.ring)}>
                  <Icon className={cn('h-3.5 w-3.5', meta.iconColor)} strokeWidth={2.25} />
                </span>
                <h4 className="text-sm font-medium tracking-tight">
                  {meta.label}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{items.length}</span>
                </h4>
              </div>
              <ul className="space-y-2 pl-1">
                {items.map((it, i) => (
                  <li
                    key={i}
                    className={cn('rounded-lg border border-border/60 px-3 py-2.5 text-sm', meta.bg)}
                  >
                    <div className="font-medium text-foreground/95">{it.title}</div>
                    {it.body && (
                      <div className="mt-1 line-clamp-3 text-xs text-muted-foreground">{it.body}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

const BUCKET_META: Record<number, { label: string; color: string }> = {
  1: { label: 'Non-recurring', color: 'bg-rose-500/15 text-rose-300 ring-rose-500/30' },
  2: { label: 'Owner comp', color: 'bg-amber-500/15 text-amber-300 ring-amber-500/30' },
  3: { label: 'Run-rate', color: 'bg-sky-500/15 text-sky-300 ring-sky-500/30' },
  4: { label: 'Pro forma', color: 'bg-violet-500/15 text-violet-300 ring-violet-500/30' },
  5: { label: 'Accounting', color: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' },
};

function BucketBadge({ num, label }: { num: number | null; label: string }) {
  if (num === null) return <span className="text-xs text-muted-foreground">—</span>;
  const meta = BUCKET_META[num];
  if (!meta) return <span className="text-xs text-muted-foreground">{label}</span>;
  return (
    <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ring-1 ring-inset', meta.color)}>
      ({num}) {meta.label}
    </span>
  );
}

function isRejected(comment: string): boolean {
  return /^rejected/i.test(comment.trim());
}

function isModified(comment: string): boolean {
  return /validation reduces|validation increases|reduces amount|partial/i.test(comment);
}

function QoEBridgeWidget({ rows }: { rows: QoEAdjustment[] }) {
  if (rows.length === 0) return null;

  const adjustmentRows = rows.filter((r) => !r.isReported && !r.isAdjusted);
  const reported = rows.find((r) => r.isReported);
  const adjusted = rows.find((r) => r.isAdjusted);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quality of Earnings — Adjusted EBITDA Bridge</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Dual-column reconciliation: management-proposed vs Orionmano-validated
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <th className="pb-2.5 pr-3 font-semibold">Adjustment</th>
                <th className="pb-2.5 pr-3 font-semibold">Bucket</th>
                <th className="pb-2.5 pr-3 text-right font-semibold">Management</th>
                <th className="pb-2.5 pr-3 text-right font-semibold">Validated</th>
                <th className="pb-2.5 font-semibold">Treatment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {reported && (
                <tr className="bg-muted/20">
                  <td className="py-2.5 pr-3 font-medium">{reported.description}</td>
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground">—</td>
                  <td className="py-2.5 pr-3 text-right font-numeric">{reported.managementProposed}</td>
                  <td className="py-2.5 pr-3 text-right font-numeric">{reported.orionmanoValidated}</td>
                  <td className="py-2.5 text-xs text-muted-foreground">Starting point</td>
                </tr>
              )}
              {adjustmentRows.map((r, i) => {
                const rejected = isRejected(r.comment);
                const modified = isModified(r.comment);
                return (
                  <tr key={i} className="hover:bg-muted/15">
                    <td className="py-2.5 pr-3 align-top">
                      <div className="font-medium text-foreground/95">{r.description}</div>
                      {r.source && (
                        <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{r.source}</div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 align-top">
                      <BucketBadge num={r.bucketNum} label={r.bucket} />
                    </td>
                    <td className="py-2.5 pr-3 text-right align-top font-numeric text-foreground/85">
                      {r.managementProposed}
                    </td>
                    <td
                      className={cn(
                        'py-2.5 pr-3 text-right align-top font-numeric font-medium',
                        rejected ? 'text-rose-300/90 line-through' : modified ? 'text-amber-300' : 'text-emerald-300/90',
                      )}
                    >
                      {r.orionmanoValidated}
                    </td>
                    <td className="py-2.5 align-top">
                      {rejected ? (
                        <span className="inline-flex items-center rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-300 ring-1 ring-inset ring-rose-500/30">
                          Rejected
                        </span>
                      ) : modified ? (
                        <span className="inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300 ring-1 ring-inset ring-amber-500/30">
                          Modified
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
                          Accepted
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {adjusted && (
                <tr className="border-t-2 border-border bg-primary/5">
                  <td className="py-3 pr-3 font-semibold">{adjusted.description}</td>
                  <td className="py-3 pr-3 text-xs text-muted-foreground">—</td>
                  <td className="py-3 pr-3 text-right font-numeric font-semibold">{adjusted.managementProposed}</td>
                  <td className="py-3 pr-3 text-right font-numeric font-semibold text-primary">
                    {adjusted.orionmanoValidated}
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">Validated total</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
          <span className="font-medium uppercase tracking-wider">Buckets:</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <BucketBadge key={n} num={n} label={BUCKET_META[n].label} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NetDebtWidget({ rows }: { rows: NetDebtItem[] }) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Net Debt + Debt-Like Items</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Schedule for purchase-price mechanism: Equity Value = EV − Net Debt + (NWC − Peg)
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <th className="pb-2.5 pr-3 font-semibold">Item</th>
                <th className="pb-2.5 pr-3 text-right font-semibold">Amount</th>
                <th className="pb-2.5 font-semibold">Buyer Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((r, i) => {
                if (r.isHeader) {
                  return (
                    <tr key={i}>
                      <td colSpan={3} className="pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {r.description}
                      </td>
                    </tr>
                  );
                }
                const rowClass = r.isTotal
                  ? 'bg-primary/5 font-semibold border-t-2 border-border'
                  : r.isSubtotal
                    ? 'bg-muted/20 font-medium'
                    : 'hover:bg-muted/15';
                const amountClass = r.isTotal
                  ? 'font-numeric font-semibold text-primary'
                  : r.isSubtotal
                    ? 'font-numeric font-medium'
                    : 'font-numeric';
                return (
                  <tr key={i} className={rowClass}>
                    <td className="py-2.5 pr-3 align-top">
                      <div className={cn(r.isTotal || r.isSubtotal ? 'font-medium' : '', 'text-foreground/95')}>
                        {r.description}
                      </div>
                      {r.source && !r.isTotal && !r.isSubtotal && (
                        <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{r.source}</div>
                      )}
                    </td>
                    <td className={cn('py-2.5 pr-3 text-right align-top', amountClass)}>{r.amount}</td>
                    <td className="py-2.5 align-top text-xs text-muted-foreground line-clamp-2">{r.comment}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function FindingsWidget({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return null;

  const grouped: Record<Priority, Finding[]> = {
    deal_breaker: findings.filter((f) => f.priority === 'deal_breaker'),
    price_impacting: findings.filter((f) => f.priority === 'price_impacting'),
    informational: findings.filter((f) => f.priority === 'informational'),
  };

  const sections: Array<{ key: Priority; items: Finding[] }> = [
    { key: 'deal_breaker', items: grouped.deal_breaker },
    { key: 'price_impacting', items: grouped.price_impacting },
    { key: 'informational', items: grouped.informational },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Key Findings</CardTitle>
          <div className="flex items-center gap-3 text-[11px]">
            {sections.map(({ key, items }) => {
              if (items.length === 0) return null;
              const meta = PRIORITY_META[key];
              return (
                <span key={key} className="flex items-center gap-1">
                  <span className={cn('h-1.5 w-1.5 rounded-full', meta.iconColor.replace('text-', 'bg-'))} />
                  <span className="text-muted-foreground">{meta.label}</span>
                  <span className="font-medium text-foreground">{items.length}</span>
                </span>
              );
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {sections.map(({ key, items }) => {
          if (items.length === 0) return null;
          const meta = PRIORITY_META[key];
          const Icon = meta.icon;
          return (
            <div key={key} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md ring-1 ring-inset', meta.bg, meta.ring)}>
                  <Icon className={cn('h-3.5 w-3.5', meta.iconColor)} strokeWidth={2.25} />
                </span>
                <h4 className="text-sm font-medium tracking-tight">{meta.label}</h4>
              </div>
              <div className="space-y-2.5">
                {items.map((f, i) => (
                  <FindingCard key={i} finding={f} meta={meta} />
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function FindingCard({ finding, meta }: { finding: Finding; meta: (typeof PRIORITY_META)[Priority] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('rounded-lg border border-border/60', meta.bg)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-3.5 py-3 text-left cursor-pointer"
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-background/60 text-[11px] font-semibold text-muted-foreground ring-1 ring-inset ring-border/60">
            {finding.num}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium leading-snug text-foreground/95">{finding.finding}</div>
            {!open && (
              <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{finding.analysis}</div>
            )}
          </div>
        </div>
        <span className="text-muted-foreground/70 flex-shrink-0">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="border-t border-border/40 px-3.5 py-3 space-y-3 text-xs">
          {finding.analysis && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Analysis</div>
              <div className="text-foreground/85 leading-relaxed">{finding.analysis}</div>
            </div>
          )}
          {finding.managementResponse && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Management Response</div>
              <div className="text-foreground/85 leading-relaxed">{finding.managementResponse}</div>
            </div>
          )}
          {finding.suggestion && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Actionable Suggestion</div>
              <div className="text-foreground/85 leading-relaxed">{finding.suggestion}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// main dashboard
// ────────────────────────────────────────────────────────

interface Props {
  companyId: string;
  reportId?: string; // optional override; defaults to latest dd_report
}

export function DDReportDashboard({ companyId, reportId }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      let targetId = reportId;
      if (!targetId) {
        const list = await apiJson<Array<{ id: string; report_type: string; status: string; created_at: string }>>(
          `/companies/${companyId}/reports`,
        );
        const candidates = list
          .filter((r) => r.report_type === 'dd_report' && (r.status === 'draft' || r.status === 'approved'))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        if (candidates.length === 0) {
          setError('No DD report found.');
          return;
        }
        targetId = candidates[0].id;
      }
      const full = await apiJson<Report>(`/companies/${companyId}/reports/${targetId}`);
      setReport(full);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [companyId, reportId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const headlineMetrics = useMemo(
    () => parseHeadlineNumbers(getSection(report, 'executive_summary')),
    [report],
  );
  const matters = useMemo(
    () => parseMatters(getSection(report, 'executive_summary')),
    [report],
  );
  const qoeRows = useMemo(
    () => parseQoEBridge(getSection(report, 'qoe_bridge')),
    [report],
  );
  const netDebtRows = useMemo(
    () => parseNetDebt(getSection(report, 'net_debt') || getSection(report, 'net_debt_nwc')),
    [report],
  );
  const findings = useMemo(
    () => parseKeyFindings(getSection(report, 'key_findings')),
    [report],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {error ?? 'No DD report available.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {headlineMetrics.length > 0 && <HeadlineStats metrics={headlineMetrics} />}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          {qoeRows.length > 0 && <QoEBridgeWidget rows={qoeRows} />}
          {netDebtRows.length > 0 && <NetDebtWidget rows={netDebtRows} />}
        </div>
        <div className="lg:col-span-2 space-y-6">
          <MattersWidget matters={matters} />
          <FindingsWidget findings={findings} />
        </div>
      </div>

    </div>
  );
}
