/**
 * @vibecad/core - Pure CAD logic library
 *
 * This package contains all the core CAD data structures and algorithms,
 * with no dependencies on UI frameworks or WASM kernels.
 */

// All types
export * from "./types";

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
