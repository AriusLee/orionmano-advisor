'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiJson } from '@/lib/api';
import { CompanySidebar } from '@/components/layout/company-sidebar';
import { Topbar } from '@/components/layout/topbar';
import { ChatPanel } from '@/components/layout/chat-panel';
import { ActionPanel } from '@/components/layout/action-panel';
import { useCompanyStore } from '@/stores/company-store';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export default function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companyName, setCompanyName] = useState<string | undefined>();
  const rightPanel = useCompanyStore((s) => s.rightPanel);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      apiJson<{ name: string }>(`/companies/${id}`)
        .then((c) => setCompanyName(c.name))
        .catch(() => router.replace('/companies'));
    }
  }, [user, id, router]);

  if (loading || !user) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:block">
        <CompanySidebar companyId={id} className="h-screen" />
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <CompanySidebar companyId={id} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} companyId={id} companyName={companyName} />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto bg-muted/30 p-4 lg:p-6">
            {children}
          </main>
          {/* Action panel — always visible on md+ */}
          <div className="hidden md:block">
            <ActionPanel companyId={id} />
          </div>
        </div>
      </div>
    </div>
  );
}
