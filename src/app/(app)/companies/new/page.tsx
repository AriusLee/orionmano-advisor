'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiJson, apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Upload, Loader2, X, FileText } from 'lucide-react';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    legal_name: '',
    name: '',
    registration_number: '',
    company_type: '',
    industry: '',
    country: '',
    website: '',
  });

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

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

      // Upload files if any
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'other');
        await apiFetch(`/companies/${company.id}/documents/upload`, {
          method: 'POST',
          body: formData,
        });
      }

      toast.success('Company created');
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
      <div className="mx-auto max-w-2xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="mt-1 cursor-pointer"
            onClick={() => router.push('/companies')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Create Company</h1>
            <p className="text-sm text-muted-foreground">
              Add a new company to begin advisory analysis.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Company Details */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Company Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Legal Name <span className="text-destructive">*</span></Label>
                  <Input
                    value={form.legal_name}
                    onChange={(e) => update('legal_name', e.target.value)}
                    placeholder="e.g. HAAS Continuum Limited"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Brand Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    placeholder="e.g. Smart Rental"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Registration Number</Label>
                  <Input
                    value={form.registration_number}
                    onChange={(e) => update('registration_number', e.target.value)}
                    placeholder="e.g. 12345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company Type</Label>
                  <select
                    value={form.company_type}
                    onChange={(e) => update('company_type', e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer"
                  >
                    <option value="">Select type</option>
                    {COMPANY_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Primary Industry</Label>
                  <Input
                    value={form.industry}
                    onChange={(e) => update('industry', e.target.value)}
                    placeholder="e.g. F&B, Technology, Logistics"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country <span className="text-destructive">*</span></Label>
                  <Input
                    value={form.country}
                    onChange={(e) => update('country', e.target.value)}
                    placeholder="e.g. Malaysia"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Websites</Label>
                <Input
                  value={form.website}
                  onChange={(e) => update('website', e.target.value)}
                  placeholder="https://example.com, https://brand.com"
                />
                <p className="text-xs text-muted-foreground">Separate multiple URLs with commas</p>
              </div>
            </CardContent>
          </Card>

          {/* Company Materials */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">
                Company Materials <span className="text-muted-foreground font-normal">(optional)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={cn(
                  'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer',
                  dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium">Drop company materials here</p>
                <p className="text-xs text-muted-foreground">or click to browse files</p>
                <p className="mt-2 text-xs text-muted-foreground/70">
                  PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, images
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    setFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
                    e.target.value = '';
                  }}
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <div className="flex items-center gap-2 text-sm min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {file.size < 1048576 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / 1048576).toFixed(1)} MB`}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-destructive"
                        onClick={() => removeFile(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button type="submit" disabled={creating || !form.legal_name.trim()} className="cursor-pointer gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {creating ? 'Creating...' : 'Create Company'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => router.push('/companies')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
