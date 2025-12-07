/**
 * STL Export Utility
 * Converts mesh data to STL format (ASCII or binary)
 */

export interface ExportableMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  name?: string;
}

/**
 * Export mesh data to ASCII STL format
 */
export function meshToSTLAscii(meshes: ExportableMesh[], name: string = "model"): string {
  const lines: string[] = [];
  lines.push(`solid ${name}`);

  for (const mesh of meshes) {
    const { positions, normals, indices } = mesh;
    const numTriangles = indices.length / 3;

    for (let i = 0; i < numTriangles; i++) {
      const i0 = indices[i * 3];
      const i1 = indices[i * 3 + 1];
      const i2 = indices[i * 3 + 2];

      // Get vertices
      const v0 = [positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]];
      const v1 = [positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]];
      const v2 = [positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]];

      // Calculate face normal (or use provided normals)
      let normal: number[];
      if (normals.length > 0) {
        // Average the vertex normals for face normal
        const n0 = [normals[i0 * 3], normals[i0 * 3 + 1], normals[i0 * 3 + 2]];
        const n1 = [normals[i1 * 3], normals[i1 * 3 + 1], normals[i1 * 3 + 2]];
        const n2 = [normals[i2 * 3], normals[i2 * 3 + 1], normals[i2 * 3 + 2]];
        normal = [
          (n0[0] + n1[0] + n2[0]) / 3,
          (n0[1] + n1[1] + n2[1]) / 3,
          (n0[2] + n1[2] + n2[2]) / 3,
        ];
        // Normalize
        const len = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
        if (len > 0) {
          normal = [normal[0] / len, normal[1] / len, normal[2] / len];
        }
      } else {
        // Calculate from vertices
        const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
        const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
        normal = [
          e1[1] * e2[2] - e1[2] * e2[1],
          e1[2] * e2[0] - e1[0] * e2[2],
          e1[0] * e2[1] - e1[1] * e2[0],
        ];
        const len = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
        if (len > 0) {
          normal = [normal[0] / len, normal[1] / len, normal[2] / len];
        }
      }

      lines.push(`  facet normal ${normal[0].toExponential(6)} ${normal[1].toExponential(6)} ${normal[2].toExponential(6)}`);
      lines.push("    outer loop");
      lines.push(`      vertex ${v0[0].toExponential(6)} ${v0[1].toExponential(6)} ${v0[2].toExponential(6)}`);
      lines.push(`      vertex ${v1[0].toExponential(6)} ${v1[1].toExponential(6)} ${v1[2].toExponential(6)}`);
      lines.push(`      vertex ${v2[0].toExponential(6)} ${v2[1].toExponential(6)} ${v2[2].toExponential(6)}`);
      lines.push("    endloop");
      lines.push("  endfacet");
    }
  }

  lines.push(`endsolid ${name}`);
  return lines.join("\n");
}

/**
 * Export mesh data to binary STL format (more compact)
 */
export function meshToSTLBinary(meshes: ExportableMesh[]): ArrayBuffer {
  // Count total triangles
  let totalTriangles = 0;
  for (const mesh of meshes) {
    totalTriangles += mesh.indices.length / 3;
  }

  // Binary STL format:
  // 80 bytes header
  // 4 bytes: number of triangles (uint32)
  // For each triangle:
  //   12 bytes: normal (3 x float32)
  //   36 bytes: vertices (3 x 3 x float32)
  //   2 bytes: attribute byte count (uint16, usually 0)
  const bufferSize = 80 + 4 + totalTriangles * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const dataView = new DataView(buffer);

  // Write header (80 bytes, can be any text or empty)
  const header = "Binary STL exported from vibeCAD";
  for (let i = 0; i < 80; i++) {
    dataView.setUint8(i, i < header.length ? header.charCodeAt(i) : 0);
  }

  // Write triangle count
  dataView.setUint32(80, totalTriangles, true); // little-endian

  let offset = 84;

  for (const mesh of meshes) {
    const { positions, normals, indices } = mesh;
    const numTriangles = indices.length / 3;

    for (let i = 0; i < numTriangles; i++) {
      const i0 = indices[i * 3];
      const i1 = indices[i * 3 + 1];
      const i2 = indices[i * 3 + 2];

      // Get vertices
      const v0 = [positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]];
      const v1 = [positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]];
      const v2 = [positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]];

      // Calculate normal
      let normal: number[];
      if (normals.length > 0) {
        const n0 = [normals[i0 * 3], normals[i0 * 3 + 1], normals[i0 * 3 + 2]];
        const n1 = [normals[i1 * 3], normals[i1 * 3 + 1], normals[i1 * 3 + 2]];
        const n2 = [normals[i2 * 3], normals[i2 * 3 + 1], normals[i2 * 3 + 2]];
        normal = [
          (n0[0] + n1[0] + n2[0]) / 3,
          (n0[1] + n1[1] + n2[1]) / 3,
          (n0[2] + n1[2] + n2[2]) / 3,
        ];
        const len = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
        if (len > 0) {
          normal = [normal[0] / len, normal[1] / len, normal[2] / len];
        }
      } else {
        const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
        const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
        normal = [
          e1[1] * e2[2] - e1[2] * e2[1],
          e1[2] * e2[0] - e1[0] * e2[2],
          e1[0] * e2[1] - e1[1] * e2[0],
        ];
        const len = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
        if (len > 0) {
          normal = [normal[0] / len, normal[1] / len, normal[2] / len];
        }
      }

      // Write normal
      dataView.setFloat32(offset, normal[0], true);
      dataView.setFloat32(offset + 4, normal[1], true);
      dataView.setFloat32(offset + 8, normal[2], true);
      offset += 12;

      // Write vertices
      dataView.setFloat32(offset, v0[0], true);
      dataView.setFloat32(offset + 4, v0[1], true);
      dataView.setFloat32(offset + 8, v0[2], true);
      offset += 12;

      dataView.setFloat32(offset, v1[0], true);
      dataView.setFloat32(offset + 4, v1[1], true);
      dataView.setFloat32(offset + 8, v1[2], true);
      offset += 12;

      dataView.setFloat32(offset, v2[0], true);
      dataView.setFloat32(offset + 4, v2[1], true);
      dataView.setFloat32(offset + 8, v2[2], true);
      offset += 12;

      // Write attribute byte count (0)
      dataView.setUint16(offset, 0, true);
      offset += 2;
    }
  }

  return buffer;
}

/**
 * Trigger a download of a file
 */
export function downloadFile(content: string | ArrayBuffer, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export meshes to STL and download
 */
export function exportSTL(
  meshes: ExportableMesh[],
  filename: string = "model",
  binary: boolean = true
): void {
  if (meshes.length === 0) {
    console.warn("No meshes to export");
    return;
  }

  if (binary) {
    const buffer = meshToSTLBinary(meshes);
    downloadFile(buffer, `${filename}.stl`, "application/octet-stream");
  } else {
    const content = meshToSTLAscii(meshes, filename);
    downloadFile(content, `${filename}.stl`, "text/plain");
  }
}
