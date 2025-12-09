/**
 * @vibecad/core - Pure CAD logic library
 *
 * This package contains all the core CAD data structures and algorithms,
 * with no dependencies on UI frameworks or WASM kernels.
 */

// All types
export * from "./types";

// EDA namespaces - directly import and re-export to ensure they're available
// (export * from doesn't re-export namespace exports in ESM)
import * as SchematicNS from "./types/schematic";
import * as PcbNS from "./types/pcb";
export { SchematicNS as Schematic, PcbNS as Pcb };

// Drawing functions - explicit re-export for ESM compatibility
export { createDrawing } from "./types/drawing";

// Sketch operations
export * as sketch from "./sketch";

// Operation evaluation
export * as ops from "./ops";

// Part studio management
export * as partStudio from "./part-studio";

// Assembly management
export * as assembly from "./assembly";

// Parameter & expression system
export * as params from "./params";

// Undo/redo history
export * as history from "./history";
export type { HistoryState } from "./history";
export { createHistory, pushState, undo, redo, canUndo, canRedo } from "./history";

// Component library system
export * as library from "./library";
export { libraryProviderRegistry } from "./library/provider";
