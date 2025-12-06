/**
 * OpenCascade kernel bindings.
 */

export type {
  OccApi,
  MeshData,
  ShapeHandle,
  FaceHandle,
  EdgeHandle,
  VertexHandle,
} from "./api";

export { createOccStub } from "./stub";

// ============================================================================
// Loader
// ============================================================================

import type { OccApi } from "./api";
import { createOccStub } from "./stub";

let occInstance: OccApi | null = null;
let loadingPromise: Promise<OccApi> | null = null;

/**
 * Load the OpenCascade WASM module.
 * Returns a singleton instance.
 */
export async function loadOcc(): Promise<OccApi> {
  if (occInstance) {
    return occInstance;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    // TODO: Load actual OCC.js WASM module
    // For now, return stub implementation
    console.warn(
      "[kernel] Using OCC stub implementation. Real WASM not loaded."
    );
    occInstance = createOccStub();
    return occInstance;
  })();

  return loadingPromise;
}

/**
 * Get the loaded OCC instance, or null if not loaded.
 */
export function getOcc(): OccApi | null {
  return occInstance;
}
