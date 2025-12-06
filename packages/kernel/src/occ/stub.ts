/**
 * Stub implementation of OCC API for development/testing.
 * Returns placeholder data that allows the system to run without real WASM.
 */

import type { Vec3 } from "@vibecad/core";
import type { OccApi, MeshData, ShapeHandle } from "./api";

let handleCounter = 0;

function nextHandle(): ShapeHandle {
  return ++handleCounter;
}

// Simple cube mesh for testing
function createCubeMesh(size = 1): MeshData {
  const h = size / 2;

  // 8 vertices of a cube
  const positions = new Float32Array([
    // Front face
    -h, -h, h, h, -h, h, h, h, h, -h, h, h,
    // Back face
    -h, -h, -h, -h, h, -h, h, h, -h, h, -h, -h,
    // Top face
    -h, h, -h, -h, h, h, h, h, h, h, h, -h,
    // Bottom face
    -h, -h, -h, h, -h, -h, h, -h, h, -h, -h, h,
    // Right face
    h, -h, -h, h, h, -h, h, h, h, h, -h, h,
    // Left face
    -h, -h, -h, -h, -h, h, -h, h, h, -h, h, -h,
  ]);

  const normals = new Float32Array([
    // Front
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    // Back
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    // Top
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    // Bottom
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    // Right
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    // Left
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ]);

  const indices = new Uint32Array([
    0, 1, 2, 0, 2, 3, // front
    4, 5, 6, 4, 6, 7, // back
    8, 9, 10, 8, 10, 11, // top
    12, 13, 14, 12, 14, 15, // bottom
    16, 17, 18, 16, 18, 19, // right
    20, 21, 22, 20, 22, 23, // left
  ]);

  return { positions, normals, indices };
}

export function createOccStub(): OccApi {
  const shapes = new Map<ShapeHandle, { type: string; data: unknown }>();

  return {
    // Wire/Face
    makePolygon(points: Vec3[]): ShapeHandle {
      const handle = nextHandle();
      shapes.set(handle, { type: "polygon", data: points });
      return handle;
    },

    makeWire(edges: ShapeHandle[]): ShapeHandle {
      const handle = nextHandle();
      shapes.set(handle, { type: "wire", data: edges });
      return handle;
    },

    makeFace(wire: ShapeHandle): ShapeHandle {
      const handle = nextHandle();
      shapes.set(handle, { type: "face", data: wire });
      return handle;
    },

    // Primary ops
    extrude(face: ShapeHandle, direction: Vec3, depth: number): ShapeHandle {
      const handle = nextHandle();
      shapes.set(handle, { type: "extrude", data: { face, direction, depth } });
      return handle;
    },

    revolve(
      face: ShapeHandle,
      axisOrigin: Vec3,
      axisDir: Vec3,
      angleRad: number
    ): ShapeHandle {
      const handle = nextHandle();
      shapes.set(handle, {
        type: "revolve",
        data: { face, axisOrigin, axisDir, angleRad },
      });
      return handle;
    },

    sweep(profile: ShapeHandle, path: ShapeHandle): ShapeHandle {
      const handle = nextHandle();
      shapes.set(handle, { type: "sweep", data: { profile, path } });
      return handle;
    },

    loft(profiles: ShapeHandle[]): ShapeHandle {
      const handle = nextHandle();
      shapes.set(handle, { type: "loft", data: profiles });
      return handle;
    },

    // Boolean ops
    fuse(a: ShapeHandle, b: ShapeHandle): ShapeHandle {
      const handle = nextHandle();
      shapes.set(handle, { type: "fuse", data: { a, b } });
      return handle;
    },

    cut(a: ShapeHandle, b: ShapeHandle): ShapeHandle {
      const handle = nextHandle();
      shapes.set(handle, { type: "cut", data: { a, b } });
      return handle;
    },

    intersect(a: ShapeHandle, b: ShapeHandle): ShapeHandle {
      const handle = nextHandle();
      shapes.set(handle, { type: "intersect", data: { a, b } });
      return handle;
    },

    // Modification ops
    fillet(shape: ShapeHandle, edges: number[], radius: number): ShapeHandle {
      const handle = nextHandle();
      shapes.set(handle, { type: "fillet", data: { shape, edges, radius } });
      return handle;
    },

    chamfer(shape: ShapeHandle, edges: number[], distance: number): ShapeHandle {
      const handle = nextHandle();
      shapes.set(handle, { type: "chamfer", data: { shape, edges, distance } });
      return handle;
    },

    shell(
      shape: ShapeHandle,
      facesToRemove: number[],
      thickness: number
    ): ShapeHandle {
      const handle = nextHandle();
      shapes.set(handle, {
        type: "shell",
        data: { shape, facesToRemove, thickness },
      });
      return handle;
    },

    // Topology queries (return stub data)
    getFaces(_shape: ShapeHandle): number[] {
      return [1, 2, 3, 4, 5, 6]; // 6 faces of a cube
    },

    getEdges(_shape: ShapeHandle): number[] {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // 12 edges of a cube
    },

    getVertices(_shape: ShapeHandle): number[] {
      return [1, 2, 3, 4, 5, 6, 7, 8]; // 8 vertices of a cube
    },

    // Geometry queries (return stub data)
    faceCenter(_face: number): Vec3 {
      return [0, 0, 0];
    },

    faceNormal(_face: number): Vec3 {
      return [0, 0, 1];
    },

    faceArea(_face: number): number {
      return 1;
    },

    edgeMidpoint(_edge: number): Vec3 {
      return [0, 0, 0];
    },

    edgeLength(_edge: number): number {
      return 1;
    },

    // Meshing
    mesh(_shape: ShapeHandle, _deflection: number): MeshData {
      return createCubeMesh(10);
    },

    // Memory
    freeShape(handle: ShapeHandle): void {
      shapes.delete(handle);
    },
  };
}
