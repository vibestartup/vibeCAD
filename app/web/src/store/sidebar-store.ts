/**
 * Sidebar Store - manages sidebar tabs that can be extended by viewers.
 *
 * The left sidebar always shows Explorer (filesystem).
 * The right sidebar shows viewer-specific tabs (e.g., Properties for CAD, Draw for Image).
 * Viewers can register additional tabs when they mount.
 */

import { create } from "zustand";
import type { TabDefinition } from "../components/TabbedSidebar";

// ============================================================================
// Types
// ============================================================================

interface SidebarState {
  // Left sidebar
  leftTabs: TabDefinition[];
  leftActiveTab: string;
  leftCollapsed: boolean;

  // Right sidebar
  rightTabs: TabDefinition[];
  rightActiveTab: string;
  rightCollapsed: boolean;

  // Actions
  setLeftTabs: (tabs: TabDefinition[]) => void;
  addLeftTab: (tab: TabDefinition) => void;
  removeLeftTab: (tabId: string) => void;
  setLeftActiveTab: (tabId: string) => void;
  setLeftCollapsed: (collapsed: boolean) => void;
  toggleLeftCollapsed: () => void;

  setRightTabs: (tabs: TabDefinition[]) => void;
  addRightTab: (tab: TabDefinition) => void;
  removeRightTab: (tabId: string) => void;
  setRightActiveTab: (tabId: string) => void;
  setRightCollapsed: (collapsed: boolean) => void;
  toggleRightCollapsed: () => void;

  // Reset right tabs (called when switching document types)
  resetRightTabs: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useSidebarStore = create<SidebarState>((set, get) => ({
  // Left sidebar defaults
  leftTabs: [],
  leftActiveTab: "explorer",
  leftCollapsed: false,

  // Right sidebar defaults
  rightTabs: [],
  rightActiveTab: "",
  rightCollapsed: false,

  // Left sidebar actions
  setLeftTabs: (tabs) => set({ leftTabs: tabs }),

  addLeftTab: (tab) => set((state) => {
    if (state.leftTabs.some((t) => t.id === tab.id)) {
      return state; // Tab already exists
    }
    return { leftTabs: [...state.leftTabs, tab] };
  }),

  removeLeftTab: (tabId) => set((state) => ({
    leftTabs: state.leftTabs.filter((t) => t.id !== tabId),
  })),

  setLeftActiveTab: (tabId) => set({ leftActiveTab: tabId }),

  setLeftCollapsed: (collapsed) => set({ leftCollapsed: collapsed }),

  toggleLeftCollapsed: () => set((state) => ({ leftCollapsed: !state.leftCollapsed })),

  // Right sidebar actions
  setRightTabs: (tabs) => set({
    rightTabs: tabs,
    rightActiveTab: tabs.length > 0 ? tabs[0].id : "",
  }),

  addRightTab: (tab) => set((state) => {
    if (state.rightTabs.some((t) => t.id === tab.id)) {
      return state; // Tab already exists
    }
    const newTabs = [...state.rightTabs, tab];
    return {
      rightTabs: newTabs,
      rightActiveTab: state.rightActiveTab || tab.id,
    };
  }),

  removeRightTab: (tabId) => set((state) => {
    const newTabs = state.rightTabs.filter((t) => t.id !== tabId);
    return {
      rightTabs: newTabs,
      rightActiveTab: state.rightActiveTab === tabId
        ? (newTabs[0]?.id || "")
        : state.rightActiveTab,
    };
  }),

  setRightActiveTab: (tabId) => set({ rightActiveTab: tabId }),

  setRightCollapsed: (collapsed) => set({ rightCollapsed: collapsed }),

  toggleRightCollapsed: () => set((state) => ({ rightCollapsed: !state.rightCollapsed })),

  // Reset right tabs (viewers call this and then add their own tabs)
  resetRightTabs: () => set({ rightTabs: [], rightActiveTab: "" }),
}));
