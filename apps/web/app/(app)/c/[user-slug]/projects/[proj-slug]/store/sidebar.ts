import { create } from "zustand";

interface SidebarStore {
  selectedItem: string;
  setSelectedItem: (item: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  selectedItem: "usage",
  setSelectedItem: (item) => set({ selectedItem: item }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}));
