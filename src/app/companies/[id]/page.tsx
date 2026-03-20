"use client";

import { use, useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, MessageSquare } from "lucide-react";

interface Company {
  id: string;
  name: string;
  legal_name: string | null;
  industry: string | null;
  sub_industry: string | null;
  country: string;
  description: string | null;
  engagement_type: string | null;
  target_exchange: string | null;
  status: string;
}

interface DocSummary { total: number; completed: number }
interface ReportSummary { total: number; draft: number }

export default function CompanyOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [company, setCompany] = useState<Company | null>(null);
  const [docs, setDocs] = useState<DocSummary>({ total: 0, completed: 0 });
  const [reports, setReports] = useState<ReportSummary>({ total: 0, draft: 0 });

  useEffect(() => {
    apiJson<Company>(`/companies/${id}`).then(setCompany);
    apiJson<Array<{ extraction_status: string }>>(`/companies/${id}/documents`).then((d) =>
      setDocs({ total: d.length, completed: d.filter((x) => x.extraction_status === "completed").length })
    );
    apiJson<Array<{ status: string }>>(`/companies/${id}/reports`).then((r) =>
      setReports({ total: r.length, draft: r.filter((x) => x.status === "draft").length })
    );
  }, [id]);

  if (!company) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">{company.name}</h2>
        <p className="text-muted-foreground">{company.description || "No description"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {company.industry && <Badge>{company.industry}</Badge>}
          {company.engagement_type && <Badge variant="outline">{company.engagement_type.toUpperCase()}</Badge>}
          {company.target_exchange && <Badge variant="secondary">{company.target_exchange.toUpperCase()}</Badge>}
          <Badge variant="outline">{company.country}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{docs.total}</div>
            <p className="text-xs text-muted-foreground">{docs.completed} extracted</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.total}</div>
            <p className="text-xs text-muted-foreground">{reports.draft} draft</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">AI Chat</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Ready</div>
            <p className="text-xs text-muted-foreground">Ask anything about this company</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Company Details</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              ["Legal Name", company.legal_name],
              ["Industry", company.industry],
              ["Sub-industry", company.sub_industry],
              ["Country", company.country],
              ["Engagement Type", company.engagement_type],
              ["Target Exchange", company.target_exchange],
              ["Status", company.status],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
                <dd className="mt-1">{(value as string) || "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
