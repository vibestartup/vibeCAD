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

// Create a box mesh with custom dimensions
function createBoxMesh(width = 1, height = 1, depth = 1, origin: Vec3 = [0, 0, 0]): MeshData {
  const [ox, oy, oz] = origin;
  const w = width;
  const h = height;
  const d = depth;

  // 24 vertices (4 per face for proper normals)
  const positions = new Float32Array([
    // Front face (z = d)
    ox, oy, oz + d, ox + w, oy, oz + d, ox + w, oy + h, oz + d, ox, oy + h, oz + d,
    // Back face (z = 0)
    ox, oy, oz, ox, oy + h, oz, ox + w, oy + h, oz, ox + w, oy, oz,
    // Top face (y = h)
    ox, oy + h, oz, ox, oy + h, oz + d, ox + w, oy + h, oz + d, ox + w, oy + h, oz,
    // Bottom face (y = 0)
    ox, oy, oz, ox + w, oy, oz, ox + w, oy, oz + d, ox, oy, oz + d,
    // Right face (x = w)
    ox + w, oy, oz, ox + w, oy + h, oz, ox + w, oy + h, oz + d, ox + w, oy, oz + d,
    // Left face (x = 0)
    ox, oy, oz, ox, oy, oz + d, ox, oy + h, oz + d, ox, oy + h, oz,
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
    mesh(shapeHandle: ShapeHandle, _deflection: number): MeshData {
      const shape = shapes.get(shapeHandle);

      // Try to create a meaningful mesh based on shape type
      if (shape?.type === "extrude") {
        const data = shape.data as { face: ShapeHandle; direction: Vec3; depth: number };
        const faceShape = shapes.get(data.face);

        if (faceShape?.type === "face") {
          const wireHandle = faceShape.data as ShapeHandle;
          const wireShape = shapes.get(wireHandle);

          if (wireShape?.type === "polygon") {
            const points = wireShape.data as Vec3[];
            // Calculate bounding box of the profile
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            for (const [x, y] of points) {
              minX = Math.min(minX, x);
              maxX = Math.max(maxX, x);
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
            }

            const width = maxX - minX;
            const height = maxY - minY;
            const depth = data.depth;

            // Create box at the correct origin
            return createBoxMesh(width, height, depth, [minX, minY, 0]);
          }
        }
      }

      // Default: 100x100x100 cube (10cm x 10cm x 10cm)
      return createBoxMesh(100, 100, 100, [0, 0, 0]);
    },

    // Import/Export
    exportSTEP(shapeHandles: ShapeHandle[], asCompound: boolean = true): string | null {
      console.warn("[OCC Stub] STEP export called but using stub implementation");

      // Generate a minimal valid STEP file header
      const timestamp = new Date().toISOString();
      const lines: string[] = [];

      lines.push("ISO-10303-21;");
      lines.push("HEADER;");
      lines.push("FILE_DESCRIPTION(('vibeCAD STEP Export (Stub Implementation)'),'2;1');");
      lines.push(`FILE_NAME('model.step','${timestamp}',(''),(''),'vibeCAD','','');`);
      lines.push("FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));");
      lines.push("ENDSEC;");
      lines.push("DATA;");
      lines.push("/* Stub implementation - no geometry data */");
      lines.push(`/* Attempted to export ${shapeHandles.length} shape(s) */`);
      lines.push(`/* As compound: ${asCompound} */`);
      lines.push("ENDSEC;");
      lines.push("END-ISO-10303-21;");

      return lines.join("\n");
    },

    exportShapeToSTEP(shape: ShapeHandle): string | null {
      return this.exportSTEP([shape], false);
    },

    // Memory
    freeShape(handle: ShapeHandle): void {
      shapes.delete(handle);
    },
  };
}
