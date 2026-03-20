"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, FileText, Upload, BarChart3, ArrowRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
} from "recharts";

interface Company {
  id: string;
  name: string;
  industry: string | null;
  status: string;
  engagement_type: string | null;
  created_at: string;
}

interface Report {
  id: string;
  report_type: string;
  status: string;
  created_at: string;
}

interface Document {
  id: string;
  extraction_status: string;
}

const CHART_COLORS = [
  "oklch(0.75 0.15 175)",  // teal primary
  "oklch(0.65 0.15 250)",  // blue
  "oklch(0.70 0.12 140)",  // green
  "oklch(0.60 0.18 300)",  // purple
  "oklch(0.55 0.15 260)",  // indigo
  "oklch(0.70 0.15 50)",   // amber
];

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [allDocs, setAllDocs] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    apiJson<Company[]>("/companies").then(async (comps) => {
      setCompanies(comps);
      // Fetch reports and docs for all companies
      let reports: Report[] = [];
      let docs = 0;
      for (const c of comps.slice(0, 10)) {
        try {
          const r = await apiJson<Report[]>(`/companies/${c.id}/reports`);
          reports = [...reports, ...r];
        } catch { /* skip */ }
        try {
          const d = await apiJson<Document[]>(`/companies/${c.id}/documents`);
          docs += d.length;
        } catch { /* skip */ }
      }
      setAllReports(reports);
      setAllDocs(docs);
    }).catch(() => {});
  }, [user]);

  // --- Derived chart data ---

  // Engagement type distribution
  const engagementData = (() => {
    const counts: Record<string, number> = {};
    companies.forEach((c) => {
      const type = c.engagement_type?.toUpperCase() || "OTHER";
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  // Report type distribution
  const reportTypeData = (() => {
    const labels: Record<string, string> = {
      industry_report: "Industry",
      dd_report: "Due Diligence",
      valuation_report: "Valuation",
      teaser: "Teaser",
      sales_deck: "Sales Deck",
      kickoff_deck: "Kick-off",
      company_deck: "Company Deck",
    };
    const counts: Record<string, number> = {};
    allReports.forEach((r) => {
      const label = labels[r.report_type] || r.report_type;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  })();

  // Report status distribution
  const reportStatusData = (() => {
    const counts: Record<string, number> = { draft: 0, generating: 0, pending: 0, failed: 0 };
    allReports.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  })();

  // Activity over time (last 7 days)
  const activityData = (() => {
    const days: Record<string, { companies: number; reports: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      days[key] = { companies: 0, reports: 0 };
    }
    companies.forEach((c) => {
      const key = new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (days[key]) days[key].companies++;
    });
    allReports.forEach((r) => {
      const key = new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (days[key]) days[key].reports++;
    });
    return Object.entries(days).map(([date, data]) => ({ date, ...data }));
  })();

  // Company status breakdown
  const statusData = (() => {
    const counts: Record<string, number> = {};
    companies.forEach((c) => {
      const s = c.status || "active";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace("_", " "), value }));
  })();

  const totalReports = allReports.length;
  const draftReports = allReports.filter((r) => r.status === "draft").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Welcome back, {user?.name}</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => router.push("/companies")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companies.length}</div>
            <p className="text-xs text-muted-foreground">Active engagements</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allDocs}</div>
            <p className="text-xs text-muted-foreground">Uploaded across all companies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReports}</div>
            <p className="text-xs text-muted-foreground">{draftReports} draft</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Modules</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">Industry · DD · Valuation</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Activity over time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activity (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.014 260)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.65 0.01 260)" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "oklch(0.65 0.01 260)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.20 0.014 260)", border: "1px solid oklch(0.30 0.014 260)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "oklch(0.93 0.006 260)" }}
                  />
                  <Area type="monotone" dataKey="companies" stackId="1" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.3} name="Companies" />
                  <Area type="monotone" dataKey="reports" stackId="1" stroke={CHART_COLORS[1]} fill={CHART_COLORS[1]} fillOpacity={0.3} name="Reports" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Reports by type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Reports by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              {reportTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportTypeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.014 260)" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "oklch(0.65 0.01 260)" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: "oklch(0.65 0.01 260)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "oklch(0.20 0.014 260)", border: "1px solid oklch(0.30 0.014 260)", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No reports generated yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Engagement types pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">By Engagement Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              {engagementData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={engagementData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                      {engagementData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "oklch(0.20 0.014 260)", border: "1px solid oklch(0.30 0.014 260)", borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No data</div>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-1">
              {engagementData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {d.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Company status pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Company Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                      {statusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "oklch(0.20 0.014 260)", border: "1px solid oklch(0.30 0.014 260)", borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No data</div>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-1">
              {statusData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {d.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Report status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Report Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              {reportStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={reportStatusData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                      {reportStatusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "oklch(0.20 0.014 260)", border: "1px solid oklch(0.30 0.014 260)", borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No reports yet</div>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-1">
              {reportStatusData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent companies */}
      {companies.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recent Companies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {companies.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  onClick={() => router.push(`/companies/${c.id}`)}
                  className="flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.industry || "No industry"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.engagement_type && <Badge variant="outline" className="text-xs">{c.engagement_type.toUpperCase()}</Badge>}
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
