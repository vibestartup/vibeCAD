/**
 * Sketch planes define 2D coordinate systems in 3D space.
 */

import { SketchPlaneId, newId } from "./id";
import { Vec3, vec3 } from "./math";

export interface SketchPlane {
  id: SketchPlaneId;
  name: string;
  origin: Vec3;
  axisX: Vec3; // U direction in the plane
  axisY: Vec3; // V direction in the plane
  // Normal is implicitly cross(axisX, axisY)
}

/**
 * Get the normal vector of a sketch plane.
 */
export function planeNormal(plane: SketchPlane): Vec3 {
  return vec3.normalize(vec3.cross(plane.axisX, plane.axisY));
}

/**
 * Create a new sketch plane.
 */
export function createPlane(
  name: string,
  origin: Vec3,
  axisX: Vec3,
  axisY: Vec3
): SketchPlane {
  return {
    id: newId("SketchPlane"),
    name,
    origin,
    axisX: vec3.normalize(axisX),
    axisY: vec3.normalize(axisY),
  };
}

/**
 * Create a plane from origin and normal (generates axisX/axisY automatically).
 */
export function createPlaneFromNormal(
  name: string,
  origin: Vec3,
  normal: Vec3
): SketchPlane {
  const n = vec3.normalize(normal);

  // Find a vector not parallel to normal
  const notParallel: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];

  // Generate orthonormal basis
  const axisX = vec3.normalize(vec3.cross(notParallel, n));
  const axisY = vec3.cross(n, axisX);

  return {
    id: newId("SketchPlane"),
    name,
    origin,
    axisX,
    axisY,
  };
}

// ============================================================================
// Standard datum planes
// ============================================================================

export const DATUM_XY: SketchPlane = {
  id: "datum_xy" as SketchPlaneId,
  name: "XY Plane",
  origin: [0, 0, 0],
  axisX: [1, 0, 0],
  axisY: [0, 1, 0],
};

export const DATUM_XZ: SketchPlane = {
  id: "datum_xz" as SketchPlaneId,
  name: "XZ Plane",
  origin: [0, 0, 0],
  axisX: [1, 0, 0],
  axisY: [0, 0, 1],
};

export const DATUM_YZ: SketchPlane = {
  id: "datum_yz" as SketchPlaneId,
  name: "YZ Plane",
  origin: [0, 0, 0],
  axisX: [0, 1, 0],
  axisY: [0, 0, 1],
};

/**
 * Get all standard datum planes.
 */
export function getDatumPlanes(): Map<SketchPlaneId, SketchPlane> {
  return new Map([
    [DATUM_XY.id, DATUM_XY],
    [DATUM_XZ.id, DATUM_XZ],
    [DATUM_YZ.id, DATUM_YZ],
  ]);
}
