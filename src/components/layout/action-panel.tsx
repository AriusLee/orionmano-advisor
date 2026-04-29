'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import {
  FileText,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Crown,
  Star,
  Zap,
  Plus,
  FolderOpen,
  ClipboardCheck,
  Globe,
  FileSearch,
  BarChart3,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { useCompanyStore } from '@/stores/company-store';
import { DocumentChecklist } from '@/components/documents/document-checklist';
import { apiJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ActionPanelProps {
  companyId: string;
}

interface ReportItem {
  id: string;
  report_type: string;
  title: string;
  status: string;
  created_at: string;
  tier?: string;
  progress_message?: string | null;
}

interface DocumentItem {
  id: string;
  filename: string;
  extraction_status: string;
  extracted_data: Record<string, unknown> | null;
  category?: string | null;
  categories?: string[] | null;
}

type ReportType = 'gap_analysis' | 'industry_report' | 'dd_report' | 'valuation_report';

interface ReportTypeConfig {
  id: ReportType;
  label: string;
  desc: string;
  icon: LucideIcon;
  accent: string;
  disabled?: boolean;
  /**
   * If set, clicking the row navigates to /companies/{id}{customRoute} instead
   * of triggering /reports/generate. Used for module pages that own their own
   * generation flow (e.g. valuation produces an xlsx workpaper, not a report row).
   */
  customRoute?: string;
}

const REPORT_TYPES: ReportTypeConfig[] = [
  { id: 'gap_analysis',    label: 'Gap Analysis',    desc: 'Nasdaq IPO readiness assessment',   icon: ClipboardCheck, accent: 'text-emerald-400' },
  { id: 'industry_report', label: 'Industry Expert', desc: 'Market research & competitive scan', icon: Globe,          accent: 'text-blue-400' },
  { id: 'dd_report',       label: 'Due Diligence',   desc: 'Transaction-grade FDD — QoE bridge, net debt, key findings', icon: FileSearch,     accent: 'text-amber-400' },
  { id: 'valuation_report',label: 'Valuation',       desc: 'DCF workpaper — WACC, comps & sensitivity (Excel)',  icon: BarChart3,      accent: 'text-purple-400', customRoute: '/valuation' },
];

const REPORT_TYPE_LABELS: Record<string, string> = REPORT_TYPES.reduce((acc, t) => ({ ...acc, [t.id]: t.label }), {});

const TIER_ICONS: Record<string, LucideIcon> = { essential: Zap, standard: Star, premium: Crown };
const TIER_LABELS: Record<string, string> = { essential: 'Essential', standard: 'Standard', premium: 'Premium' };
const TIER_COLORS: Record<string, string> = { essential: 'text-slate-500', standard: 'text-blue-500', premium: 'text-amber-500' };

const STATUS_CONFIG: Record<string, { color: string; label: string; animate?: boolean }> = {
  pending:    { color: 'bg-slate-500',   label: 'Pending' },
  generating: { color: 'bg-blue-500',    label: 'Generating', animate: true },
  draft:      { color: 'bg-amber-500',   label: 'Draft' },
  review:     { color: 'bg-purple-500',  label: 'In Review' },
  approved:   { color: 'bg-emerald-500', label: 'Approved' },
  failed:     { color: 'bg-red-500',     label: 'Failed' },
};

const HEADER_H = 'h-10';
const FOOTER_H = 'h-16';

type Tab = 'reports' | 'documents';

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ActionPanel({ companyId }: ActionPanelProps) {
  const { reportModuleFilter } = useCompanyStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('documents');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [docsLoaded, setDocsLoaded] = useState(false);
  const [showGenDialog, setShowGenDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [companyTier, setCompanyTier] = useState('standard');
  const [companyWebsite, setCompanyWebsite] = useState<string | null>(null);
  const [drillType, setDrillType] = useState<ReportType | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  const loadReports = useCallback(() => {
    apiJson<ReportItem[]>(`/companies/${companyId}/reports`)
      .then(setReports)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [companyId]);

  const loadDocs = useCallback(() => {
    apiJson<DocumentItem[]>(`/companies/${companyId}/documents`)
      .then((d) => {
        setDocs(d);
        setDocsLoaded(true);
      })
      .catch(() => setDocsLoaded(true));
  }, [companyId]);

  useEffect(() => {
    apiJson<{ report_tier: string; website: string | null }>(`/companies/${companyId}`)
      .then(c => {
        setCompanyTier(c.report_tier || 'standard');
        setCompanyWebsite(c.website || null);
      })
      .catch(() => {});
  }, [companyId]);

  useEffect(() => {
    loadReports();
    loadDocs();
    const interval = setInterval(() => { loadReports(); loadDocs(); }, 10000);
    return () => clearInterval(interval);
  }, [loadReports, loadDocs]);

  // Reset drill when tab changes
  useEffect(() => {
    if (activeTab !== 'reports') setDrillType(null);
  }, [activeTab]);

  const reportsByType = useMemo(() => {
    const sorted = [...reports].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const map = new Map<ReportType, ReportItem[]>();
    for (const type of REPORT_TYPES) {
      map.set(type.id, sorted.filter(r => r.report_type === type.id));
    }
    return map;
  }, [reports]);

  const handleGenerate = async (reportType: string) => {
    setGenerating(true);
    try {
      await apiJson(`/companies/${companyId}/reports/generate`, {
        method: 'POST',
        body: JSON.stringify({ report_type: reportType, tier: companyTier }),
      });
      toast.success(`Generating ${REPORT_TYPE_LABELS[reportType] || reportType}...`);
      setShowGenDialog(false);
      loadReports();
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteReport = async (reportId: string, label: string) => {
    if (!confirm(`Delete this ${label.toLowerCase()}? This cannot be undone.`)) return;
    setDeletingReportId(reportId);
    try {
      await apiJson(`/companies/${companyId}/reports/${reportId}`, { method: 'DELETE' });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      toast.success('Report deleted');
    } catch {
      toast.error('Failed to delete report');
    } finally {
      setDeletingReportId(null);
    }
  };

  const TierIcon = TIER_ICONS[companyTier] || Star;
  const drillConfig = drillType ? REPORT_TYPES.find(t => t.id === drillType) : null;
  const drillReports = drillType ? (reportsByType.get(drillType) ?? []) : [];

  return (
    <div className="relative h-full w-80 border-l bg-background xl:w-96">
      {/* ─── HEADER: Tab nav ─── */}
      <div className={cn('absolute top-0 left-0 right-0 z-10 flex border-b bg-background', HEADER_H)}>
        <button
          onClick={() => setActiveTab('reports')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors cursor-pointer border-b-2',
            activeTab === 'reports'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <FileText className="h-3.5 w-3.5" />
          Reports
          {reports.length > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium text-muted-foreground">
              {reports.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={cn(
            'relative flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors cursor-pointer border-b-2',
            activeTab === 'documents'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Documents
          {docs.length > 0 ? (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium text-muted-foreground">
              {docs.length}
            </span>
          ) : docsLoaded && (
            <span aria-label="No documents uploaded" className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
          )}
        </button>
      </div>

      {/* ─── BODY ─── */}
      <div className={cn('absolute left-0 right-0 overflow-hidden', `top-10 ${activeTab === 'reports' ? 'bottom-16' : 'bottom-0'}`)}>

        {/* Reports tab: two-pane slider (grouped → drill-down) */}
        {activeTab === 'reports' && (
          <div className="relative h-full">
            <div
              className={cn(
                'flex h-full w-[200%] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                drillType && '-translate-x-1/2'
              )}
            >
              {/* ── Pane 1: Grouped (latest per type) ── */}
              <div className="w-1/2 h-full overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {REPORT_TYPES.map((type) => {
                      const typeReports = reportsByType.get(type.id) ?? [];
                      const latest = typeReports[0];
                      const count = typeReports.length;
                      const TypeIcon = type.icon;
                      const statusCfg = latest ? STATUS_CONFIG[latest.status] || STATUS_CONFIG.draft : null;
                      const isGenerating = latest && (latest.status === 'generating' || latest.status === 'pending');
                      const tier = latest?.tier || 'standard';
                      const RptTierIcon = TIER_ICONS[tier] || Star;
                      const isDisabled = !!type.disabled;

                      return (
                        <div
                          key={type.id}
                          className={cn(
                            'group relative rounded-lg border border-border/40 bg-muted/10 overflow-hidden transition-colors',
                            isDisabled ? 'opacity-50' : 'hover:border-border/80 hover:bg-muted/20'
                          )}
                        >
                          {/* Left accent rail */}
                          <span aria-hidden className={cn('absolute left-0 top-0 bottom-0 w-[2px]', latest && !isDisabled ? type.accent.replace('text-', 'bg-') : 'bg-border')} />

                          <div className="flex items-stretch pl-3">
                            {/* Main click target (latest report OR empty) */}
                            <button
                              onClick={() => {
                                if (isDisabled) return;
                                if (type.customRoute) {
                                  router.push(`/companies/${companyId}${type.customRoute}`);
                                  return;
                                }
                                if (latest && !isGenerating) {
                                  router.push(`/companies/${companyId}/reports/${latest.id}`);
                                }
                              }}
                              disabled={isDisabled || (!type.customRoute && (!latest || isGenerating))}
                              className={cn(
                                'flex-1 flex items-start gap-3 px-2 py-2.5 text-left transition-colors',
                                isDisabled ? 'cursor-not-allowed' :
                                  type.customRoute ? 'cursor-pointer hover:bg-foreground/[0.03]' :
                                  latest && !isGenerating ? 'cursor-pointer hover:bg-foreground/[0.03]' : 'cursor-default'
                              )}
                            >
                              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/50 ring-1 ring-inset ring-border mt-0.5', isDisabled ? 'text-muted-foreground' : type.accent)}>
                                {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TypeIcon className="h-3.5 w-3.5" strokeWidth={2} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate">{type.label}</p>
                                  {isDisabled && (
                                    <span className="shrink-0 rounded-full border border-border/70 bg-muted/40 px-1.5 py-px text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                                      Soon
                                    </span>
                                  )}
                                </div>
                                {isDisabled ? (
                                  <p className="text-[11px] text-muted-foreground/60 mt-1">Coming soon</p>
                                ) : type.customRoute ? (
                                  <p className="text-[11px] text-muted-foreground/70 mt-1 truncate">{type.desc}</p>
                                ) : latest ? (
                                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                                    {statusCfg && (
                                      <span className="flex items-center gap-1">
                                        <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.color, statusCfg.animate && 'animate-pulse')} />
                                        {statusCfg.label}
                                      </span>
                                    )}
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className={cn('flex items-center gap-0.5', TIER_COLORS[tier])}>
                                      <RptTierIcon className="h-2.5 w-2.5" />
                                      {TIER_LABELS[tier]}
                                    </span>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="truncate">{formatRelativeDate(latest.created_at)}</span>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-muted-foreground/60 mt-1">No reports yet</p>
                                )}
                              </div>
                            </button>

                            {/* See all button (only if more than one, and not disabled) */}
                            {!isDisabled && count > 1 && (
                              <button
                                onClick={() => setDrillType(type.id)}
                                className="flex shrink-0 items-center gap-1 border-l border-border/40 px-3 text-[10px] font-medium text-muted-foreground transition-colors cursor-pointer hover:bg-foreground/[0.04] hover:text-foreground"
                              >
                                All
                                <span className="font-mono tabular-nums text-muted-foreground/70">{count}</span>
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Pane 2: Drill-down (all reports of selected type) ── */}
              <div className="w-1/2 h-full overflow-y-auto">
                {drillConfig && (
                  <>
                    {/* Sticky sub-header with back button */}
                    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-background/95 backdrop-blur-sm px-3 py-2">
                      <button
                        onClick={() => setDrillType(null)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors cursor-pointer hover:bg-muted hover:text-foreground"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted/50 ring-1 ring-inset ring-border', drillConfig.accent)}>
                        <drillConfig.icon className="h-3 w-3" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-none">{drillConfig.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{drillReports.length} report{drillReports.length === 1 ? '' : 's'}</p>
                      </div>
                    </div>

                    <div className="p-2 space-y-1">
                      {drillReports.map((report) => {
                        const statusCfg = STATUS_CONFIG[report.status] || STATUS_CONFIG.draft;
                        const isGenerating = report.status === 'generating' || report.status === 'pending';
                        const tier = report.tier || 'standard';
                        const RptTierIcon = TIER_ICONS[tier] || Star;
                        const isDeleting = deletingReportId === report.id;
                        const navigate = () => {
                          if (isGenerating || isDeleting) return;
                          router.push(`/companies/${companyId}/reports/${report.id}`);
                        };
                        return (
                          <div
                            key={report.id}
                            role="button"
                            tabIndex={isGenerating || isDeleting ? -1 : 0}
                            onClick={navigate}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                navigate();
                              }
                            }}
                            aria-disabled={isGenerating || isDeleting}
                            className={cn(
                              'w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors group',
                              isGenerating || isDeleting
                                ? 'opacity-70 cursor-wait'
                                : 'hover:bg-muted/50 cursor-pointer'
                            )}
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 ring-1 ring-inset ring-primary/20 mt-0.5">
                              {isGenerating ? <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" /> : <FileText className="h-3.5 w-3.5 text-primary" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={cn('flex items-center gap-1 text-xs font-medium', TIER_COLORS[tier])}>
                                  <RptTierIcon className="h-3 w-3" />
                                  {TIER_LABELS[tier]}
                                </span>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.color, statusCfg.animate && 'animate-pulse')} />
                                  {statusCfg.label}
                                </span>
                              </div>
                              {isGenerating && report.progress_message ? (
                                <p className="text-xs text-blue-400 mt-1 truncate">{report.progress_message}</p>
                              ) : (
                                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                                  {new Date(report.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteReport(report.id, drillConfig?.label ?? 'report');
                              }}
                              disabled={isDeleting}
                              aria-label="Delete report"
                              className={cn(
                                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition-all cursor-pointer',
                                'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                                'hover:bg-destructive/10 hover:text-destructive',
                                isDeleting && 'opacity-100'
                              )}
                            >
                              {isDeleting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Documents tab — auto-classifying checklist */}
        {activeTab === 'documents' && (
          <div className="p-3 h-full overflow-y-auto">
            <DocumentChecklist
              companyId={companyId}
              documents={docs}
              onChanged={loadDocs}
              companyWebsite={companyWebsite}
            />
          </div>
        )}
      </div>

      {/* ─── FOOTER ─── */}
      {activeTab === 'reports' && (
        <div className={cn('absolute bottom-0 left-0 right-0 z-10 border-t bg-background flex items-center px-3', FOOTER_H)}>
          <button
            onClick={() => setShowGenDialog(true)}
            className="group relative w-full h-11 flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm shadow-[0_4px_14px_-4px_oklch(from_var(--primary)_l_c_h_/_0.5),inset_0_1px_0_oklch(1_0_0/0.2)] transition-all duration-150 cursor-pointer hover:brightness-110 hover:shadow-[0_6px_20px_-4px_oklch(from_var(--primary)_l_c_h_/_0.6),inset_0_1px_0_oklch(1_0_0/0.25)] active:brightness-95 active:translate-y-px"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            <span>Generate Report</span>
          </button>
        </div>
      )}

      {/* ─── Generate Report Dialog ─── */}
      <Dialog open={showGenDialog} onOpenChange={setShowGenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {REPORT_TYPES.map((opt) => {
              const OptIcon = opt.icon;
              const isDisabled = !!opt.disabled;
              const handleClick = () => {
                if (isDisabled) return;
                if (opt.customRoute) {
                  setShowGenDialog(false);
                  router.push(`/companies/${companyId}${opt.customRoute}`);
                  return;
                }
                handleGenerate(opt.id);
              };
              return (
                <button
                  key={opt.id}
                  onClick={handleClick}
                  disabled={(generating && !opt.customRoute) || isDisabled}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                    isDisabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer hover:bg-muted/60',
                    reportModuleFilter === opt.id && !isDisabled && 'border-primary bg-primary/5',
                    generating && !isDisabled && 'opacity-50 cursor-wait'
                  )}
                >
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 ring-1 ring-inset ring-border', isDisabled ? 'text-muted-foreground' : opt.accent)}>
                    <OptIcon className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{opt.label}</p>
                      {isDisabled && (
                        <span className="shrink-0 rounded-full border border-border/70 bg-muted/40 px-1.5 py-px text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                          Soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                  {reportModuleFilter === opt.id && !isDisabled && (
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30">Current</Badge>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TierIcon className={cn('h-3.5 w-3.5', TIER_COLORS[companyTier])} />
              Tier: <span className="font-medium text-foreground">{TIER_LABELS[companyTier]}</span>
            </span>
            <span className="text-[10px] text-muted-foreground">Change in Settings</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
