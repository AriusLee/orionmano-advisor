'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiJson } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const COMPANY_TYPES = [
  'Private Limited',
  'Public Limited',
  'LLP',
  'Sole Proprietorship',
  'Partnership',
  'Holding Company',
  'Other',
];

export default function CreateCompanyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    legal_name: '',
    name: '',
    registration_number: '',
    company_type: '',
    industry: '',
    country: 'Malaysia',
    website: '',
  });

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit = form.legal_name.trim().length > 0 && form.country.trim().length > 0 && !creating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.legal_name.trim()) {
      toast.error('Legal name is required');
      return;
    }
    setCreating(true);
    try {
      const company = await apiJson<{ id: string }>('/companies', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name || form.legal_name,
          legal_name: form.legal_name,
          registration_number: form.registration_number || undefined,
          company_type: form.company_type || undefined,
          industry: form.industry || undefined,
          country: form.country || 'Malaysia',
          website: form.website || undefined,
        }),
      });

      toast.success('Company created — documents can be uploaded from the action panel');
      router.push(`/companies/${company.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create company');
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.push('/companies')}
            className="mt-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors cursor-pointer hover:bg-muted hover:text-foreground"
            aria-label="Back to companies"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Create Company</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Give us the basics — AI will handle the rest.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basics */}
          <section className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-5">
            <SectionHeader label="Basics" />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Legal Name" required>
                <Input
                  value={form.legal_name}
                  onChange={(e) => update('legal_name', e.target.value)}
                  placeholder="HAAS Continuum Limited"
                  required
                />
              </Field>
              <Field label="Brand Name">
                <Input
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Smart Rental"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Registration Number">
                <Input
                  value={form.registration_number}
                  onChange={(e) => update('registration_number', e.target.value)}
                  placeholder="12345678"
                />
              </Field>
              <Field label="Company Type">
                <select
                  value={form.company_type}
                  onChange={(e) => update('company_type', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <option value="">Select type…</option>
                  {COMPANY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {/* Context */}
          <section className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-5">
            <SectionHeader label="Context" />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary Industry">
                <Input
                  value={form.industry}
                  onChange={(e) => update('industry', e.target.value)}
                  placeholder="F&B, Technology, Logistics"
                />
              </Field>
              <Field label="Country" required>
                <Input
                  value={form.country}
                  onChange={(e) => update('country', e.target.value)}
                  placeholder="Malaysia"
                  required
                />
              </Field>
            </div>

            <Field
              label="Website"
              hint={
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary/70" />
                  Leave blank — AI will look it up to auto-find the logo.
                </span>
              }
            >
              <Input
                value={form.website}
                onChange={(e) => update('website', e.target.value)}
                placeholder="https://example.com"
                type="url"
              />
            </Field>
          </section>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer"
              onClick={() => router.push('/companies')}
              disabled={creating}
            >
              Cancel
            </Button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                'group relative inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_-4px_oklch(from_var(--primary)_l_c_h_/_0.5),inset_0_1px_0_oklch(1_0_0/0.2)] transition-all duration-150',
                canSubmit
                  ? 'cursor-pointer hover:brightness-110 hover:shadow-[0_6px_20px_-4px_oklch(from_var(--primary)_l_c_h_/_0.6),inset_0_1px_0_oklch(1_0_0/0.25)] active:brightness-95 active:translate-y-px'
                  : 'opacity-60 cursor-not-allowed',
              )}
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              {creating ? 'Creating…' : 'Create Company'}
            </button>
          </div>
        </form>

        {/* Post-create hint — tells the user where uploads now live */}
        <p className="mt-6 text-[11px] text-muted-foreground/70 text-center">
          Documents can be uploaded from the Documents tab in the company action panel after creation.
        </p>
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-px flex-1 bg-border/60 max-w-[12px]" />
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <span className="h-px flex-1 bg-border/60" />
    </div>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
}

function Field({ label, required, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
