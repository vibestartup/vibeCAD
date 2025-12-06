/**
 * Document context - provides access to the CAD document state.
 */

import React, { createContext, useContext, useCallback, useMemo } from "react";
import type {
  Document,
  PartStudio,
  PartStudioId,
  Sketch,
  SketchId,
  OpId,
  ParamEnv,
} from "@vibecad/core";
import type { HistoryState } from "@vibecad/core";

// ============================================================================
// Context Value
// ============================================================================

interface DocumentContextValue {
  /** Current document */
  document: Document;

  /** History state for undo/redo */
  history: HistoryState<Document>;

  /** Currently active part studio */
  activeStudioId: PartStudioId | null;

  /** Currently active sketch (if editing) */
  activeSketchId: SketchId | null;

  /** Currently selected entities */
  selection: Set<string>;

  /** Whether a rebuild is in progress */
  isRebuilding: boolean;

  /** Any rebuild errors */
  rebuildError: string | null;

  // Actions
  setDocument: (doc: Document) => void;
  setActiveStudio: (id: PartStudioId | null) => void;
  setActiveSketch: (id: SketchId | null) => void;
  setSelection: (ids: Set<string>) => void;
  undo: () => void;
  redo: () => void;
  rebuild: () => Promise<void>;
}

const DocumentContext = createContext<DocumentContextValue | null>(null);

// ============================================================================
// Provider Props
// ============================================================================

interface DocumentProviderProps {
  children: React.ReactNode;
  value: DocumentContextValue;
}

export function DocumentProvider({ children, value }: DocumentProviderProps) {
  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Access the full document context.
 */
export function useDocumentContext(): DocumentContextValue {
  const ctx = useContext(DocumentContext);
  if (!ctx) {
    throw new Error("useDocumentContext must be used within DocumentProvider");
  }
  return ctx;
}

/**
 * Get the current document.
 */
export function useDocument(): Document {
  return useDocumentContext().document;
}

/**
 * Get the active part studio.
 */
export function useActiveStudio(): PartStudio | null {
  const { document, activeStudioId } = useDocumentContext();
  if (!activeStudioId) return null;
  return document.partStudios.get(activeStudioId) ?? null;
}

/**
 * Get the active sketch.
 */
export function useActiveSketch(): Sketch | null {
  const studio = useActiveStudio();
  const { activeSketchId } = useDocumentContext();
  if (!studio || !activeSketchId) return null;
  return studio.sketches.get(activeSketchId) ?? null;
}

/**
 * Get the parameter environment.
 */
export function useParams(): ParamEnv {
  return useDocument().params;
}

/**
 * Get the current selection.
 */
export function useSelection(): Set<string> {
  return useDocumentContext().selection;
}

/**
 * Check if an entity is selected.
 */
export function useIsSelected(id: string): boolean {
  const selection = useSelection();
  return selection.has(id);
}

/**
 * Get undo/redo actions.
 */
export function useHistory() {
  const { history, undo, redo } = useDocumentContext();
  const { canUndo, canRedo } = require("@vibecad/core").history;

  return {
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    undo,
    redo,
  };
}

/**
 * Get rebuild state.
 */
export function useRebuild() {
  const { isRebuilding, rebuildError, rebuild } = useDocumentContext();
  return { isRebuilding, rebuildError, rebuild };
}
