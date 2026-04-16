'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const HALO_GRADIENT =
  'radial-gradient(circle at center, color-mix(in oklch, var(--primary) 22%, transparent), transparent 65%)';

const RING_GRADIENT =
  'conic-gradient(from 0deg, color-mix(in oklch, var(--primary) 65%, transparent), transparent 25%, color-mix(in oklch, var(--primary) 85%, transparent) 50%, transparent 75%, color-mix(in oklch, var(--primary) 65%, transparent))';

const ICON_INNER_GRADIENT =
  'radial-gradient(circle at 30% 20%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 65%)';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      router.push('/companies');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-16">
      {/* Drifting grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-grid-drift opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 35%, transparent 75%)',
        }}
      />

      {/* Pulsing halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 animate-halo blur-2xl"
        style={{ background: HALO_GRADIENT }}
      />

      <div className="relative flex w-full max-w-md flex-col items-center">
        {/* Floating icon block */}
        <div className="relative mb-9 animate-float">
          <div
            aria-hidden
            className="absolute -inset-2 rounded-[32px] animate-spin-slow opacity-70 blur-[1px]"
            style={{ background: RING_GRADIENT }}
          />
          <div aria-hidden className="absolute -inset-2 m-[2px] rounded-[32px] bg-background/80" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-card ring-1 ring-foreground/15 shadow-[0_24px_60px_-24px_oklch(0_0_0/0.85),inset_0_1px_0_oklch(1_0_0/0.06)]">
            <div
              aria-hidden
              className="absolute inset-0 rounded-3xl"
              style={{ background: ICON_INNER_GRADIENT }}
            />
            <Sparkles className="relative h-8 w-8 text-primary" strokeWidth={1.5} />
          </div>
        </div>

        {/* Brand lockup — Orionmano × MVPI as logos */}
        <div className="relative flex items-center gap-5">
          <Image
            src="/logo-orionmano.avif"
            alt="Orionmano"
            width={180}
            height={32}
            className="h-7 w-auto object-contain sm:h-8"
            priority
            unoptimized
          />
          <span aria-hidden className="text-xl font-light text-muted-foreground/60">×</span>
          <Image
            src="/logo-mvpi.webp"
            alt="MVPI"
            width={80}
            height={40}
            className="h-8 w-auto object-contain sm:h-10"
            priority
            unoptimized
          />
        </div>
        <p className="relative mt-3 text-center text-sm text-muted-foreground">
          Sign in to the advisory platform
        </p>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="relative mt-8 w-full rounded-2xl border border-border/60 bg-card/70 p-6 shadow-[0_24px_60px_-24px_oklch(0_0_0/0.75)] backdrop-blur-sm"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">
            No account?{' '}
            <Link href="/register" className="cursor-pointer text-primary underline-offset-4 hover:underline">
              Register
            </Link>
          </p>
        </form>

        {/* Live-status chip */}
        <div className="relative mt-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/25 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Advisory platform · Transaction-grade deliverables
        </div>
      </div>
    </div>
  );
}
