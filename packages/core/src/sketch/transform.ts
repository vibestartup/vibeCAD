/**
 * Coordinate transformations between sketch space and world space.
 */

import { Vec2, Vec3, vec2, vec3, SketchPlane, planeNormal } from "../types";

/**
 * Transform a 2D point in sketch space to 3D world space.
 */
export function sketchToWorld(point: Vec2, plane: SketchPlane): Vec3 {
  // world = origin + u * axisX + v * axisY
  const u = point[0];
  const v = point[1];

  return vec3.add(
    plane.origin,
    vec3.add(vec3.scale(plane.axisX, u), vec3.scale(plane.axisY, v))
  );
}

/**
 * Transform a 3D world point to 2D sketch space.
 * Projects the point onto the plane.
 */
export function worldToSketch(point: Vec3, plane: SketchPlane): Vec2 {
  // local = point - origin
  const local = vec3.sub(point, plane.origin);

  // u = local . axisX
  // v = local . axisY
  const u = vec3.dot(local, plane.axisX);
  const v = vec3.dot(local, plane.axisY);

  return [u, v];
}

/**
 * Transform a 2D direction vector in sketch space to 3D world space.
 */
export function sketchDirToWorld(dir: Vec2, plane: SketchPlane): Vec3 {
  return vec3.normalize(
    vec3.add(vec3.scale(plane.axisX, dir[0]), vec3.scale(plane.axisY, dir[1]))
  );
}

/**
 * Transform a 3D direction vector to 2D sketch space.
 */
export function worldDirToSketch(dir: Vec3, plane: SketchPlane): Vec2 {
  const u = vec3.dot(dir, plane.axisX);
  const v = vec3.dot(dir, plane.axisY);
  return vec2.normalize([u, v]);
}

/**
 * Get the extrusion direction for a sketch plane (its normal).
 */
export function getExtrudeDirection(plane: SketchPlane): Vec3 {
  return planeNormal(plane);
}

/**
 * Get the reverse extrusion direction.
 */
export function getReverseExtrudeDirection(plane: SketchPlane): Vec3 {
  return vec3.negate(planeNormal(plane));
}

/**
 * Project a 3D point onto the sketch plane.
 */
export function projectOntoPlane(point: Vec3, plane: SketchPlane): Vec3 {
  const normal = planeNormal(plane);
  const toPoint = vec3.sub(point, plane.origin);
  const dist = vec3.dot(toPoint, normal);
  return vec3.sub(point, vec3.scale(normal, dist));
}

/**
 * Get the signed distance from a point to the sketch plane.
 * Positive = in front of plane (in normal direction).
 */
export function distanceToPlane(point: Vec3, plane: SketchPlane): number {
  const normal = planeNormal(plane);
  const toPoint = vec3.sub(point, plane.origin);
  return vec3.dot(toPoint, normal);
}

/**
 * Check if a point lies on the sketch plane (within epsilon).
 */
export function isOnPlane(point: Vec3, plane: SketchPlane, epsilon = 1e-6): boolean {
  return Math.abs(distanceToPlane(point, plane)) < epsilon;
}

/**
 * Transform an array of 2D points to 3D world space.
 */
export function sketchPointsToWorld(points: Vec2[], plane: SketchPlane): Vec3[] {
  return points.map((p) => sketchToWorld(p, plane));
}

/**
 * Transform an array of 3D points to 2D sketch space.
 */
export function worldPointsToSketch(points: Vec3[], plane: SketchPlane): Vec2[] {
  return points.map((p) => worldToSketch(p, plane));
}
