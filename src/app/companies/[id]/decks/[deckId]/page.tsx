'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Download,
  History,
  Loader2,
  Palette,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiFetch, apiJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

// ---------------------------------------------------------------------------
// Types — mirror backend/app/api/v1/decks.py response shapes.
// ---------------------------------------------------------------------------

interface DeckVersion {
  version_no: number;
  theme_id: string;
  source: 'generate' | 'amend' | 'theme_swap' | 'restore';
  prompt: string | null;
  created_at: string | null;
}

interface DeckDetail {
  id: string;
  company_id: string;
  title: string;
  theme_id: string;
  preset: string | null;
  prompt: string;
  status: string;
  current_version: number;
  spec: { slides?: unknown[]; title?: string };
  versions: DeckVersion[];
  created_at: string | null;
  updated_at: string | null;
}

interface Theme {
  id: string;
  name: string;
  description: string;
  primary: string;
  background: string;
}

// ---------------------------------------------------------------------------
// Page.
// ---------------------------------------------------------------------------

export default function DeckDetailPage({
  params,
}: {
  params: Promise<{ id: string; deckId: string }>;
}) {
  const { id: companyId, deckId } = use(params);
  const router = useRouter();

  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);

  // The HTML preview is auth-protected — we have to fetch it with a Bearer
  // token, then hand the iframe a blob URL. Reused on every render.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const loadDeck = useCallback(async () => {
    const d = await apiJson<DeckDetail>(`/decks/${deckId}`);
    setDeck(d);
    return d;
  }, [deckId]);

  const refreshPreview = useCallback(
    async (deckTitle: string) => {
      try {
        const res = await apiFetch(`/decks/${deckId}/html`);
        const html = await res.text();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      } catch (e) {
        toast.error(`Preview failed: ${(e as Error).message}`);
      }
      void deckTitle; // (used only to invalidate via dependency callers)
    },
    [deckId],
  );

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [d, t] = await Promise.all([
          loadDeck(),
          apiJson<Theme[]>('/decks/themes'),
        ]);
        if (cancelled) return;
        setThemes(t);
        await refreshPreview(d.title);
      } catch (e) {
        toast.error(`Failed to load deck: ${(e as Error).message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // ----- Actions ---------------------------------------------------------

  const handleDownload = useCallback(async () => {
    try {
      const res = await apiFetch(`/decks/${deckId}/pdf`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deck?.title || 'deck'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(`Download failed: ${(e as Error).message}`);
    }
  }, [deckId, deck?.title]);

  const handleDelete = useCallback(async () => {
    if (!confirm('Delete this deck and all its versions?')) return;
    try {
      await apiFetch(`/decks/${deckId}`, { method: 'DELETE' });
      toast.success('Deck deleted.');
      router.push(`/companies/${companyId}/decks`);
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  }, [deckId, companyId, router]);

  const handleSwapTheme = useCallback(
    async (themeId: string) => {
      if (!deck || deck.theme_id === themeId) return;
      try {
        const updated = await apiJson<DeckDetail>(`/decks/${deckId}/theme`, {
          method: 'POST',
          body: JSON.stringify({ theme_id: themeId }),
        });
        setDeck(updated);
        await refreshPreview(updated.title);
        toast.success(`Theme: ${themeId}`);
      } catch (e) {
        toast.error(`Theme swap failed: ${(e as Error).message}`);
      }
    },
    [deck, deckId, refreshPreview],
  );

  const handleRestore = useCallback(
    async (versionNo: number) => {
      try {
        const updated = await apiJson<DeckDetail>(
          `/decks/${deckId}/restore/${versionNo}`,
          { method: 'POST' },
        );
        setDeck(updated);
        await refreshPreview(updated.title);
        toast.success(`Restored v${versionNo} as v${updated.current_version}.`);
      } catch (e) {
        toast.error(`Restore failed: ${(e as Error).message}`);
      }
    },
    [deckId, refreshPreview],
  );

  const handleAmend = useCallback(
    async (prompt: string) => {
      const updated = await apiJson<DeckDetail>(`/decks/${deckId}/amend`, {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      });
      setDeck(updated);
      await refreshPreview(updated.title);
      return updated;
    },
    [deckId, refreshPreview],
  );

  // ----- Render ----------------------------------------------------------

  if (loading || !deck) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading deck…
      </div>
    );
  }

  const slideCount = Array.isArray(deck.spec?.slides) ? deck.spec.slides.length : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-border/60 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/companies/${companyId}/decks`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Decks
          </Link>
          <div className="h-4 w-px bg-border" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight">{deck.title}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{slideCount} slides</span>
              <span className="opacity-40">•</span>
              <span className="font-mono">v{deck.current_version}</span>
              <span className="opacity-40">•</span>
              <span>{deck.theme_id}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeMenu
            themes={themes}
            currentThemeId={deck.theme_id}
            onPick={handleSwapTheme}
          />
          <VersionMenu
            versions={deck.versions}
            currentVersion={deck.current_version}
            onRestore={handleRestore}
          />
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="size-3.5" />
            PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} className="gap-1.5 text-muted-foreground hover:text-destructive">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </header>

      {/* Body: preview on top (one 16:9 slide visible), amend panel on bottom */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Preview stage — fits the largest 16:9 rectangle inside the available
            area. Container queries do the sizing math: width caps at viewport
            width OR (viewport height × 16/9), whichever is smaller, so one
            full slide is always visible without horizontal scroll. */}
        <main
          className="flex min-h-0 flex-1 items-center justify-center bg-muted/30 p-4 [container-type:size]"
        >
          <div
            className="relative overflow-hidden rounded-lg border border-border/60 bg-background shadow-inner"
            style={{
              width: 'min(100cqw, calc(100cqh * 16 / 9))',
              height: 'min(100cqh, calc(100cqw * 9 / 16))',
              maxWidth: '1280px',
            }}
          >
            {previewUrl ? (
              <iframe
                key={previewUrl}
                src={previewUrl}
                title={deck.title}
                className="block h-full w-full border-0"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Rendering preview…
              </div>
            )}
          </div>
        </main>

        {/* Amend chat — fixed-height strip across the bottom. */}
        <section className="flex h-[300px] shrink-0 flex-col border-t border-border/60">
          <AmendPanel
            versions={deck.versions}
            originalPrompt={deck.prompt}
            onSubmit={handleAmend}
          />
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme picker dropdown.
// ---------------------------------------------------------------------------

function ThemeMenu({
  themes,
  currentThemeId,
  onPick,
}: {
  themes: Theme[];
  currentThemeId: string;
  onPick: (themeId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className="gap-1.5" />}
      >
        <Palette className="size-3.5" />
        Theme
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Switch theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themes.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => onPick(t.id)}
            className="gap-2"
          >
            <div
              className="size-5 shrink-0 rounded ring-1 ring-foreground/10"
              style={{ background: t.background }}
            >
              <div
                className="m-1 h-0.5 w-3 rounded-full"
                style={{ background: t.primary }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm">{t.name}</div>
            </div>
            {t.id === currentThemeId ? <Check className="size-3.5 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Version history dropdown.
// ---------------------------------------------------------------------------

function VersionMenu({
  versions,
  currentVersion,
  onRestore,
}: {
  versions: DeckVersion[];
  currentVersion: number;
  onRestore: (versionNo: number) => void;
}) {
  const sorted = useMemo(
    () => [...versions].sort((a, b) => b.version_no - a.version_no),
    [versions],
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className="gap-1.5" />}
      >
        <History className="size-3.5" />
        History
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Version history</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sorted.length === 0 ? (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">No history yet.</div>
        ) : (
          sorted.map((v) => (
            <DropdownMenuItem
              key={v.version_no}
              onClick={() => v.version_no !== currentVersion && onRestore(v.version_no)}
              className={cn(
                'flex-col items-start gap-0.5 py-2',
                v.version_no === currentVersion && 'opacity-60',
              )}
            >
              <div className="flex w-full items-center gap-2">
                <span className="font-mono text-xs">v{v.version_no}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {v.source}
                </span>
                {v.version_no === currentVersion ? (
                  <span className="ml-auto text-[10px] text-primary">current</span>
                ) : (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <RefreshCw className="size-3" /> restore
                  </span>
                )}
              </div>
              {v.prompt ? (
                <div className="line-clamp-2 text-xs text-muted-foreground">{v.prompt}</div>
              ) : null}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Amend chat panel.
// ---------------------------------------------------------------------------

function AmendPanel({
  versions,
  originalPrompt,
  onSubmit,
}: {
  versions: DeckVersion[];
  originalPrompt: string;
  onSubmit: (prompt: string) => Promise<unknown>;
}) {
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const history = useMemo(() => {
    // Newest-last so the panel reads like a chat log.
    return [...versions].sort((a, b) => a.version_no - b.version_no);
  }, [versions]);

  const submit = useCallback(async () => {
    const text = prompt.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      await onSubmit(text);
      setPrompt('');
    } catch (e) {
      toast.error(`Amend failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }, [prompt, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void submit();
      }
    },
    [submit],
  );

  return (
    <div className="flex h-full min-h-0">
      {/* Left: input column — the primary editing surface. */}
      <div className="flex min-w-0 flex-1 flex-col border-r border-border/60">
        <div className="flex items-baseline gap-3 border-b border-border/60 px-4 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            Edit by chat
          </div>
          <p className="truncate text-xs text-muted-foreground">
            Describe a change. The prior version is kept for rollback.
          </p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-3">
          <Textarea
            placeholder='e.g. "make slide 3 punchier" / "add a slide on competitive landscape" / "drop the timeline slide"'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-0 flex-1 resize-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">⌘/Ctrl + Enter to send</span>
            <Button
              size="sm"
              disabled={!prompt.trim() || submitting}
              onClick={submit}
              className="gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Editing…
                </>
              ) : (
                <>
                  <Send className="size-3.5" /> Apply
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Right: scrollable history column. */}
      <div className="flex w-[380px] shrink-0 flex-col">
        <div className="border-b border-border/60 px-4 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            History
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-2 px-3 py-3">
            {originalPrompt ? (
              <ChatBubble role="user" prompt={originalPrompt} label="Initial prompt" />
            ) : null}
            {history
              .filter((v) => v.source === 'amend' && v.prompt)
              .map((v) => (
                <ChatBubble
                  key={v.version_no}
                  role="user"
                  prompt={v.prompt!}
                  label={`Amend → v${v.version_no}`}
                />
              ))}
            {history
              .filter((v) => v.source === 'theme_swap')
              .map((v) => (
                <SystemBubble key={`theme-${v.version_no}`}>
                  Theme swapped → <span className="font-mono">{v.theme_id}</span> (v{v.version_no})
                </SystemBubble>
              ))}
            {history
              .filter((v) => v.source === 'restore')
              .map((v) => (
                <SystemBubble key={`restore-${v.version_no}`}>Restored → v{v.version_no}</SystemBubble>
              ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function ChatBubble({
  role,
  prompt,
  label,
}: {
  role: 'user' | 'ai';
  prompt: string;
  label: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 text-xs leading-relaxed',
        role === 'user'
          ? 'border-primary/30 bg-primary/5'
          : 'border-border bg-muted/30',
      )}
    >
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
        {label}
      </div>
      <div className="whitespace-pre-wrap text-foreground/90">{prompt}</div>
    </div>
  );
}

function SystemBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border/80 px-3 py-1.5 text-[11px] text-muted-foreground">
      {children}
    </div>
  );
}
