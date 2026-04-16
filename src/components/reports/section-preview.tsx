'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiJson } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChartBlock, parseChartSpec } from './chart-block';

const MARKDOWN_COMPONENTS = {
  code({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { className?: string; children?: React.ReactNode }) {
    const lang = /language-(\w+)/.exec(className || '')?.[1];
    if (lang === 'chart') {
      const raw = String(children ?? '').trim();
      const spec = parseChartSpec(raw);
      if (spec) return <ChartBlock spec={spec} />;
      return (
        <pre className="not-prose text-xs text-destructive/80 border border-destructive/30 rounded p-2 my-2">
          Invalid chart spec:
          {'\n'}
          {raw.slice(0, 400)}
        </pre>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

interface Report {
  id: string;
  report_type: string;
  status: string;
  sections: Array<{
    section_key: string;
    section_title: string;
    content: string | null;
  }>;
}

interface SectionPreviewProps {
  companyId: string;
  reportType: string;
  sections: string[];
  icon: React.ReactNode;
}

export function SectionPreview({ companyId, reportType, sections, icon }: SectionPreviewProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchReport = useCallback(() => {
    if (fetched) return;
    setLoading(true);
    apiJson<Array<{ id: string; report_type: string; status: string }>>(`/companies/${companyId}/reports`)
      .then(async (reports) => {
        const match = reports.find((r) => r.report_type === reportType && (r.status === 'draft' || r.status === 'approved'));
        if (match) {
          const full = await apiJson<Report>(`/companies/${companyId}/reports/${match.id}`);
          setReport(full);
        }
        setFetched(true);
      })
      .catch(() => setFetched(true))
      .finally(() => setLoading(false));
  }, [companyId, reportType, fetched]);

  const handleToggle = (section: string) => {
    if (!fetched) fetchReport();
    setExpanded((prev) => (prev === section ? null : section));
  };

  const getContent = (sectionName: string): string | null => {
    if (!report) return null;
    // Match by title (case-insensitive, partial)
    const match = report.sections.find(
      (s) => s.section_title.toLowerCase() === sectionName.toLowerCase() ||
             sectionName.toLowerCase().includes(s.section_title.toLowerCase()) ||
             s.section_title.toLowerCase().includes(sectionName.toLowerCase())
    );
    return match?.content || null;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Report Sections</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {sections.map((s) => {
          const isExpanded = expanded === s;
          const content = isExpanded ? getContent(s) : null;

          return (
            <div key={s} className="rounded-lg border overflow-hidden">
              <button
                onClick={() => handleToggle(s)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-sm hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  {icon}
                  {s}
                </span>
                <div className="flex items-center gap-2">
                  {!isExpanded && (
                    <span className="text-xs text-muted-foreground">
                      {fetched && report ? 'Generated' : 'Ready'}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>
              {isExpanded && (
                <div className="border-t px-4 py-3 bg-muted/20">
                  {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                    </div>
                  ) : content ? (
                    <div className="prose prose-invert prose-sm max-w-none report-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>{content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      {fetched && !report
                        ? 'No report generated yet. Click "Generate Report" to create one.'
                        : 'Section not available in the current report.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
