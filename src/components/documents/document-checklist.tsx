'use client';

import { useRef, useState, useMemo } from 'react';
import {
  Upload,
  Loader2,
  Check,
  Circle,
  Trash2,
  FileText,
  FileSpreadsheet,
  FileBarChart,
  Scale,
  Users,
  Briefcase,
  ScrollText,
  Building2,
  TrendingUp,
  BookText,
  Gavel,
  ClipboardList,
  MessageSquare,
  File as FileIcon,
  type LucideIcon,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Doc {
  id: string;
  filename: string;
  extraction_status: string;
  category?: string | null;
}

interface DocumentChecklistProps {
  companyId: string;
  documents: Doc[];
  onChanged: () => void;
}

export interface ChecklistCategory {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}

// Matches the backend taxonomy in document_parser.py
export const CATEGORIES: ChecklistCategory[] = [
  { id: 'audit_report',          label: 'Audit Report',           hint: 'Audited financial statements', icon: FileBarChart },
  { id: 'management_accounts',   label: 'Management Accounts',    hint: 'Interim P&L, balance sheet',   icon: FileSpreadsheet },
  { id: 'tax_return',            label: 'Tax Returns',            hint: 'Filings, CP204, LHDN',         icon: ScrollText },
  { id: 'org_chart',             label: 'Org Chart',              hint: 'Group / corporate structure',  icon: Building2 },
  { id: 'cap_table',             label: 'Cap Table',              hint: 'Shareholder register',         icon: Users },
  { id: 'board_minutes',         label: 'Board Minutes',          hint: 'Minutes, resolutions',         icon: ClipboardList },
  { id: 'shareholder_agreement', label: 'Shareholder Agreement',  hint: 'SHA, investment docs',         icon: Briefcase },
  { id: 'material_contract',     label: 'Material Contracts',     hint: 'Customer / supplier / IP',     icon: BookText },
  { id: 'company_profile',       label: 'Company Profile',        hint: 'Pitch deck, proposal',         icon: FileText },
  { id: 'projections',           label: 'Projections',            hint: 'Budgets, 3-year forecast',     icon: TrendingUp },
  { id: 'legal',                 label: 'Legal Opinions',         hint: 'Litigation, regulatory',       icon: Scale },
  { id: 'prospectus',            label: 'Prospectus / S-1',       hint: 'Offering docs',                icon: Gavel },
  { id: 'interview',             label: 'Interviews',             hint: 'Mgmt Q&A, notes',              icon: MessageSquare },
];

// Anything NOT matching the above taxonomy lands in this bucket
const OTHER_CATEGORY_ID = 'other';

export function DocumentChecklist({ companyId, documents, onChanged }: DocumentChecklistProps) {
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setUploading((n) => n + 1);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'other');
      await apiFetch(`/companies/${companyId}/documents/upload`, {
        method: 'POST',
        body: formData,
      });
      toast.success(`Uploaded ${file.name}`);
      onChanged();
    } catch {
      toast.error(`Failed to upload ${file.name}`);
    } finally {
      setUploading((n) => Math.max(0, n - 1));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files).forEach(uploadFile);
  };

  const handleDelete = async (docId: string) => {
    try {
      await apiFetch(`/companies/${companyId}/documents/${docId}`, { method: 'DELETE' });
      toast.success('Document removed');
      onChanged();
    } catch {
      toast.error('Delete failed');
    }
  };

  const knownIds = useMemo(() => new Set(CATEGORIES.map((c) => c.id)), []);

  const { bucketed, other, processing } = useMemo(() => {
    const bucketed = new Map<string, Doc[]>();
    const other: Doc[] = [];
    const processing: Doc[] = [];

    for (const doc of documents) {
      const isDone = doc.extraction_status === 'completed';
      const isProcessing = doc.extraction_status === 'pending' || doc.extraction_status === 'processing';

      if (isProcessing) {
        processing.push(doc);
        continue;
      }

      const cat = (doc.category || '').trim();
      if (isDone && cat && knownIds.has(cat)) {
        const arr = bucketed.get(cat) ?? [];
        arr.push(doc);
        bucketed.set(cat, arr);
      } else {
        // failed, unknown category, or unclassified
        other.push(doc);
      }
    }
    return { bucketed, other, processing };
  }, [documents, knownIds]);

  const receivedCount = Array.from(bucketed.keys()).length;
  const totalCategories = CATEGORIES.length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all cursor-pointer',
          dragOver
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/10'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 ring-1 ring-inset ring-primary/20">
          {uploading > 0 ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Upload className="h-4 w-4 text-primary" />
          )}
        </div>
        <p className="text-sm font-medium">
          {uploading > 0 ? `Uploading ${uploading} file${uploading === 1 ? '' : 's'}…` : 'Drop files here'}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          AI will auto-detect each document type
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          onChange={(e) => {
            Array.from(e.target.files || []).forEach(uploadFile);
            e.target.value = '';
          }}
        />
      </div>

      {/* Processing pile — shown above checklist while LLM classifies */}
      {processing.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Classifying {processing.length} file{processing.length === 1 ? '' : 's'}
            </p>
          </div>
          <ul className="space-y-1">
            {processing.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                <span className="truncate flex-1">{d.filename}</span>
                <span className="text-[10px] text-primary/80">Analyzing…</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Checklist header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Document Checklist
        </p>
        <p className="text-[10px] font-mono tabular-nums text-muted-foreground">
          {receivedCount} / {totalCategories}
        </p>
      </div>

      {/* Category rows — compact single-line */}
      <ul className="space-y-0.5">
        {CATEGORIES.map((cat) => {
          const docs = bucketed.get(cat.id) ?? [];
          const received = docs.length > 0;
          const Icon = cat.icon;
          return (
            <li
              key={cat.id}
              className={cn(
                'group rounded-md border transition-colors',
                received
                  ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                  : 'border-border/40 bg-muted/10'
              )}
            >
              <div className="flex items-center gap-2 px-2 py-1.5">
                {/* Status marker */}
                <div
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                    received
                      ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30'
                      : 'bg-muted/40 text-muted-foreground/50 ring-1 ring-inset ring-border'
                  )}
                >
                  {received ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : <Circle className="h-1.5 w-1.5" strokeWidth={3} />}
                </div>

                {/* Category icon + label */}
                <Icon className={cn('h-3 w-3 shrink-0', received ? 'text-emerald-400/80' : 'text-muted-foreground/60')} />
                <p className={cn('flex-1 text-[11px] font-medium truncate', received ? 'text-foreground' : 'text-muted-foreground')}>
                  {cat.label}
                </p>

                {/* Count badge if >1 received */}
                {received && docs.length > 1 && (
                  <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-px text-[9px] font-mono tabular-nums text-emerald-400 ring-1 ring-inset ring-emerald-500/25">
                    {docs.length}
                  </span>
                )}
              </div>

              {/* Received file list (inline under category) */}
              {received && (
                <ul className="border-t border-emerald-500/10 divide-y divide-emerald-500/5">
                  {docs.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-2 px-2 py-1 text-[11px]">
                      <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground/60 ml-3" />
                      <span className="truncate flex-1 text-foreground/75" title={doc.filename}>
                        {doc.filename}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.id);
                        }}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 opacity-0 transition-all cursor-pointer group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${doc.filename}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {/* Unclassified / failed bucket */}
      {other.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Unclassified
            </p>
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60">
              {other.length}
            </span>
          </div>
          <ul className="space-y-1">
            {other.map((doc) => {
              const isFailed = doc.extraction_status === 'failed';
              return (
                <li key={doc.id} className="group flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[11px] hover:bg-foreground/[0.03]">
                  <FileIcon className={cn('h-3 w-3 shrink-0', isFailed ? 'text-red-400/70' : 'text-muted-foreground/60')} />
                  <span className="truncate flex-1" title={doc.filename}>
                    {doc.filename}
                  </span>
                  {isFailed && (
                    <span className="shrink-0 rounded-full bg-red-500/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-wider text-red-400 ring-1 ring-inset ring-red-500/25">
                      Failed
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 opacity-0 transition-all cursor-pointer group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove ${doc.filename}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// Exposed for callers that want to show a summary badge elsewhere
export { OTHER_CATEGORY_ID };
