'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Loader2, AlertCircle, Download } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ViewerDoc {
  id: string;
  filename: string;
  mime_type?: string | null;
  category?: string | null;
  extraction_status?: string;
  extracted_data?: Record<string, unknown> | null;
}

interface Props {
  companyId: string;
  doc: ViewerDoc | null;
  onClose: () => void;
}

type Kind = 'pdf' | 'image' | 'xlsx' | 'text' | 'other';

function detectKind(d: ViewerDoc): Kind {
  const mime = (d.mime_type || '').toLowerCase();
  const name = d.filename.toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|ico)$/.test(name)) return 'image';
  if (
    mime.includes('spreadsheetml') ||
    mime === 'application/vnd.ms-excel' ||
    /\.(xlsx|xls|xlsm|csv)$/.test(name)
  )
    return 'xlsx';
  if (mime.startsWith('text/') || /\.(txt|md|json|log)$/.test(name)) return 'text';
  return 'other';
}

export function DocumentViewerModal({ companyId, doc, onClose }: Props) {
  const open = !!doc;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[min(96vw,1200px)] max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0"
      >
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-border/40 shrink-0">
          <DialogTitle className="text-base truncate pr-8">
            {doc?.filename ?? ''}
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            {doc?.mime_type ?? 'unknown type'}
            {doc?.category ? ` · ${doc.category}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-muted/20">
          {doc && <ViewerBody companyId={companyId} doc={doc} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ViewerBody({ companyId, doc }: { companyId: string; doc: ViewerDoc }) {
  const kind = useMemo(() => detectKind(doc), [doc]);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [sheets, setSheets] = useState<XlsxSheet[] | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBlobUrl(null);
    setSheets(null);
    setActiveSheet(0);

    // The 'other' branch doesn't need to fetch the file at all — it renders
    // extracted_data straight from the doc record.
    if (kind === 'other') {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await apiFetch(`/companies/${companyId}/documents/${doc.id}/raw`);
        if (cancelled) return;

        if (kind === 'xlsx') {
          const buf = await res.arrayBuffer();
          if (cancelled) return;
          const wb = XLSX.read(buf, { type: 'array' });
          const parsed: XlsxSheet[] = wb.SheetNames.map((name) => ({
            name,
            html: XLSX.utils.sheet_to_html(wb.Sheets[name], { id: `sheet-${name}` }),
          }));
          setSheets(parsed);
        } else {
          const blob = await res.blob();
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          cleanupRef.current = url;
          setBlobUrl(url);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load file');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (cleanupRef.current) {
        URL.revokeObjectURL(cleanupRef.current);
        cleanupRef.current = null;
      }
    };
  }, [companyId, doc.id, kind]);

  if (loading) return <CenterMsg icon={<Loader2 className="h-5 w-5 animate-spin" />} text="Loading…" />;
  if (error)
    return (
      <CenterMsg
        icon={<AlertCircle className="h-5 w-5 text-destructive" />}
        text={error}
        sub="The file may have been deleted from disk."
      />
    );

  if (kind === 'pdf' && blobUrl)
    return <iframe src={blobUrl} className="h-[80vh] w-full border-0" title={doc.filename} />;

  if (kind === 'image' && blobUrl)
    return (
      <div className="flex items-center justify-center p-6">
        <img src={blobUrl} alt={doc.filename} className="max-h-[80vh] max-w-full object-contain" />
      </div>
    );

  if (kind === 'text' && blobUrl)
    return <TextBody url={blobUrl} />;

  if (kind === 'xlsx' && sheets)
    return <XlsxBody sheets={sheets} activeSheet={activeSheet} setActiveSheet={setActiveSheet} />;

  // 'other' — render what the LLM extracted, plus a download fallback
  return <FallbackBody companyId={companyId} doc={doc} />;
}

interface XlsxSheet {
  name: string;
  html: string;
}

function XlsxBody({
  sheets,
  activeSheet,
  setActiveSheet,
}: {
  sheets: XlsxSheet[];
  activeSheet: number;
  setActiveSheet: (n: number) => void;
}) {
  const sheet = sheets[activeSheet];
  return (
    <div className="flex flex-col h-full">
      {sheets.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border/40 bg-background/60 px-3 py-1.5 shrink-0">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActiveSheet(i)}
              className={cn(
                'cursor-pointer rounded px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors',
                i === activeSheet
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div
        className="xlsx-table flex-1 overflow-auto p-4"
        // SheetJS sanitizes the cell content; markup is a plain <table> with
        // text values. Safe to inject.
        dangerouslySetInnerHTML={{ __html: sheet.html }}
      />
      <style>{`
        .xlsx-table table { border-collapse: collapse; font-size: 11px; }
        .xlsx-table th, .xlsx-table td { border: 1px solid hsl(var(--border)); padding: 4px 8px; vertical-align: top; }
        .xlsx-table th { background: hsl(var(--muted)); font-weight: 600; }
        .xlsx-table tr:nth-child(even) td { background: hsl(var(--muted) / 0.3); }
      `}</style>
    </div>
  );
}

function TextBody({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => r.text())
      .then((t) => !cancelled && setText(t))
      .catch(() => !cancelled && setText('(failed to load text)'));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return (
    <pre className="p-4 text-[11px] whitespace-pre-wrap break-words font-mono leading-relaxed">
      {text ?? 'Loading…'}
    </pre>
  );
}

function FallbackBody({ companyId, doc }: { companyId: string; doc: ViewerDoc }) {
  const handleDownload = async () => {
    try {
      const res = await apiFetch(`/companies/${companyId}/documents/${doc.id}/raw`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* swallow — toast surfaces in the parent if needed */
    }
  };

  const data = doc.extracted_data;
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between rounded-md border border-border/40 bg-background px-3 py-2">
        <p className="text-[11px] text-muted-foreground">
          Inline preview not available for this file type.
        </p>
        <button
          onClick={handleDownload}
          className="cursor-pointer inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/15"
        >
          <Download className="h-3 w-3" />
          Download
        </button>
      </div>
      {data && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Extracted data
          </p>
          <pre className="rounded-md border border-border/40 bg-background p-3 text-[10px] leading-relaxed font-mono whitespace-pre-wrap break-words max-h-[60vh] overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function CenterMsg({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center">
      {icon}
      <p className="text-sm text-muted-foreground">{text}</p>
      {sub && <p className="text-[11px] text-muted-foreground/70">{sub}</p>}
    </div>
  );
}
