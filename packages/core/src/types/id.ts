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
