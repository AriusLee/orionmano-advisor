'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  Loader2,
  Plus,
  Presentation,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiFetch, apiJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// ---------------------------------------------------------------------------
// Types — mirror the FastAPI response shapes in backend/app/api/v1/decks.py.
// ---------------------------------------------------------------------------

interface DeckListItem {
  id: string;
  title: string;
  theme_id: string;
  preset: string | null;
  status: string;
  slide_count: number;
  current_version: number;
  created_at: string | null;
  updated_at: string | null;
}

interface Theme {
  id: string;
  name: string;
  description: string;
  page_size: string;
  primary: string;
  background: string;
}

interface Preset {
  id: string;
  name: string;
  prompt: string;
}

const PRESET_BLURBS: Record<string, string> = {
  sales_deck: 'Engagement proposal — services, scope, approach, next steps.',
  kickoff_deck: 'Engagement kick-off — scope, timeline, immediate next steps.',
  teaser: 'Investor teaser — company overview, highlights, transaction.',
  company_deck: 'Investor presentation — thesis, business, market, growth.',
};

// ---------------------------------------------------------------------------
// Main page.
// ---------------------------------------------------------------------------

export default function DecksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = use(params);
  const router = useRouter();

  const [decks, setDecks] = useState<DeckListItem[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [d, t, p] = await Promise.all([
        apiJson<DeckListItem[]>(`/companies/${companyId}/decks`),
        apiJson<Theme[]>(`/decks/themes`),
        apiJson<Preset[]>(`/decks/presets`),
      ]);
      setDecks(d);
      setThemes(t);
      setPresets(p);
    } catch (e) {
      toast.error(`Failed to load decks: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreated = useCallback(
    (deckId: string) => {
      setCreateOpen(false);
      router.push(`/companies/${companyId}/decks/${deckId}`);
    },
    [companyId, router],
  );

  const handleDelete = useCallback(
    async (deck: DeckListItem) => {
      if (!confirm(`Delete "${deck.title}"? Versions and history are removed too.`)) return;
      try {
        await apiFetch(`/decks/${deck.id}`, { method: 'DELETE' });
        setDecks((cur) => cur.filter((x) => x.id !== deck.id));
        toast.success('Deck deleted.');
      } catch (e) {
        toast.error(`Delete failed: ${(e as Error).message}`);
      }
    },
    [],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <header className="flex items-start justify-between border-b border-border/60 px-8 pt-7 pb-5">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Presentation className="size-3.5" />
            Decks
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Presentation decks</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Generate branded slide decks from a prompt. The AI picks layouts and content from this
            company&apos;s data. Edit any deck later by chatting with it.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="size-3.5" />
          New deck
        </Button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-auto px-8 py-8">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading decks…
          </div>
        ) : decks.length === 0 ? (
          <EmptyState onNew={() => setCreateOpen(true)} />
        ) : (
          <DeckGrid
            decks={decks}
            companyId={companyId}
            onDelete={handleDelete}
          />
        )}
      </div>

      <CreateDeckDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companyId={companyId}
        themes={themes}
        presets={presets}
        onCreated={handleCreated}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state.
// ---------------------------------------------------------------------------

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="mx-auto mt-12 max-w-xl text-center">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="size-6" />
      </div>
      <h2 className="text-xl font-semibold">No decks yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Start from a preset or write your own prompt. The AI builds an outline from this
        company&apos;s data, generates each slide, and you can keep editing by chatting with it.
      </p>
      <Button className="mt-6 gap-1.5" onClick={onNew}>
        <Plus className="size-3.5" />
        Generate first deck
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deck list grid.
// ---------------------------------------------------------------------------

function DeckGrid({
  decks,
  companyId,
  onDelete,
}: {
  decks: DeckListItem[];
  companyId: string;
  onDelete: (d: DeckListItem) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {decks.map((d) => (
        <Card key={d.id} className="group/deck relative">
          <Link
            href={`/companies/${companyId}/decks/${d.id}`}
            className="flex flex-col gap-4 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  {d.preset ? PRESET_LABEL[d.preset] ?? d.preset : 'Custom deck'}
                </div>
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{d.title}</h3>
              </div>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover/deck:translate-x-0.5" />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-mono">{d.slide_count} slides</span>
              <span className="opacity-40">•</span>
              <span className="font-mono">v{d.current_version}</span>
              <span className="opacity-40">•</span>
              <span>{formatRelative(d.updated_at ?? d.created_at)}</span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => onDelete(d)}
            aria-label="Delete deck"
            className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover/deck:opacity-100 cursor-pointer"
          >
            <Trash2 className="size-3.5" />
          </button>
        </Card>
      ))}
    </div>
  );
}

const PRESET_LABEL: Record<string, string> = {
  sales_deck: 'Sales Deck',
  kickoff_deck: 'Kick-off Deck',
  teaser: 'Teaser',
  company_deck: 'Company Deck',
};

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Create dialog — theme picker + preset chips + prompt textarea + generate.
// ---------------------------------------------------------------------------

function CreateDeckDialog({
  open,
  onOpenChange,
  companyId,
  themes,
  presets,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  themes: Theme[];
  presets: Preset[];
  onCreated: (deckId: string) => void;
}) {
  const [themeId, setThemeId] = useState<string>('');
  const [presetId, setPresetId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Default theme = first available.
  useEffect(() => {
    if (themes.length && !themeId) setThemeId(themes[0].id);
  }, [themes, themeId]);

  // Reset state when reopened.
  useEffect(() => {
    if (open) {
      setPresetId(null);
      setPrompt('');
    }
  }, [open]);

  const selectPreset = useCallback(
    (p: Preset) => {
      setPresetId((cur) => (cur === p.id ? null : p.id));
      setPrompt(p.prompt);
    },
    [],
  );

  const canSubmit = useMemo(
    () => !!themeId && (prompt.trim().length > 0 || !!presetId),
    [themeId, prompt, presetId],
  );

  const handleGenerate = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const created = await apiJson<{ id: string }>(
        `/companies/${companyId}/decks`,
        {
          method: 'POST',
          body: JSON.stringify({
            theme_id: themeId,
            prompt: prompt.trim() || null,
            preset: presetId,
          }),
        },
      );
      toast.success('Deck generated.');
      onCreated(created.id);
    } catch (e) {
      toast.error(`Generation failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, companyId, themeId, prompt, presetId, onCreated]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Generate a new deck</DialogTitle>
          <DialogDescription>
            Pick a theme, optionally start from a preset, and describe what you want. The AI builds
            it from this company&apos;s data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Theme picker */}
          <div>
            <Label className="mb-2 block">Theme</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  className={cn(
                    'group/theme flex items-center gap-3 rounded-lg border p-3 text-left transition cursor-pointer',
                    themeId === t.id
                      ? 'border-primary ring-1 ring-primary/40'
                      : 'border-border hover:border-foreground/30',
                  )}
                >
                  <div
                    className="size-10 shrink-0 rounded-md ring-1 ring-foreground/10"
                    style={{ background: t.background }}
                  >
                    <div
                      className="m-2 h-1.5 w-6 rounded-full"
                      style={{ background: t.primary }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="line-clamp-1 text-xs text-muted-foreground">
                      {t.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preset chips */}
          <div>
            <Label className="mb-2 block">Start from a preset (optional)</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPreset(p)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition cursor-pointer',
                    presetId === p.id
                      ? 'border-primary ring-1 ring-primary/40 bg-primary/5'
                      : 'border-border hover:border-foreground/30',
                  )}
                >
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {PRESET_BLURBS[p.id] ?? p.prompt.slice(0, 80)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt textarea */}
          <div>
            <Label htmlFor="prompt" className="mb-2 block">
              Prompt
            </Label>
            <Textarea
              id="prompt"
              rows={4}
              placeholder='e.g. "12-slide Series B pitch focused on APAC growth, confident data-driven tone, include market size and competitor landscape"'
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                // Editing the prompt detaches it from the preset.
                if (presetId) setPresetId(null);
              }}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              The AI grounds claims in this company&apos;s extracted documents and existing reports.
              Never fabricates financial numbers.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={!canSubmit || submitting} className="gap-1.5">
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" /> Generate deck
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
