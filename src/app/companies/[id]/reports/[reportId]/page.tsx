"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Edit3, Save, X, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

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
  sections: ReportSection[];
}

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

  if (!report) return <div className="animate-pulse text-muted-foreground">Loading report...</div>;

  const currentSection = report.sections.find((s) => s.section_key === activeSection);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-semibold">{report.title}</h2>
            <Badge variant="outline" className="mt-1">{report.status}</Badge>
          </div>
        </div>
        <Button variant="outline" className="cursor-pointer gap-2" onClick={handleExportPdf} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export PDF
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Section Nav */}
        <div className="w-64 shrink-0">
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-1">
              {report.sections.map((s) => (
                <Button
                  key={s.section_key}
                  variant={activeSection === s.section_key ? "secondary" : "ghost"}
                  className="w-full justify-start text-left h-auto py-2 cursor-pointer"
                  onClick={() => { setActiveSection(s.section_key); setEditing(null); }}
                >
                  <span className="truncate text-sm">{s.section_title}</span>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <Separator orientation="vertical" className="h-auto" />

        {/* Section Content */}
        <div className="flex-1 min-w-0">
          {currentSection && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{currentSection.section_title}</CardTitle>
                <div className="flex items-center gap-2">
                  {currentSection.is_ai_generated && (
                    <Badge variant="secondary" className="text-xs">AI Generated</Badge>
                  )}
                  {editing === currentSection.section_key ? (
                    <>
                      <Button size="sm" className="cursor-pointer" onClick={() => handleSave(currentSection.section_key)}>
                        <Save className="mr-1 h-3 w-3" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setEditing(null)}>
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
              </CardHeader>
              <CardContent>
                {editing === currentSection.section_key ? (
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[500px] font-mono text-sm"
                  />
                ) : (
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown>{currentSection.content || "*No content yet*"}</ReactMarkdown>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
