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
  ProjectionResult,
  ProjectedEdge2D,
  ProjectedEdgeType,
} from "./api";

export type { OpenCascadeInstance } from "./loader";

// ============================================================================
// Loader
// ============================================================================

import type { OccApi } from "./api";

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
    // Load real OpenCascade.js
    const { loadRealOcc } = await import("./loader");
    const oc = await loadRealOcc();
    console.log("[kernel] OpenCascade.js WASM loaded successfully");
    const { OccApiImpl } = await import("./impl");
    occInstance = new OccApiImpl(oc);
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

/**
 * Check if OCC is loaded.
 */
export function isOccLoaded(): boolean {
  return occInstance !== null;
}
