import type { LucideIcon } from 'lucide-react';
import { Sparkles } from 'lucide-react';

interface SectionLabelProps {
  children: React.ReactNode;
  icon?: LucideIcon;
}

export function SectionLabel({ children, icon: Icon = Sparkles }: SectionLabelProps) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3 w-3 text-primary/60" />
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        {children}
      </p>
      <span className="h-px flex-1 bg-border/40" />
    </div>
  );
}
