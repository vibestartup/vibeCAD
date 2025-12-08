/**
 * Core type definitions for vibeCAD.
 *
 * This module exports all fundamental types used throughout the CAD system.
 */

// IDs
export * from "./id";

// Math primitives
export * from "./math";

// Sketch planes
export * from "./plane";

// Sketch primitives (CAD sketches - not to be confused with schematic primitives)
export * from "./primitive";

// Sketch constraints
export * from "./constraint";

// Sketch aggregate
export * from "./sketch";

// Parameters
export * from "./params";

// Operations
export * from "./op";

// Part studio
export * from "./part-studio";

// Parts
export * from "./part";

// Assembly
export * from "./assembly";

// Document
export * from "./document";

// Drawing (technical drawings - explicit exports to avoid conflicts with schematic Sheet)
export {
  // Sheet config types use different names to avoid conflicts
  type SheetSize as DrawingSheetSize,
  type Sheet as DrawingSheet,
  SHEET_SIZES as DRAWING_SHEET_SIZES,
  createSheet as createDrawingSheet,
  // View types
  type ViewProjection,
  getProjectionDirection,
  getProjectionUp,
  type ProjectedEdgeType,
  type ProjectedEdge,
  type ProjectedVertex,
  type ViewProjectionResult,
  type DrawingView,
  createDrawingView,
  type ViewPointRefType,
  type ViewPointRef,
  // Dimensions
  type DimensionStyleOverrides,
  type LinearDimension,
  type DiameterDimension,
  type RadiusDimension,
  type AngleDimension,
  type DrawingDimension,
  createLinearDimension,
  // Annotations
  type TextAnnotation,
  type NoteAnnotation,
  type BalloonAnnotation,
  type CentermarkAnnotation,
  type DrawingAnnotation,
  createTextAnnotation,
  createNoteAnnotation,
  // Style
  type DimensionStyle,
  DEFAULT_DIM_STYLE,
  // Document
  type DrawingMeta,
  type Drawing,
  createDrawing,
  touchDrawing,
  addView,
  updateView,
  removeView,
  addDimension,
  updateDimension,
  removeDimension,
  addAnnotation,
  removeAnnotation,
} from "./drawing";

// ============================================================================
// EDA Types
// ============================================================================

// Re-export EDA modules as namespaces to avoid conflicts with CAD sketch types
// Consumers should import from these paths directly for full type access:
// - @vibecad/core/types/schematic
// - @vibecad/core/types/pcb
// - @vibecad/core/types/library

// Re-export the index modules (which re-export everything within)
export * as Schematic from "./schematic";
export * as Pcb from "./pcb";

// Component Library types (no conflicts)
export * from "./library";
