/**
 * OBJ (Wavefront) Export Utility
 * Converts mesh data to OBJ format
 */

import type { ExportableMesh } from "./stl-export";
import { downloadFile } from "./stl-export";

/**
 * Convert mesh data to OBJ format
 * @param meshes Array of meshes to export
 * @param name Optional name for the model (used in comments)
 * @returns OBJ format string
 */
export function meshToOBJ(meshes: ExportableMesh[], name: string = "model"): string {
  const lines: string[] = [];

  // Header comment
  lines.push("# Wavefront OBJ exported from vibeCAD");
  lines.push(`# Model: ${name}`);
  lines.push(`# Meshes: ${meshes.length}`);
  lines.push("");

  let vertexOffset = 0;
  let normalOffset = 0;

  for (const mesh of meshes) {
    const { positions, normals, indices, name: meshName } = mesh;

    // Object/group name
    if (meshName) {
      lines.push(`o ${meshName}`);
      lines.push(`g ${meshName}`);
    }

    // Write vertices
    const numVertices = positions.length / 3;
    for (let i = 0; i < numVertices; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      lines.push(`v ${x} ${y} ${z}`);
    }

    // Write normals
    const numNormals = normals.length / 3;
    for (let i = 0; i < numNormals; i++) {
      const nx = normals[i * 3];
      const ny = normals[i * 3 + 1];
      const nz = normals[i * 3 + 2];
      lines.push(`vn ${nx} ${ny} ${nz}`);
    }

    // Write faces
    // OBJ indices are 1-based, not 0-based
    const numTriangles = indices.length / 3;
    for (let i = 0; i < numTriangles; i++) {
      const i0 = indices[i * 3] + 1 + vertexOffset;
      const i1 = indices[i * 3 + 1] + 1 + vertexOffset;
      const i2 = indices[i * 3 + 2] + 1 + vertexOffset;

      // Format: f v1//vn1 v2//vn2 v3//vn3 (vertex//normal)
      // We're using the same indices for vertices and normals
      const n0 = indices[i * 3] + 1 + normalOffset;
      const n1 = indices[i * 3 + 1] + 1 + normalOffset;
      const n2 = indices[i * 3 + 2] + 1 + normalOffset;

      lines.push(`f ${i0}//${n0} ${i1}//${n1} ${i2}//${n2}`);
    }

    // Update offsets for next mesh
    vertexOffset += numVertices;
    normalOffset += numNormals;

    lines.push(""); // Empty line between meshes
  }

  return lines.join("\n");
}

/**
 * Export meshes to OBJ format and trigger download
 * @param meshes Array of meshes to export
 * @param filename Base filename (without extension)
 */
export function exportOBJ(meshes: ExportableMesh[], filename: string = "model"): void {
  if (meshes.length === 0) {
    console.warn("No meshes to export");
    return;
  }

  const content = meshToOBJ(meshes, filename);
  downloadFile(content, `${filename}.obj`, "text/plain");
}
