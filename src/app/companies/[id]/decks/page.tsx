'use client';

import { use, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Presentation, BookOpen, Users, Download, Eye, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3030/api/v1';

const DECK_TYPES = [
  {
    value: 'sales_deck',
    label: 'Sales Deck',
    desc: 'Proposal deck for potential customers — presents Orionmano capabilities and engagement scope.',
    icon: Presentation,
  },
  {
    value: 'kickoff_deck',
    label: 'Kick-off Meeting Deck',
    desc: 'Engagement alignment deck — scope, timeline, team, information requirements.',
    icon: BookOpen,
  },
  {
    value: 'company_deck',
    label: 'Company Deck',
    desc: 'Full investor presentation (25-35 slides) — investment thesis, financials, market, team.',
    icon: Users,
  },
];

export default function DecksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const handlePreview = async (deckType: string, label: string) => {
    setLoading(deckType);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/companies/${id}/decks/${deckType}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to generate deck');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewLabel(label);
    } catch {
      toast.error('Failed to generate deck');
    } finally {
      setLoading(null);
    }
  };

  const handleDownload = async (deckType: string, label: string) => {
    setLoading(deckType);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/companies/${id}/decks/${deckType}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to generate deck');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${label.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download deck');
    } finally {
      setLoading(null);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewLabel('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Presentation className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Decks & Materials</h1>
          <p className="text-sm text-muted-foreground">
            Branded presentation decks generated from company data — no AI tokens needed
          </p>
        </div>
      </div>

      {/* Preview overlay */}
      {previewUrl && (
        <Card className="relative">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">{previewLabel} — Preview</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="cursor-pointer gap-1.5" onClick={() => { const a = document.createElement('a'); a.href = previewUrl; a.download = `${previewLabel.replace(/\s+/g, '_')}.pdf`; a.click(); }}>
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={closePreview}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <iframe src={previewUrl} className="w-full rounded-lg border" style={{ height: '70vh' }} />
          </CardContent>
        </Card>
      )}

      {/* Deck type cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {DECK_TYPES.map((dt) => {
          const Icon = dt.icon;
          const isLoading = loading === dt.value;
          return (
            <Card key={dt.value}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{dt.label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{dt.desc}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer gap-1.5"
                    disabled={isLoading}
                    onClick={() => handlePreview(dt.value, dt.label)}
                  >
                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer gap-1.5"
                    disabled={isLoading}
                    onClick={() => handleDownload(dt.value, dt.label)}
                  >
                    <Download className="h-3.5 w-3.5" /> Download PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
