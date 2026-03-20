'use client';

import { useState, useEffect } from 'react';
import { Menu, LogOut, User, MessageSquare } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCompanyStore } from '@/stores/company-store';
import { CompanySelector } from '@/components/layout/company-selector';

interface TopbarProps {
  onMenuClick: () => void;
  companyId?: string;
  companyName?: string;
}

export function Topbar({ onMenuClick, companyId, companyName }: TopbarProps) {
  const { user, logout } = useAuth();
  const { rightPanel, toggleChat } = useCompanyStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden cursor-pointer"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Left: brand + company selector */}
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-bold tracking-wider">ORIONMANO</h1>
        {companyId && <CompanySelector companyId={companyId} companyName={companyName} />}
      </div>

      <div className="flex-1" />

      {/* Right: chat toggle + user menu */}
      <div className="flex items-center gap-2">
        {companyId && (
          <Button
            variant={rightPanel === 'chat' ? 'secondary' : 'ghost'}
            size="icon"
            className="cursor-pointer"
            onClick={toggleChat}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        )}

        {mounted && (
          <Popover>
            <PopoverTrigger className="relative flex h-8 w-8 items-center justify-center rounded-full cursor-pointer hover:bg-muted transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{user?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <div className="my-1 h-px bg-border" />
              <button
                disabled
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              >
                <User className="h-4 w-4" /> Profile
              </button>
              <div className="my-1 h-px bg-border" />
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </header>
  );
}
