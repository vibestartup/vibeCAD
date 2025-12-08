/**
 * Settings Store - user preferences stored in localStorage
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ============================================================================
// Types
// ============================================================================

export type UnitSystem = "metric" | "imperial";
export type LengthUnit = "mm" | "cm" | "m" | "in" | "ft";
export type AngleUnit = "deg" | "rad";

export interface UserSettings {
  // User info
  userName: string;

  // Unit preferences
  unitSystem: UnitSystem;
  lengthUnit: LengthUnit;
  angleUnit: AngleUnit;

  // Sketch settings
  showSketchCursor: boolean;

  // API Keys
  openaiApiKey: string;
  openaiProjectId: string;
  geminiApiKey: string;
  anthropicApiKey: string;
}

interface SettingsState extends UserSettings {
  // Actions
  setUserName: (name: string) => void;
  setUnitSystem: (system: UnitSystem) => void;
  setLengthUnit: (unit: LengthUnit) => void;
  setAngleUnit: (unit: AngleUnit) => void;
  setShowSketchCursor: (show: boolean) => void;
  setOpenaiApiKey: (key: string) => void;
  setOpenaiProjectId: (id: string) => void;
  setGeminiApiKey: (key: string) => void;
  setAnthropicApiKey: (key: string) => void;
  resetSettings: () => void;
}

// ============================================================================
// Default Settings
// ============================================================================

const defaultSettings: UserSettings = {
  userName: "",
  unitSystem: "metric",
  lengthUnit: "mm",
  angleUnit: "deg",
  showSketchCursor: false,
  openaiApiKey: "",
  openaiProjectId: "",
  geminiApiKey: "",
  anthropicApiKey: "",
};

// ============================================================================
// Store
// ============================================================================

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setUserName: (userName) => set({ userName }),
      setUnitSystem: (unitSystem) => {
        // Auto-adjust length unit when switching systems
        const lengthUnit = unitSystem === "metric" ? "mm" : "in";
        set({ unitSystem, lengthUnit });
      },
      setLengthUnit: (lengthUnit) => set({ lengthUnit }),
      setAngleUnit: (angleUnit) => set({ angleUnit }),
      setShowSketchCursor: (showSketchCursor) => set({ showSketchCursor }),
      setOpenaiApiKey: (openaiApiKey) => set({ openaiApiKey }),
      setOpenaiProjectId: (openaiProjectId) => set({ openaiProjectId }),
      setGeminiApiKey: (geminiApiKey) => set({ geminiApiKey }),
      setAnthropicApiKey: (anthropicApiKey) => set({ anthropicApiKey }),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: "vibecad-settings",
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectUserName = (state: SettingsState) => state.userName;
export const selectUnitSystem = (state: SettingsState) => state.unitSystem;
export const selectLengthUnit = (state: SettingsState) => state.lengthUnit;
export const selectAngleUnit = (state: SettingsState) => state.angleUnit;
