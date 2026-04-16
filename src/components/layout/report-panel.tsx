'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import { X, FileText, Loader2, ChevronRight, Crown, Star, Zap, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCompanyStore } from '@/stores/company-store';
import { GenerateReportDialog } from '@/components/reports/generate-report-dialog';
import { apiJson } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ReportPanelProps {
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

const REPORT_TYPE_LABELS: Record<string, string> = {
  industry_report: 'Industry Expert Report',
  dd_report: 'Due Diligence Report',
  valuation_report: 'Valuation Report',
  sales_deck: 'Sales Deck',
  kickoff_deck: 'Kick-off Deck',
  teaser: 'Company Teaser',
  company_deck: 'Company Deck',
};

const MODULE_SHORT_LABELS: Record<string, string> = {
  industry_report: 'Industry Expert',
  dd_report: 'Due Diligence',
  valuation_report: 'Valuation',
  teaser: 'Company Teaser',
};

const TIER_ICONS: Record<string, typeof Star> = { essential: Zap, standard: Star, premium: Crown };
const TIER_LABELS: Record<string, string> = { essential: 'Essential', standard: 'Standard', premium: 'Premium' };
const TIER_COLORS: Record<string, string> = { essential: 'text-slate-500', standard: 'text-blue-500', premium: 'text-amber-500' };

const STATUS_CONFIG: Record<string, { color: string; label: string; animate?: boolean }> = {
  pending: { color: 'bg-slate-500', label: 'Pending' },
  generating: { color: 'bg-blue-500', label: 'Generating', animate: true },
  draft: { color: 'bg-amber-500', label: 'Draft' },
  review: { color: 'bg-purple-500', label: 'In Review' },
  approved: { color: 'bg-emerald-500', label: 'Approved' },
  failed: { color: 'bg-red-500', label: 'Failed' },
};

const TIER_FILTER_OPTIONS = [
  { id: null, label: 'All' },
  { id: 'essential', label: 'Essential', icon: Zap, color: 'text-slate-500' },
  { id: 'standard', label: 'Standard', icon: Star, color: 'text-blue-500' },
  { id: 'premium', label: 'Premium', icon: Crown, color: 'text-amber-500' },
] as const;

export function ReportPanel({ companyId }: ReportPanelProps) {
  const { closeReports, reportModuleFilter, reportTierFilter, setReportTierFilter } = useCompanyStore();
  const router = useRouter();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadReports = useCallback(() => {
    apiJson<ReportItem[]>(`/companies/${companyId}/reports`)
      .then(setReports)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [companyId]);

  useEffect(() => {
    loadReports();
    const interval = setInterval(loadReports, 3000);
    return () => clearInterval(interval);
  }, [loadReports]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (reportModuleFilter && r.report_type !== reportModuleFilter) return false;
      const tier = r.tier || 'standard';
      if (reportTierFilter && tier !== reportTierFilter) return false;
      return true;
    });
  }, [reports, reportModuleFilter, reportTierFilter]);

  const panelTitle = reportModuleFilter
    ? MODULE_SHORT_LABELS[reportModuleFilter] || 'Reports'
    : 'All Reports';

  return (
    <div className="relative flex h-full w-80 flex-col border-l bg-background xl:w-96 overflow-hidden">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold">{panelTitle}</h3>
          {filteredReports.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
              {filteredReports.length}
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={closeReports}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1 border-b px-3 py-2">
        {TIER_FILTER_OPTIONS.map((opt) => {
          const isActive = reportTierFilter === opt.id;
          const Icon = 'icon' in opt ? opt.icon : null;
          return (
            <button
              key={opt.label}
              onClick={() => setReportTierFilter(isActive ? null : opt.id)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer',
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {Icon && <Icon className={cn('h-3 w-3', !isActive && ('color' in opt ? opt.color : ''))} />}
              {opt.label}
            </button>
          );
        })}
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">No Reports Yet</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {reportModuleFilter
                ? `No ${MODULE_SHORT_LABELS[reportModuleFilter] || ''} reports generated yet. Use the Generate Report button.`
                : 'Generate your first report from any module page.'}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredReports.map((report) => {
              const statusCfg = STATUS_CONFIG[report.status] || STATUS_CONFIG.draft;
              const isGenerating = report.status === 'generating' || report.status === 'pending';
              const tier = report.tier || 'standard';
              const TierIcon = TIER_ICONS[tier] || Star;
              return (
                <button
                  key={report.id}
                  onClick={() => !isGenerating && router.push(`/companies/${companyId}/reports/${report.id}`)}
                  disabled={isGenerating}
                  className={cn(
                    'w-full flex items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors group',
                    isGenerating ? 'opacity-70 cursor-wait' : 'hover:bg-muted/60 cursor-pointer'
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                    {isGenerating ? <Loader2 className="h-4 w-4 text-primary animate-spin" /> : <FileText className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{REPORT_TYPE_LABELS[report.report_type] || report.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('flex items-center gap-1 text-xs', TIER_COLORS[tier])}>
                        <TierIcon className="h-3 w-3" />
                        {TIER_LABELS[tier]}
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.color, statusCfg.animate && 'animate-pulse')} />
                        {statusCfg.label}
                      </span>
                    </div>
                    {isGenerating && report.progress_message ? (
                      <p className="text-xs text-blue-400 mt-0.5 truncate">{report.progress_message}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {new Date(report.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  {!isGenerating && <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />}
                </button>
              );
            })}
          </div>
        )}
        {/* Bottom padding so last item isn't hidden behind the fixed button */}
        {reportModuleFilter && <div className="h-16" />}
      </ScrollArea>

      {/* Generate Report button — fixed at bottom */}
      {reportModuleFilter && (
        <div className="absolute bottom-0 left-0 right-0 border-t bg-background p-3">
          <GenerateReportDialog
            companyId={companyId}
            moduleType={reportModuleFilter}
            moduleName={MODULE_SHORT_LABELS[reportModuleFilter] || REPORT_TYPE_LABELS[reportModuleFilter] || 'Report'}
            onGenerated={loadReports}
          >
            <Button variant="default" size="sm" className="w-full cursor-pointer gap-2">
              <Plus className="h-3.5 w-3.5" /> Generate {MODULE_SHORT_LABELS[reportModuleFilter] || 'Report'}
            </Button>
          </GenerateReportDialog>
        </div>
      )}
    </div>
  );
}
