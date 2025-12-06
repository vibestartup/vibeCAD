/**
 * CAD Store - global state management using Zustand.
 */

import { create } from "zustand";
import type {
  Document,
  PartStudioId,
  SketchId,
  ParamEnv,
  OpId,
  Op,
  ParamId,
  Parameter,
} from "@vibecad/core";
import {
  createDocumentWithCube,
  getDefaultStudio,
  createParam,
} from "@vibecad/core";
import { history, HistoryState, createHistory, pushState, undo, redo } from "@vibecad/core";
import { params } from "@vibecad/core";
import type { Kernel } from "@vibecad/kernel";

// ============================================================================
// Store State
// ============================================================================

interface CadState {
  // Document state
  document: Document;
  historyState: HistoryState<Document>;

  // UI state
  activeStudioId: PartStudioId | null;
  activeSketchId: SketchId | null;
  selection: Set<string>;

  // Timeline state - which operation index to evaluate up to (null = all)
  timelinePosition: number | null;

  // Rebuild state
  isRebuilding: boolean;
  rebuildError: string | null;

  // Kernel reference (set after loading)
  kernel: Kernel | null;
}

interface CadActions {
  // Document actions
  setDocument: (doc: Document) => void;
  updateDocument: (updater: (doc: Document) => Document) => void;

  // UI actions
  setActiveStudio: (id: PartStudioId | null) => void;
  setActiveSketch: (id: SketchId | null) => void;
  setSelection: (ids: Set<string>) => void;
  clearSelection: () => void;
  toggleSelected: (id: string) => void;

  // Timeline actions
  setTimelinePosition: (position: number | null) => void;

  // History actions
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Rebuild
  setKernel: (kernel: Kernel) => void;
  rebuild: () => Promise<void>;

  // Operations
  updateOp: (opId: OpId, updates: Partial<Op>) => void;

  // Parameters
  addParam: (name: string, value: number, unit?: string) => void;
  updateParam: (paramId: ParamId, updates: Partial<Parameter>) => void;
  removeParam: (paramId: ParamId) => void;
}

export type CadStore = CadState & CadActions;

// ============================================================================
// Initial State
// ============================================================================

function createInitialState(): CadState {
  // Create a document with a default 10cm cube to get users started
  const document = createDocumentWithCube("Untitled");
  const defaultStudio = getDefaultStudio(document);

  return {
    document,
    historyState: createHistory(document),
    activeStudioId: defaultStudio?.id ?? null,
    activeSketchId: null,
    selection: new Set(),
    timelinePosition: null, // null = show all operations
    isRebuilding: false,
    rebuildError: null,
    kernel: null,
  };
}

// ============================================================================
// Store
// ============================================================================

export const useCadStore = create<CadStore>((set, get) => ({
  ...createInitialState(),

  // Document actions
  setDocument: (doc) => {
    set({ document: doc });
  },

  updateDocument: (updater) => {
    const { document, historyState } = get();
    const newDoc = updater(document);

    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
    });
  },

  // UI actions
  setActiveStudio: (id) => {
    set({ activeStudioId: id, activeSketchId: null });
  },

  setActiveSketch: (id) => {
    set({ activeSketchId: id });
  },

  setSelection: (ids) => {
    set({ selection: ids });
  },

  clearSelection: () => {
    set({ selection: new Set() });
  },

  toggleSelected: (id) => {
    const { selection } = get();
    const newSelection = new Set(selection);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    set({ selection: newSelection });
  },

  // Timeline actions
  setTimelinePosition: (position) => {
    set({ timelinePosition: position });
  },

  // History actions
  pushHistory: () => {
    const { document, historyState } = get();
    set({ historyState: pushState(historyState, document) });
  },

  undo: () => {
    const { historyState } = get();
    const newHistory = undo(historyState);
    set({
      historyState: newHistory,
      document: newHistory.present,
    });
  },

  redo: () => {
    const { historyState } = get();
    const newHistory = redo(historyState);
    set({
      historyState: newHistory,
      document: newHistory.present,
    });
  },

  canUndo: () => {
    const { historyState } = get();
    return historyState.past.length > 0;
  },

  canRedo: () => {
    const { historyState } = get();
    return historyState.future.length > 0;
  },

  // Rebuild
  setKernel: (kernel) => {
    set({ kernel });
  },

  rebuild: async () => {
    const { document, activeStudioId, kernel } = get();
    if (!kernel || !activeStudioId) return;

    const studio = document.partStudios.get(activeStudioId);
    if (!studio) return;

    set({ isRebuilding: true, rebuildError: null });

    try {
      // const { partStudio } = await import("@vibecad/core");
      // const rebuiltStudio = await partStudio.rebuild(studio, document.params, kernel.occ, kernel.slvs);

      // For now, just mark as done since rebuild needs actual WASM
      // TODO: Hook up real rebuild when WASM is integrated

      set({ isRebuilding: false });
    } catch (e) {
      set({
        isRebuilding: false,
        rebuildError: e instanceof Error ? e.message : String(e),
      });
    }
  },

  // Operations
  updateOp: (opId, updates) => {
    const { document, activeStudioId, historyState } = get();
    if (!activeStudioId) return;

    const studio = document.partStudios.get(activeStudioId);
    if (!studio) return;

    const opNode = studio.opGraph.get(opId);
    if (!opNode) return;

    const newOpGraph = new Map(studio.opGraph);
    newOpGraph.set(opId, { ...opNode, op: { ...opNode.op, ...updates } as Op });

    const newStudio = { ...studio, opGraph: newOpGraph };
    const newPartStudios = new Map(document.partStudios);
    newPartStudios.set(activeStudioId, newStudio);

    const newDoc = { ...document, partStudios: newPartStudios };
    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
    });
  },

  // Parameters
  addParam: (name, value, unit) => {
    const { document, historyState } = get();
    const param = createParam(name, value, unit);
    const newParams = params.addParam(document.params, param);
    const newDoc = { ...document, params: newParams };
    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
    });
  },

  updateParam: (paramId, updates) => {
    const { document, historyState } = get();
    const existingParam = document.params.params.get(paramId);
    if (!existingParam) return;

    const newParamsMap = new Map(document.params.params);
    newParamsMap.set(paramId, { ...existingParam, ...updates });

    const newParams: ParamEnv = {
      ...document.params,
      params: newParamsMap,
    };

    // Re-evaluate if expression changed
    const evaluatedParams = params.evaluateParams(newParams);

    const newDoc = { ...document, params: evaluatedParams };
    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
    });
  },

  removeParam: (paramId) => {
    const { document, historyState } = get();
    const newParams = params.removeParam(document.params, paramId);
    const newDoc = { ...document, params: newParams };
    set({
      document: newDoc,
      historyState: pushState(historyState, newDoc),
    });
  },
}));

// ============================================================================
// Selectors
// ============================================================================

export const selectDocument = (state: CadStore) => state.document;
export const selectActiveStudio = (state: CadStore) => {
  const { document, activeStudioId } = state;
  if (!activeStudioId) return null;
  return document.partStudios.get(activeStudioId) ?? null;
};
export const selectActiveSketch = (state: CadStore) => {
  const studio = selectActiveStudio(state);
  const { activeSketchId } = state;
  if (!studio || !activeSketchId) return null;
  return studio.sketches.get(activeSketchId) ?? null;
};
export const selectParams = (state: CadStore) => state.document.params;
export const selectSelection = (state: CadStore) => state.selection;
export const selectIsRebuilding = (state: CadStore) => state.isRebuilding;
export const selectTimelinePosition = (state: CadStore) => state.timelinePosition;
