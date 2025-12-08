/**
 * Branded ID types for type safety.
 * Prevents accidentally mixing IDs of different entity types.
 */

export type Id<T extends string> = string & { readonly __brand: T };

export type SketchPlaneId = Id<"SketchPlane">;
export type SketchId = Id<"Sketch">;
export type PrimitiveId = Id<"Primitive">;
export type ConstraintId = Id<"Constraint">;
export type OpId = Id<"Op">;
export type PartId = Id<"Part">;
export type PartStudioId = Id<"PartStudio">;
export type AssemblyId = Id<"Assembly">;
export type PartInstanceId = Id<"PartInstance">;
export type AssemblyConstraintId = Id<"AssemblyConstraint">;
export type ParamId = Id<"Param">;
export type DocumentId = Id<"Document">;

// Drawing IDs
export type DrawingId = Id<"Drawing">;
export type DrawingViewId = Id<"DrawingView">;
export type DrawingDimId = Id<"DrawingDim">;
export type DrawingAnnotationId = Id<"DrawingAnnotation">;

// ============================================================================
// EDA - Schematic IDs
// ============================================================================

export type SchematicDocId = Id<"SchematicDoc">;
export type SymbolId = Id<"Symbol">;
export type SymbolInstanceId = Id<"SymbolInstance">;
export type NetId = Id<"Net">;
export type PinId = Id<"Pin">;
export type WireId = Id<"Wire">;
export type BusId = Id<"Bus">;
export type SheetId = Id<"Sheet">;
export type PortId = Id<"Port">;
export type NetLabelId = Id<"NetLabel">;
export type NetClassId = Id<"NetClass">;
export type JunctionId = Id<"Junction">;

// ============================================================================
// EDA - PCB IDs
// ============================================================================

export type PcbDocId = Id<"PcbDoc">;
export type FootprintId = Id<"Footprint">;
export type FootprintInstanceId = Id<"FootprintInstance">;
export type PadId = Id<"Pad">;
export type TraceId = Id<"Trace">;
export type ViaId = Id<"Via">;
export type CopperPourId = Id<"CopperPour">;
export type LayerId = Id<"Layer">;
export type DrillId = Id<"Drill">;
export type ZoneId = Id<"Zone">;
export type KeepoutId = Id<"Keepout">;

// ============================================================================
// EDA - Component Library IDs
// ============================================================================

export type ComponentId = Id<"Component">;
export type ComponentLibraryId = Id<"ComponentLibrary">;
export type Model3dRefId = Id<"Model3dRef">;

let idCounter = 0;

/**
 * Generate a new unique ID with the given prefix.
 * IDs are globally unique within a session.
 */
export function newId<T extends string>(prefix: T): Id<T> {
  idCounter++;
  return `${prefix}_${idCounter.toString(36)}_${Date.now().toString(36)}` as Id<T>;
}

/**
 * Create an ID from an existing string (for deserialization).
 * Use with caution - prefer newId() for creating new entities.
 */
export function asId<T extends string>(value: string): Id<T> {
  return value as Id<T>;
}
