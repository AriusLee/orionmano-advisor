"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Edit3,
  Save,
  X,
  Download,
  Loader2,
  Sparkles,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface ReportSection {
  id: string;
  section_key: string;
  section_title: string;
  content: string | null;
  sort_order: number;
  is_ai_generated: boolean;
}

interface Report {
  id: string;
  title: string;
  report_type: string;
  status: string;
  tier?: string;
  sections: ReportSection[];
}

const STATUS_META: Record<string, { label: string; dot: string; text: string; ring: string }> = {
  draft:    { label: "Draft",     dot: "bg-amber-400",   text: "text-amber-300",   ring: "ring-amber-400/30" },
  approved: { label: "Approved",  dot: "bg-emerald-400", text: "text-emerald-300", ring: "ring-emerald-400/30" },
  review:   { label: "In Review", dot: "bg-purple-400",  text: "text-purple-300",  ring: "ring-purple-400/30" },
  generating:{ label: "Generating", dot: "bg-blue-400",  text: "text-blue-300",    ring: "ring-blue-400/30" },
  failed:   { label: "Failed",    dot: "bg-red-400",     text: "text-red-300",     ring: "ring-red-400/30" },
};

const REPORT_TYPE_LABEL: Record<string, string> = {
  gap_analysis: "Gap Analysis",
  industry_report: "Industry Expert",
  dd_report: "Due Diligence",
  valuation_report: "Valuation",
  teaser: "Teaser",
  company_deck: "Company Deck",
  sales_deck: "Sales Deck",
  kickoff_deck: "Kick-off Deck",
};

const TIER_LABEL: Record<string, string> = {
  essential: "Essential",
  standard: "Standard",
  premium: "Premium",
};

// Strip a leading H1 line (`# …`) from content — we already render the section title in the header.
function stripLeadingH1(md: string): string {
  return md.replace(/^\s*#\s+[^\n]*\n+/, "");
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h2 className="mt-8 mb-3 border-b border-border/40 pb-2 text-[22px] font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className="mt-7 mb-2.5 text-lg font-semibold tracking-tight text-foreground first:mt-0">
      <span className="mr-2 inline-block h-4 w-[3px] translate-y-[2px] rounded-sm bg-primary/70 align-middle" aria-hidden />
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-5 mb-2 text-[15px] font-semibold text-foreground">{children}</h4>
  ),
  h4: ({ children }) => (
    <h5 className="mt-4 mb-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h5>
  ),
  p: ({ children }) => (
    <p className="my-3 text-[14px] leading-[1.7] text-foreground/85">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-foreground/80">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline decoration-primary/30 underline-offset-[3px] transition-colors hover:decoration-primary"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="my-3 space-y-1.5 pl-5 text-[14px] leading-[1.65] text-foreground/85 marker:text-primary/60 [&>li]:list-disc">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 space-y-1.5 pl-5 text-[14px] leading-[1.65] text-foreground/85 marker:font-medium marker:text-primary/80 [&>li]:list-decimal">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-md border-l-[3px] border-primary/60 bg-muted/25 px-4 py-2 text-[14px] leading-relaxed text-foreground/80">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border/50" />,
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className={cn("block font-mono text-[12.5px] leading-[1.6] text-foreground/90", className)}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded border border-border/40 bg-muted/40 px-1.5 py-0.5 font-mono text-[12.5px] text-foreground">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-lg border border-border/50 bg-background/60 p-4 text-[12.5px] shadow-inner">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto rounded-lg border border-border/50 bg-card/40">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-border/60 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
      {children}
    </thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y divide-border/40">{children}</tbody>,
  tr: ({ children }) => <tr className="transition-colors hover:bg-muted/20">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2.5 text-left font-semibold text-foreground/90">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2.5 align-top leading-relaxed text-foreground/85">{children}</td>
  ),
};

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id, reportId } = use(params);
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [exporting, setExporting] = useState(false);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!activeSection) return;
    const scrollable = articleRef.current?.closest("main");
    if (scrollable) scrollable.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeSection]);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/companies/${id}/reports/${reportId}/pdf`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report?.title || "report"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    apiJson<Report>(`/companies/${id}/reports/${reportId}`).then((r) => {
      setReport(r);
      if (r.sections.length > 0) setActiveSection(r.sections[0].section_key);
    });
  }, [id, reportId]);

  const handleSave = async (sectionKey: string) => {
    try {
      await apiJson(`/companies/${id}/reports/${reportId}/sections/${sectionKey}`, {
        method: "PATCH",
        body: JSON.stringify({ content: editContent }),
      });
      setReport((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map((s) =>
            s.section_key === sectionKey ? { ...s, content: editContent, is_ai_generated: false } : s
          ),
        };
      });
      setEditing(null);
      toast.success("Section saved");
    } catch {
      toast.error("Save failed");
    }
  };

  const currentSection = useMemo(
    () => report?.sections.find((s) => s.section_key === activeSection) ?? null,
    [report, activeSection]
  );

  const currentIndex = useMemo(
    () => (report && currentSection ? report.sections.findIndex((s) => s.section_key === currentSection.section_key) : -1),
    [report, currentSection]
  );

  if (!report) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusMeta = STATUS_META[report.status] || STATUS_META.draft;
  const typeLabel = REPORT_TYPE_LABEL[report.report_type] || report.report_type;
  const tierLabel = report.tier ? TIER_LABEL[report.tier] || report.tier : null;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 cursor-pointer"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary ring-1 ring-inset ring-primary/25">
                <FileText className="h-3 w-3" strokeWidth={2.25} />
                {typeLabel}
              </span>
              {tierLabel && (
                <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {tierLabel}
                </span>
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full bg-muted/25 px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                  statusMeta.text,
                  statusMeta.ring
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
                {statusMeta.label}
              </span>
            </div>
            <h1 className="truncate text-2xl font-semibold tracking-tight leading-tight">
              {report.title}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {report.sections.length} section{report.sections.length === 1 ? "" : "s"} ·{" "}
              {report.sections.filter((s) => s.is_ai_generated).length} AI-generated
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="cursor-pointer gap-2"
          onClick={handleExportPdf}
          disabled={exporting}
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export PDF
        </Button>
      </div>

      {/* ── Body ── */}
      <div className="flex gap-6">
        {/* Section Nav */}
        <aside className="w-72 shrink-0">
          <div className="sticky top-4">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Sections
            </p>
            <div className="h-[calc(100vh-180px)] overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
              <ol className="space-y-0.5">
                {report.sections.map((s, i) => {
                  const isActive = activeSection === s.section_key;
                  return (
                    <li key={s.section_key}>
                      <button
                        onClick={() => {
                          setActiveSection(s.section_key);
                          setEditing(null);
                        }}
                        className={cn(
                          "group flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-all cursor-pointer",
                          isActive
                            ? "bg-primary/10 ring-1 ring-inset ring-primary/25"
                            : "hover:bg-muted/40"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-mono font-medium tabular-nums ring-1 ring-inset transition-colors",
                            isActive
                              ? "bg-primary/20 text-primary ring-primary/30"
                              : "bg-muted/40 text-muted-foreground ring-border/50 group-hover:text-foreground"
                          )}
                        >
                          {i + 1}
                        </span>
                        <span
                          className={cn(
                            "line-clamp-2 flex-1 text-[13px] leading-snug transition-colors",
                            isActive ? "font-medium text-foreground" : "text-muted-foreground group-hover:text-foreground"
                          )}
                        >
                          {s.section_title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </aside>

        {/* Section Content */}
        <section className="min-w-0 flex-1">
          {currentSection && (
            <article ref={articleRef}>
              {/* Section header */}
              <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-primary/10 px-2 text-[11px] font-mono font-semibold text-primary ring-1 ring-inset ring-primary/20">
                    {currentIndex >= 0 ? currentIndex + 1 : "·"}
                  </span>
                  <h2 className="truncate text-xl font-semibold tracking-tight">
                    {currentSection.section_title}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {currentSection.is_ai_generated ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary ring-1 ring-inset ring-primary/25">
                      <Sparkles className="h-3 w-3" strokeWidth={2.25} /> AI Generated
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-500/25">
                      <CheckCircle2 className="h-3 w-3" strokeWidth={2.25} /> Edited
                    </span>
                  )}
                  {editing === currentSection.section_key ? (
                    <>
                      <Button
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => handleSave(currentSection.section_key)}
                      >
                        <Save className="mr-1 h-3 w-3" /> Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="cursor-pointer"
                        onClick={() => setEditing(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => {
                        setEditing(currentSection.section_key);
                        setEditContent(currentSection.content || "");
                      }}
                    >
                      <Edit3 className="mr-1 h-3 w-3" /> Edit
                    </Button>
                  )}
                </div>
              </header>

              {/* Section body */}
              <div>
                {editing === currentSection.section_key ? (
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[500px] font-mono text-sm"
                  />
                ) : currentSection.content ? (
                  <div className="max-w-[780px]">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {stripLeadingH1(currentSection.content)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm italic text-muted-foreground">No content yet.</p>
                )}
              </div>

              {/* Prev / Next navigation */}
              {report.sections.length > 1 && (
                <footer className="mt-8 flex items-center justify-between gap-3 border-t border-border/40 pt-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer gap-1.5 text-xs"
                    disabled={currentIndex <= 0}
                    onClick={() => {
                      if (currentIndex > 0) {
                        setActiveSection(report.sections[currentIndex - 1].section_key);
                        setEditing(null);
                      }
                    }}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {currentIndex > 0 ? report.sections[currentIndex - 1].section_title : "Start"}
                  </Button>
                  <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                    {currentIndex + 1} / {report.sections.length}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer gap-1.5 text-xs"
                    disabled={currentIndex >= report.sections.length - 1}
                    onClick={() => {
                      if (currentIndex < report.sections.length - 1) {
                        setActiveSection(report.sections[currentIndex + 1].section_key);
                        setEditing(null);
                      }
                    }}
                  >
                    {currentIndex < report.sections.length - 1
                      ? report.sections[currentIndex + 1].section_title
                      : "End"}
                    <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                  </Button>
                </footer>
              )}
            </article>
          )}
        </section>
      </div>
    </div>
  );
}
