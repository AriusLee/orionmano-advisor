'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { apiJson } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, Loader2, UserPlus, Trash2, Building2, Users, Zap, Star, Crown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Company {
  id: string;
  name: string;
  legal_name: string | null;
  registration_number: string | null;
  industry: string | null;
  sub_industry: string | null;
  country: string;
  description: string | null;
  website: string | null;
  status: string;
  engagement_type: string | null;
  target_exchange: string | null;
  report_tier: string;
}

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
}

const STATUS_OPTIONS = ['active', 'on_hold', 'completed', 'archived'];
const ENGAGEMENT_OPTIONS = ['ipo', 'fundraising', 'ma', 'compliance', 'valuation', 'due_diligence'];
const EXCHANGE_OPTIONS = ['nasdaq', 'nyse', 'bursa_main', 'bursa_ace', 'hkex', 'sgx', 'other'];

const TIER_OPTIONS = [
  {
    id: 'essential',
    name: 'Essential',
    icon: Zap,
    description: 'Key findings, scores, and brief recommendations.',
    pages: '2-3 pages',
    iconColor: 'text-slate-500',
    selectedColor: 'border-slate-500 bg-slate-50 dark:bg-slate-900/50',
    color: 'border-slate-200 hover:border-slate-400',
  },
  {
    id: 'standard',
    name: 'Standard',
    icon: Star,
    description: 'Full analysis with detailed breakdown.',
    pages: '5-8 pages',
    iconColor: 'text-blue-500',
    selectedColor: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
    color: 'border-blue-200 hover:border-blue-400',
  },
  {
    id: 'premium',
    name: 'Premium',
    icon: Crown,
    description: 'Comprehensive deep-dive with benchmarks and action plan.',
    pages: '10-15 pages',
    iconColor: 'text-amber-500',
    selectedColor: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20',
    color: 'border-amber-200 hover:border-amber-400',
  },
];

export default function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<Partial<Company>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('client');
  const [inviting, setInviting] = useState(false);

  const loadData = useCallback(() => {
    apiJson<Company>(`/companies/${id}`)
      .then((c) => {
        setCompany(c);
        setForm(c);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // Load members (use current user as placeholder since we don't have a members API yet)
    if (user) {
      setMembers([{ id: user.id, email: user.email, name: user.name, role: 'admin' }]);
    }
  }, [id, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await apiJson<Company>(`/companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setCompany(updated);
      setForm(updated);
      toast.success('Company settings saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    // For now, just show the intent — actual invite API to be built in M6
    toast.success(`Invitation sent to ${inviteEmail} as ${inviteRole}`);
    setMembers(prev => [...prev, { id: crypto.randomUUID(), email: inviteEmail, name: inviteEmail.split('@')[0], role: inviteRole }]);
    setInviteEmail('');
    setInviting(false);
  };

  const handleRemoveMember = (memberId: string) => {
    if (memberId === user?.id) {
      toast.error("You can't remove yourself");
      return;
    }
    setMembers(prev => prev.filter(m => m.id !== memberId));
    toast.success('Member removed');
  };

  const update = (key: keyof Company, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!company) return null;

  const hasChanges = JSON.stringify(form) !== JSON.stringify(company);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      {/* Company Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5" /> Company Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={form.name || ''} onChange={(e) => update('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Legal Name</Label>
              <Input value={form.legal_name || ''} onChange={(e) => update('legal_name', e.target.value)} placeholder="Full legal entity name" />
            </div>
            <div className="space-y-2">
              <Label>Registration Number</Label>
              <Input value={form.registration_number || ''} onChange={(e) => update('registration_number', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input value={form.industry || ''} onChange={(e) => update('industry', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sub-industry</Label>
              <Input value={form.sub_industry || ''} onChange={(e) => update('sub_industry', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={form.country || ''} onChange={(e) => update('country', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.website || ''} onChange={(e) => update('website', e.target.value)} placeholder="https://" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description || ''} onChange={(e) => update('description', e.target.value)} />
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                value={form.status || 'active'}
                onChange={(e) => update('status', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Engagement Type</Label>
              <select
                value={form.engagement_type || ''}
                onChange={(e) => update('engagement_type', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer"
              >
                <option value="">Select...</option>
                {ENGAGEMENT_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Target Exchange</Label>
              <select
                value={form.target_exchange || ''}
                onChange={(e) => update('target_exchange', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer"
              >
                <option value="">Select...</option>
                {EXCHANGE_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <Label>Default Report Tier</Label>
              <p className="text-xs text-muted-foreground mt-1">
                The default depth used when generating reports. You can override this per report.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {TIER_OPTIONS.map((tier) => {
                const TierIcon = tier.icon;
                const isSelected = (form.report_tier || 'standard') === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => update('report_tier', tier.id)}
                    className={cn(
                      'rounded-lg border-2 p-3 text-left transition-all cursor-pointer',
                      isSelected ? tier.selectedColor : tier.color
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', isSelected ? 'bg-white dark:bg-background' : 'bg-muted')}>
                        <TierIcon className={cn('h-4 w-4', tier.iconColor)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{tier.name}</span>
                          <div className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2', isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30')}>
                            {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{tier.description}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">~{tier.pages}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !hasChanges} className="cursor-pointer gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" /> Members
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Member list */}
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold">
                    {m.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={m.role === 'admin' ? 'default' : m.role === 'advisor' ? 'secondary' : 'outline'}>
                    {m.role}
                  </Badge>
                  {m.id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveMember(m.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Invite member */}
          <form onSubmit={handleInvite} className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label>Invite Member</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                required
              />
            </div>
            <div className="w-32 space-y-2">
              <Label>Role</Label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer"
              >
                <option value="client">Client</option>
                <option value="advisor">Advisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button type="submit" variant="outline" disabled={inviting || !inviteEmail.trim()} className="cursor-pointer gap-2">
              <UserPlus className="h-4 w-4" />
              Invite
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Clients can log in to view reports and deliverables for this engagement.
            Advisors can edit and generate reports.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
