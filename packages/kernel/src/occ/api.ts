/**
 * OpenCascade API interface.
 * This defines the contract that the OCC WASM bindings must implement.
 */

import type { Vec3 } from "@vibecad/core";

export type ShapeHandle = number;
export type FaceHandle = number;
export type EdgeHandle = number;
export type VertexHandle = number;

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export interface OccApi {
  // ============================================================================
  // Wire/Face Creation
  // ============================================================================

  /** Create a polygon wire from points */
  makePolygon(points: Vec3[]): ShapeHandle;

  /** Create a wire from edges */
  makeWire(edges: ShapeHandle[]): ShapeHandle;

  /** Create a face from a wire */
  makeFace(wire: ShapeHandle): ShapeHandle;

  // ============================================================================
  // Primary Operations (Sketch -> Solid)
  // ============================================================================

  /** Extrude a face along a direction */
  extrude(face: ShapeHandle, direction: Vec3, depth: number): ShapeHandle;

  /** Revolve a face around an axis */
  revolve(
    face: ShapeHandle,
    axisOrigin: Vec3,
    axisDir: Vec3,
    angleRad: number
  ): ShapeHandle;

  /** Sweep a profile along a path */
  sweep(profile: ShapeHandle, path: ShapeHandle): ShapeHandle;

  /** Loft between multiple profiles */
  loft(profiles: ShapeHandle[]): ShapeHandle;

  // ============================================================================
  // Boolean Operations
  // ============================================================================

  /** Union of two shapes */
  fuse(a: ShapeHandle, b: ShapeHandle): ShapeHandle;

  /** Subtraction: a - b */
  cut(a: ShapeHandle, b: ShapeHandle): ShapeHandle;

  /** Intersection of two shapes */
  intersect(a: ShapeHandle, b: ShapeHandle): ShapeHandle;

  // ============================================================================
  // Modification Operations
  // ============================================================================

  /** Fillet edges */
  fillet(shape: ShapeHandle, edges: EdgeHandle[], radius: number): ShapeHandle;

  /** Chamfer edges */
  chamfer(shape: ShapeHandle, edges: EdgeHandle[], distance: number): ShapeHandle;

  /** Shell (hollow out) a shape */
  shell(
    shape: ShapeHandle,
    facesToRemove: FaceHandle[],
    thickness: number
  ): ShapeHandle;

  // ============================================================================
  // Topology Queries
  // ============================================================================

  /** Get all faces of a shape */
  getFaces(shape: ShapeHandle): FaceHandle[];

  /** Get all edges of a shape */
  getEdges(shape: ShapeHandle): EdgeHandle[];

  /** Get all vertices of a shape */
  getVertices(shape: ShapeHandle): VertexHandle[];

  // ============================================================================
  // Geometry Queries
  // ============================================================================

  /** Get center point of a face */
  faceCenter(face: FaceHandle): Vec3;

  /** Get normal vector of a face */
  faceNormal(face: FaceHandle): Vec3;

  /** Get surface area of a face */
  faceArea(face: FaceHandle): number;

  /** Get midpoint of an edge */
  edgeMidpoint(edge: EdgeHandle): Vec3;

  /** Get length of an edge */
  edgeLength(edge: EdgeHandle): number;

  // ============================================================================
  // Meshing
  // ============================================================================

  /** Tessellate shape into triangles */
  mesh(shape: ShapeHandle, deflection: number): MeshData;

  // ============================================================================
  // Memory Management
  // ============================================================================

  /** Free a shape from memory */
  freeShape(shape: ShapeHandle): void;
}
