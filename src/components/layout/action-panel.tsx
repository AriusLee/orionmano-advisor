'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import { FileText, Loader2, ChevronRight, Crown, Star, Zap, Plus, FolderOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCompanyStore } from '@/stores/company-store';
import { UploadZone } from '@/components/documents/upload-zone';
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
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  gap_analysis: 'Gap Analysis',
  industry_report: 'Industry Expert Report',
  dd_report: 'Due Diligence Report',
  valuation_report: 'Valuation Report',
};

const REPORT_TYPE_OPTIONS = [
  { id: 'gap_analysis', label: 'Gap Analysis', desc: 'Nasdaq IPO readiness assessment' },
  { id: 'industry_report', label: 'Industry Expert', desc: 'Market research & competitive landscape' },
  { id: 'dd_report', label: 'Due Diligence', desc: 'Financial DD & internal controls' },
  { id: 'valuation_report', label: 'Valuation', desc: 'DCF, comps & sensitivity analysis' },
];

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

const SUGGESTED_FILES = [
  'Corporate proposal / company profile',
  'Audited financial statements (2 years)',
  'Current management reports (balance sheet & P&L)',
  'Shareholder structure & cap table',
];

const HEADER_H = 'h-10';
const FOOTER_H = 'h-14';

type Tab = 'reports' | 'documents';

export function ActionPanel({ companyId }: ActionPanelProps) {
  const { reportModuleFilter } = useCompanyStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('reports');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGenDialog, setShowGenDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [companyTier, setCompanyTier] = useState('standard');

  const loadReports = useCallback(() => {
    apiJson<ReportItem[]>(`/companies/${companyId}/reports`)
      .then(setReports)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [companyId]);

  const loadDocs = useCallback(() => {
    apiJson<DocumentItem[]>(`/companies/${companyId}/documents`)
      .then(setDocs)
      .catch(() => {});
  }, [companyId]);

  useEffect(() => {
    apiJson<{ report_tier: string }>(`/companies/${companyId}`)
      .then(c => setCompanyTier(c.report_tier || 'standard'))
      .catch(() => {});
  }, [companyId]);

  useEffect(() => {
    loadReports();
    loadDocs();
    const interval = setInterval(() => { loadReports(); loadDocs(); }, 3000);
    return () => clearInterval(interval);
  }, [loadReports, loadDocs]);

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

  const TierIcon = TIER_ICONS[companyTier] || Star;

  return (
    <div className="relative h-full w-80 border-l bg-background xl:w-96">
      {/* ─── HEADER: Tab nav (absolute top) ─── */}
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
            'flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors cursor-pointer border-b-2',
            activeTab === 'documents'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Documents
          {docs.length > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium text-muted-foreground">
              {docs.length}
            </span>
          )}
        </button>
      </div>

      {/* ─── BODY: Scrollable content ─── */}
      <div className={cn('absolute left-0 right-0 overflow-y-auto', `top-10 ${activeTab === 'reports' ? 'bottom-14' : 'bottom-0'}`)}>

        {/* Reports tab */}
        {activeTab === 'reports' && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">No Reports Yet</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Generate your first report from the button below.
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {reports.map((report) => {
                  const statusCfg = STATUS_CONFIG[report.status] || STATUS_CONFIG.draft;
                  const isGenerating = report.status === 'generating' || report.status === 'pending';
                  const tier = report.tier || 'standard';
                  const RptTierIcon = TIER_ICONS[tier] || Star;
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
          </>
        )}

        {/* Documents tab */}
        {activeTab === 'documents' && (
          <div className="p-4">
            <UploadZone
              companyId={companyId}
              suggestedFiles={SUGGESTED_FILES}
              documents={docs}
              onUploaded={loadDocs}
            />
          </div>
        )}
      </div>

      {/* ─── FOOTER: Generate button (absolute bottom, reports tab only) ─── */}
      {activeTab === 'reports' && (
        <div className={cn('absolute bottom-0 left-0 right-0 z-10 border-t bg-background flex items-center px-3', FOOTER_H)}>
          <Button
            variant="default"
            size="sm"
            className="w-full cursor-pointer gap-2"
            onClick={() => setShowGenDialog(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Generate Report
            <span className={cn('flex items-center gap-1 ml-auto text-[10px] opacity-70', TIER_COLORS[companyTier])}>
              <TierIcon className="h-3 w-3" />
              {TIER_LABELS[companyTier]}
            </span>
          </Button>
        </div>
      )}

      {/* ─── Generate Report Dialog ─── */}
      <Dialog open={showGenDialog} onOpenChange={setShowGenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {REPORT_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleGenerate(opt.id)}
                disabled={generating}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors cursor-pointer hover:bg-muted/60',
                  reportModuleFilter === opt.id && 'border-primary bg-primary/5',
                  generating && 'opacity-50 cursor-wait'
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
                {reportModuleFilter === opt.id && (
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30">Current</Badge>
                )}
              </button>
            ))}
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
