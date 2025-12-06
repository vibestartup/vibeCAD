/**
 * Part - a materialized solid with material properties.
 */

import { OpId, PartId, PartStudioId, newId } from "./id";
import { Vec3 } from "./math";
import { Mesh } from "./part-studio";

// ============================================================================
// Material
// ============================================================================

export interface Material {
  /** RGB color (0-1 range) */
  color: Vec3;
  /** Metalness (0-1, 0 = dielectric, 1 = metal) */
  metalness: number;
  /** Roughness (0-1, 0 = smooth/glossy, 1 = rough/matte) */
  roughness: number;
  /** Opacity (0-1, 0 = transparent, 1 = opaque) */
  opacity: number;
}

export const DEFAULT_MATERIAL: Material = {
  color: [0.7, 0.7, 0.8],
  metalness: 0.1,
  roughness: 0.5,
  opacity: 1.0,
};

export const MATERIALS = {
  steel: {
    color: [0.8, 0.8, 0.85],
    metalness: 0.9,
    roughness: 0.4,
    opacity: 1.0,
  } as Material,

  aluminum: {
    color: [0.9, 0.9, 0.92],
    metalness: 0.8,
    roughness: 0.3,
    opacity: 1.0,
  } as Material,

  brass: {
    color: [0.85, 0.65, 0.2],
    metalness: 0.9,
    roughness: 0.3,
    opacity: 1.0,
  } as Material,

  plastic: {
    color: [0.3, 0.3, 0.35],
    metalness: 0.0,
    roughness: 0.6,
    opacity: 1.0,
  } as Material,

  glass: {
    color: [0.9, 0.95, 1.0],
    metalness: 0.0,
    roughness: 0.1,
    opacity: 0.3,
  } as Material,

  wood: {
    color: [0.6, 0.4, 0.2],
    metalness: 0.0,
    roughness: 0.8,
    opacity: 1.0,
  } as Material,
};

// ============================================================================
// Part
// ============================================================================

export interface Part {
  id: PartId;
  name: string;

  /** Which part studio this part comes from */
  studioId: PartStudioId;

  /** Which operation produces this part's final geometry */
  finalOpId: OpId;

  /** Material properties */
  material: Material;

  // === Cached for rendering ===

  /** Cached mesh (copied from OpResult) */
  mesh?: Mesh;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new part from a part studio operation.
 */
export function createPart(
  name: string,
  studioId: PartStudioId,
  finalOpId: OpId,
  material: Material = DEFAULT_MATERIAL
): Part {
  return {
    id: newId("Part"),
    name,
    studioId,
    finalOpId,
    material,
  };
}

/**
 * Create a copy of a part with a new ID.
 */
export function clonePart(part: Part): Part {
  return {
    ...part,
    id: newId("Part"),
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Update part material.
 */
export function setPartMaterial(part: Part, material: Material): Part {
  return { ...part, material };
}

/**
 * Update part mesh cache.
 */
export function setPartMesh(part: Part, mesh: Mesh): Part {
  return { ...part, mesh };
}
