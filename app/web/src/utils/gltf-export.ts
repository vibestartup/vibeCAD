/**
 * glTF Export Utility
 * Converts mesh data to glTF 2.0 format with embedded binary data
 */

import type { ExportableMesh } from "./stl-export";
import { downloadFile } from "./stl-export";

interface GLTFAccessor {
  bufferView: number;
  byteOffset: number;
  componentType: number;
  count: number;
  type: string;
  max?: number[];
  min?: number[];
}

interface GLTFBufferView {
  buffer: number;
  byteOffset: number;
  byteLength: number;
  target?: number;
}

interface GLTFPrimitive {
  attributes: {
    POSITION: number;
    NORMAL: number;
  };
  indices: number;
  mode?: number;
}

interface GLTFMesh {
  name: string;
  primitives: GLTFPrimitive[];
}

interface GLTFNode {
  name: string;
  mesh: number;
}

interface GLTFScene {
  nodes: number[];
}

interface GLTFBuffer {
  uri: string;
  byteLength: number;
}

interface GLTFAsset {
  version: string;
  generator: string;
}

interface GLTF {
  asset: GLTFAsset;
  scene: number;
  scenes: GLTFScene[];
  nodes: GLTFNode[];
  meshes: GLTFMesh[];
  accessors: GLTFAccessor[];
  bufferViews: GLTFBufferView[];
  buffers: GLTFBuffer[];
}

// glTF constants
const COMPONENT_TYPE_UNSIGNED_SHORT = 5123;
const COMPONENT_TYPE_UNSIGNED_INT = 5125;
const COMPONENT_TYPE_FLOAT = 5126;
const TARGET_ARRAY_BUFFER = 34962;
const TARGET_ELEMENT_ARRAY_BUFFER = 34963;
const MODE_TRIANGLES = 4;

/**
 * Calculate min/max bounds for a Float32Array (for POSITION accessors)
 */
function calculateBounds(data: Float32Array, componentCount: number): { min: number[]; max: number[] } {
  const min: number[] = new Array(componentCount).fill(Infinity);
  const max: number[] = new Array(componentCount).fill(-Infinity);

  for (let i = 0; i < data.length; i += componentCount) {
    for (let j = 0; j < componentCount; j++) {
      const value = data[i + j];
      min[j] = Math.min(min[j], value);
      max[j] = Math.max(max[j], value);
    }
  }

  return { min, max };
}

/**
 * Align offset to 4-byte boundary (required by glTF spec)
 */
function alignTo4(offset: number): number {
  return Math.ceil(offset / 4) * 4;
}

/**
 * Extract a slice of a typed array's underlying buffer as a new ArrayBuffer.
 * This handles both ArrayBuffer and SharedArrayBuffer sources.
 */
function extractBufferSlice(
  typedArray: Float32Array | Uint32Array | Uint16Array
): ArrayBuffer {
  // Create a new ArrayBuffer and copy the data
  const result = new ArrayBuffer(typedArray.byteLength);
  new Uint8Array(result).set(new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength));
  return result;
}

/**
 * Convert mesh data to glTF 2.0 format with embedded binary data
 */
export function meshToGLTF(meshes: ExportableMesh[], name: string = "model"): { json: string; bin: ArrayBuffer } {
  if (meshes.length === 0) {
    throw new Error("No meshes to export");
  }

  // Build binary buffer with all mesh data
  const bufferParts: ArrayBuffer[] = [];
  let currentOffset = 0;

  const accessors: GLTFAccessor[] = [];
  const bufferViews: GLTFBufferView[] = [];
  const gltfMeshes: GLTFMesh[] = [];
  const nodes: GLTFNode[] = [];

  for (let meshIndex = 0; meshIndex < meshes.length; meshIndex++) {
    const mesh = meshes[meshIndex];
    const { positions, normals, indices } = mesh;
    const meshName = mesh.name || `Mesh_${meshIndex}`;

    // Determine index component type based on max index value
    const maxIndex = indices.reduce((max, val) => Math.max(max, val), 0);
    const useUint32 = maxIndex > 65535;
    const indexComponentType = useUint32 ? COMPONENT_TYPE_UNSIGNED_INT : COMPONENT_TYPE_UNSIGNED_SHORT;
    const indexBytesPerElement = useUint32 ? 4 : 2;

    // Convert indices to appropriate type if needed
    let indexData: Uint16Array | Uint32Array;
    if (useUint32) {
      indexData = indices;
    } else {
      indexData = new Uint16Array(indices);
    }

    // Calculate bounds for positions
    const bounds = calculateBounds(positions, 3);

    // === POSITIONS ===
    const positionsOffset = currentOffset;
    const positionsLength = positions.byteLength;
    bufferViews.push({
      buffer: 0,
      byteOffset: positionsOffset,
      byteLength: positionsLength,
      target: TARGET_ARRAY_BUFFER,
    });
    accessors.push({
      bufferView: bufferViews.length - 1,
      byteOffset: 0,
      componentType: COMPONENT_TYPE_FLOAT,
      count: positions.length / 3,
      type: "VEC3",
      max: bounds.max,
      min: bounds.min,
    });
    const positionAccessorIndex = accessors.length - 1;
    bufferParts.push(extractBufferSlice(positions));
    currentOffset = alignTo4(currentOffset + positionsLength);

    // === NORMALS ===
    const normalsOffset = currentOffset;
    const normalsLength = normals.byteLength;
    bufferViews.push({
      buffer: 0,
      byteOffset: normalsOffset,
      byteLength: normalsLength,
      target: TARGET_ARRAY_BUFFER,
    });
    accessors.push({
      bufferView: bufferViews.length - 1,
      byteOffset: 0,
      componentType: COMPONENT_TYPE_FLOAT,
      count: normals.length / 3,
      type: "VEC3",
    });
    const normalAccessorIndex = accessors.length - 1;
    bufferParts.push(extractBufferSlice(normals));
    currentOffset = alignTo4(currentOffset + normalsLength);

    // === INDICES ===
    const indicesOffset = currentOffset;
    const indicesLength = indexData.byteLength;
    bufferViews.push({
      buffer: 0,
      byteOffset: indicesOffset,
      byteLength: indicesLength,
      target: TARGET_ELEMENT_ARRAY_BUFFER,
    });
    accessors.push({
      bufferView: bufferViews.length - 1,
      byteOffset: 0,
      componentType: indexComponentType,
      count: indexData.length,
      type: "SCALAR",
    });
    const indicesAccessorIndex = accessors.length - 1;
    bufferParts.push(extractBufferSlice(indexData));
    currentOffset = alignTo4(currentOffset + indicesLength);

    // Create glTF mesh
    gltfMeshes.push({
      name: meshName,
      primitives: [
        {
          attributes: {
            POSITION: positionAccessorIndex,
            NORMAL: normalAccessorIndex,
          },
          indices: indicesAccessorIndex,
          mode: MODE_TRIANGLES,
        },
      ],
    });

    // Create node for this mesh
    nodes.push({
      name: meshName,
      mesh: meshIndex,
    });
  }

  // Combine all buffer parts into a single ArrayBuffer
  const totalByteLength = currentOffset;
  const combinedBuffer = new Uint8Array(totalByteLength);
  let writeOffset = 0;

  for (let i = 0; i < bufferParts.length; i++) {
    const part = new Uint8Array(bufferParts[i]);
    combinedBuffer.set(part, writeOffset);
    writeOffset = alignTo4(writeOffset + part.byteLength);
  }

  // Convert to base64 for embedding
  const base64 = arrayBufferToBase64(combinedBuffer.buffer);
  const dataUri = `data:application/octet-stream;base64,${base64}`;

  // Build glTF JSON
  const gltf: GLTF = {
    asset: {
      version: "2.0",
      generator: "vibeCAD",
    },
    scene: 0,
    scenes: [
      {
        nodes: nodes.map((_, i) => i),
      },
    ],
    nodes,
    meshes: gltfMeshes,
    accessors,
    bufferViews,
    buffers: [
      {
        uri: dataUri,
        byteLength: totalByteLength,
      },
    ],
  };

  const jsonString = JSON.stringify(gltf, null, 2);
  return { json: jsonString, bin: combinedBuffer.buffer };
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 32768; // Process in chunks to avoid call stack issues

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binary);
}


/**
 * Export meshes to glTF and download as a single .gltf file with embedded binary data
 */
export function exportGLTF(meshes: ExportableMesh[], filename: string = "model"): void {
  if (meshes.length === 0) {
    console.warn("No meshes to export");
    return;
  }

  try {
    const { json } = meshToGLTF(meshes, filename);
    downloadFile(json, `${filename}.gltf`, "model/gltf+json");
  } catch (error) {
    console.error("Failed to export glTF:", error);
    throw error;
  }
}

/**
 * Export meshes to glTF with separate binary file (.gltf + .bin)
 * This is more efficient for large models but requires two files
 */
export function exportGLTFSeparate(meshes: ExportableMesh[], filename: string = "model"): void {
  if (meshes.length === 0) {
    console.warn("No meshes to export");
    return;
  }

  try {
    // Build binary buffer
    const bufferParts: ArrayBuffer[] = [];
    let currentOffset = 0;

    const accessors: GLTFAccessor[] = [];
    const bufferViews: GLTFBufferView[] = [];
    const gltfMeshes: GLTFMesh[] = [];
    const nodes: GLTFNode[] = [];

    for (let meshIndex = 0; meshIndex < meshes.length; meshIndex++) {
      const mesh = meshes[meshIndex];
      const { positions, normals, indices } = mesh;
      const meshName = mesh.name || `Mesh_${meshIndex}`;

      const maxIndex = indices.reduce((max, val) => Math.max(max, val), 0);
      const useUint32 = maxIndex > 65535;
      const indexComponentType = useUint32 ? COMPONENT_TYPE_UNSIGNED_INT : COMPONENT_TYPE_UNSIGNED_SHORT;

      let indexData: Uint16Array | Uint32Array;
      if (useUint32) {
        indexData = indices;
      } else {
        indexData = new Uint16Array(indices);
      }

      const bounds = calculateBounds(positions, 3);

      // POSITIONS
      const positionsOffset = currentOffset;
      const positionsLength = positions.byteLength;
      bufferViews.push({
        buffer: 0,
        byteOffset: positionsOffset,
        byteLength: positionsLength,
        target: TARGET_ARRAY_BUFFER,
      });
      accessors.push({
        bufferView: bufferViews.length - 1,
        byteOffset: 0,
        componentType: COMPONENT_TYPE_FLOAT,
        count: positions.length / 3,
        type: "VEC3",
        max: bounds.max,
        min: bounds.min,
      });
      const positionAccessorIndex = accessors.length - 1;
      bufferParts.push(extractBufferSlice(positions));
      currentOffset = alignTo4(currentOffset + positionsLength);

      // NORMALS
      const normalsOffset = currentOffset;
      const normalsLength = normals.byteLength;
      bufferViews.push({
        buffer: 0,
        byteOffset: normalsOffset,
        byteLength: normalsLength,
        target: TARGET_ARRAY_BUFFER,
      });
      accessors.push({
        bufferView: bufferViews.length - 1,
        byteOffset: 0,
        componentType: COMPONENT_TYPE_FLOAT,
        count: normals.length / 3,
        type: "VEC3",
      });
      const normalAccessorIndex = accessors.length - 1;
      bufferParts.push(extractBufferSlice(normals));
      currentOffset = alignTo4(currentOffset + normalsLength);

      // INDICES
      const indicesOffset = currentOffset;
      const indicesLength = indexData.byteLength;
      bufferViews.push({
        buffer: 0,
        byteOffset: indicesOffset,
        byteLength: indicesLength,
        target: TARGET_ELEMENT_ARRAY_BUFFER,
      });
      accessors.push({
        bufferView: bufferViews.length - 1,
        byteOffset: 0,
        componentType: indexComponentType,
        count: indexData.length,
        type: "SCALAR",
      });
      const indicesAccessorIndex = accessors.length - 1;
      bufferParts.push(extractBufferSlice(indexData));
      currentOffset = alignTo4(currentOffset + indicesLength);

      gltfMeshes.push({
        name: meshName,
        primitives: [
          {
            attributes: {
              POSITION: positionAccessorIndex,
              NORMAL: normalAccessorIndex,
            },
            indices: indicesAccessorIndex,
            mode: MODE_TRIANGLES,
          },
        ],
      });

      nodes.push({
        name: meshName,
        mesh: meshIndex,
      });
    }

    // Combine buffer parts
    const totalByteLength = currentOffset;
    const combinedBuffer = new Uint8Array(totalByteLength);
    let writeOffset = 0;

    for (let i = 0; i < bufferParts.length; i++) {
      const part = new Uint8Array(bufferParts[i]);
      combinedBuffer.set(part, writeOffset);
      writeOffset = alignTo4(writeOffset + part.byteLength);
    }

    // Build glTF JSON with external binary reference
    const binFilename = `${filename}.bin`;
    const gltf: GLTF = {
      asset: {
        version: "2.0",
        generator: "vibeCAD",
      },
      scene: 0,
      scenes: [
        {
          nodes: nodes.map((_, i) => i),
        },
      ],
      nodes,
      meshes: gltfMeshes,
      accessors,
      bufferViews,
      buffers: [
        {
          uri: binFilename,
          byteLength: totalByteLength,
        },
      ],
    };

    const jsonString = JSON.stringify(gltf, null, 2);

    // Download both files
    downloadFile(jsonString, `${filename}.gltf`, "model/gltf+json");
    downloadFile(combinedBuffer.buffer, binFilename, "application/octet-stream");
  } catch (error) {
    console.error("Failed to export glTF:", error);
    throw error;
  }
}
