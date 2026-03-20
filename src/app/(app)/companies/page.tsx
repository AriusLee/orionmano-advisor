"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Search, ChevronRight } from "lucide-react";

interface Company {
  id: string;
  name: string;
  legal_name: string | null;
  industry: string | null;
  country: string;
  status: string;
  engagement_type: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500",
  on_hold: "bg-amber-500",
  completed: "bg-blue-500",
  archived: "bg-slate-500",
};

export default function CompaniesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user) {
      apiJson<Company[]>("/companies").then(setCompanies).catch(() => {});
    }
  }, [user]);

  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.legal_name?.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.engagement_type?.toLowerCase().includes(q)
    );
  }, [companies, search]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Companies</h2>
        <Button className="cursor-pointer" onClick={() => router.push("/companies/new")}>
          <Plus className="mr-2 h-4 w-4" /> New Company
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, industry, country..."
          className="pl-9"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
          {companies.length === 0 ? (
            <>
              <p className="text-lg font-medium">No companies yet</p>
              <p className="text-sm text-muted-foreground">Create your first company to get started</p>
              <Button className="mt-4 cursor-pointer" onClick={() => router.push("/companies/new")}>
                <Plus className="mr-2 h-4 w-4" /> New Company
              </Button>
            </>
          ) : (
            <>
              <p className="text-lg font-medium">No results</p>
              <p className="text-sm text-muted-foreground">No companies match &ldquo;{search}&rdquo;</p>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-lg border">
          {/* Header */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_120px_120px_140px_32px] items-center gap-4 border-b px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Company</span>
            <span>Industry</span>
            <span>Engagement</span>
            <span>Created</span>
            <span />
          </div>

          {/* Rows */}
          {filtered.map((c, i) => (
            <div
              key={c.id}
              onClick={() => router.push(`/companies/${c.id}`)}
              className={`grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_140px_32px] items-center gap-2 sm:gap-4 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors group ${
                i < filtered.length - 1 ? "border-b" : ""
              }`}
            >
              {/* Company name + status */}
              <div className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLORS[c.status] || "bg-slate-500"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  {c.legal_name && c.legal_name !== c.name && (
                    <p className="text-xs text-muted-foreground truncate">{c.legal_name}</p>
                  )}
                </div>
              </div>

              {/* Industry */}
              <div className="hidden sm:block">
                {c.industry ? (
                  <Badge variant="secondary" className="text-xs font-normal truncate max-w-full">{c.industry}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>

              {/* Engagement */}
              <div className="hidden sm:block">
                {c.engagement_type ? (
                  <Badge variant="outline" className="text-xs font-normal">{c.engagement_type.toUpperCase()}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>

              {/* Created */}
              <div className="hidden sm:block">
                <span className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>

              {/* Chevron */}
              <div className="hidden sm:flex justify-end">
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Mobile badges */}
              <div className="flex items-center gap-2 sm:hidden">
                {c.industry && <Badge variant="secondary" className="text-xs font-normal">{c.industry}</Badge>}
                {c.engagement_type && <Badge variant="outline" className="text-xs font-normal">{c.engagement_type.toUpperCase()}</Badge>}
                <Badge variant="outline" className="text-xs font-normal">{c.country}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Count */}
      {filtered.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {filtered.length === companies.length
            ? `${companies.length} companies`
            : `${filtered.length} of ${companies.length} companies`}
        </p>
      )}
    </div>
  );
}
