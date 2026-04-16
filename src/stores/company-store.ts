import { create } from 'zustand';

type RightPanel = 'chat' | 'reports' | null;

interface CompanyStore {
  rightPanel: RightPanel;
  reportModuleFilter: string | null;
  reportTierFilter: string | null;
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;
  openReports: (moduleFilter?: string) => void;
  closeReports: () => void;
  toggleReports: () => void;
  setReportModuleFilter: (filter: string | null) => void;
  setReportTierFilter: (filter: string | null) => void;
}

export const useCompanyStore = create<CompanyStore>((set) => ({
  rightPanel: 'reports' as RightPanel,
  reportModuleFilter: null,
  reportTierFilter: null,

  toggleChat: () =>
    set((s) => {
      if (s.rightPanel === 'chat') return { rightPanel: null };
      return { rightPanel: 'chat' };
    }),

  setChatOpen: (open) =>
    set({ rightPanel: open ? 'chat' : null }),

  openReports: (moduleFilter) =>
    set({
      rightPanel: 'reports',
      ...(moduleFilter !== undefined ? { reportModuleFilter: moduleFilter ?? null } : {}),
    }),

  closeReports: () =>
    set({ rightPanel: null }),

  toggleReports: () =>
    set((s) => {
      if (s.rightPanel === 'reports') return { rightPanel: null };
      return { rightPanel: 'reports', reportModuleFilter: null };
    }),

  setReportModuleFilter: (filter) => set({ reportModuleFilter: filter }),
  setReportTierFilter: (filter) => set({ reportTierFilter: filter }),
}));
