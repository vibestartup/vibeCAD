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
  /** Face groups - maps OCC face index to triangle range in indices array */
  faceGroups?: { start: number; count: number }[];
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

  /** Create a face from multiple wires (outer + holes) */
  makeFaceWithHoles(outerWire: ShapeHandle, innerWires: ShapeHandle[]): ShapeHandle;

  /** Create a circular wire */
  makeCircleWire(center: Vec3, normal: Vec3, radius: number): ShapeHandle;

  /** Create an arc edge */
  makeArcEdge(center: Vec3, start: Vec3, end: Vec3, normal: Vec3): ShapeHandle;

  /** Create a line edge */
  makeLineEdge(start: Vec3, end: Vec3): ShapeHandle;

  // ============================================================================
  // Primitive Solids (Direct solid creation)
  // ============================================================================

  /** Create a box (rectangular prism) centered at a point */
  makeBox(center: Vec3, dimensions: Vec3): ShapeHandle;

  /** Create a cylinder */
  makeCylinder(
    center: Vec3,
    axis: Vec3,
    radius: number,
    height: number
  ): ShapeHandle;

  /** Create a sphere */
  makeSphere(center: Vec3, radius: number): ShapeHandle;

  /** Create a cone (or truncated cone if radius2 > 0) */
  makeCone(
    center: Vec3,
    axis: Vec3,
    radius1: number,
    radius2: number,
    height: number
  ): ShapeHandle;

  // ============================================================================
  // Transform Operations
  // ============================================================================

  /** Translate a shape by a vector */
  translate(shape: ShapeHandle, vector: Vec3): ShapeHandle;

  /** Rotate a shape around an axis */
  rotate(
    shape: ShapeHandle,
    axisOrigin: Vec3,
    axisDir: Vec3,
    angleRad: number
  ): ShapeHandle;

  /** Scale a shape uniformly from a center point */
  scale(shape: ShapeHandle, center: Vec3, factor: number): ShapeHandle;

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

  /**
   * Enhanced sweep with additional options.
   * @param profile - The profile (face or wire) to sweep
   * @param path - The path (wire or edge) to sweep along
   * @param options - Optional parameters for the sweep
   */
  sweepWithOptions(
    profile: ShapeHandle,
    path: ShapeHandle,
    options?: {
      /** Create solid (true) or shell (false). Default: true */
      solid?: boolean;
      /** Transition mode for corners: "transformed", "right", or "round" */
      transition?: "transformed" | "right" | "round";
    }
  ): ShapeHandle;

  /** Loft between multiple profiles */
  loft(profiles: ShapeHandle[]): ShapeHandle;

  /**
   * Enhanced loft with additional options.
   * @param profiles - The profiles (wires or faces) to loft between
   * @param options - Optional parameters for the loft
   */
  loftWithOptions(
    profiles: ShapeHandle[],
    options?: {
      /** Create solid (true) or shell (false). Default: true */
      solid?: boolean;
      /** Use ruled surfaces (straight lines between profiles). Default: false */
      ruled?: boolean;
      /** Close the loft (connect last to first). Default: false */
      closed?: boolean;
      /** Guide curves to control the loft shape */
      guides?: ShapeHandle[];
    }
  ): ShapeHandle;

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
  // Import/Export
  // ============================================================================

  /**
   * Export shapes to STEP format (ISO 10303-21).
   * Returns STEP file content as a string, or null on error.
   *
   * @param shapes - Array of shape handles to export
   * @param asCompound - If true and multiple shapes, export as a compound
   */
  exportSTEP(shapes: ShapeHandle[], asCompound?: boolean): string | null;

  /**
   * Export a single shape to STEP format.
   * Convenience method for exporting a single shape.
   */
  exportShapeToSTEP(shape: ShapeHandle): string | null;

  // ============================================================================
  // 2D Projection (for Drawing Views)
  // ============================================================================

  /**
   * Project a 3D shape to 2D for technical drawings using HLR (Hidden Line Removal).
   * Returns categorized 2D edges (visible, hidden, silhouette).
   *
   * @param shape - The 3D shape to project
   * @param viewDir - View direction vector (where the camera looks FROM)
   * @param upDir - Up direction vector for the view
   * @param scale - Scale factor (default 1.0)
   */
  projectTo2D(
    shape: ShapeHandle,
    viewDir: Vec3,
    upDir: Vec3,
    scale?: number
  ): ProjectionResult;

  /**
   * Create a section view by cutting a shape with a plane and projecting the result.
   * Returns the projected edges including the section cut line.
   *
   * @param shape - The 3D shape to section
   * @param planeOrigin - Origin point of the section plane
   * @param planeNormal - Normal vector of the section plane
   * @param viewDir - View direction for projection (perpendicular to plane normal for standard sections)
   * @param upDir - Up direction for the view
   * @param scale - Scale factor (default 1.0)
   */
  projectSection(
    shape: ShapeHandle,
    planeOrigin: Vec3,
    planeNormal: Vec3,
    viewDir: Vec3,
    upDir: Vec3,
    scale?: number
  ): ProjectionResult;

  // ============================================================================
  // Memory Management
  // ============================================================================

  /** Free a shape from memory */
  freeShape(shape: ShapeHandle): void;
}

// ============================================================================
// Projection Types
// ============================================================================

export type ProjectedEdgeType = "visible" | "hidden" | "silhouette" | "sewn" | "outline" | "section";

export interface ProjectedEdge2D {
  type: ProjectedEdgeType;
  /** Polyline points in 2D (already projected and scaled) */
  points: [number, number][];
}

export interface ProjectionResult {
  edges: ProjectedEdge2D[];
  boundingBox: {
    min: [number, number];
    max: [number, number];
  };
}
