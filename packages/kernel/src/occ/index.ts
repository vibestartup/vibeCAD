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
export type { OpenCascadeInstance } from "./loader";

// ============================================================================
// Loader
// ============================================================================

import type { OccApi } from "./api";
import { createOccStub } from "./stub";

let occInstance: OccApi | null = null;
let loadingPromise: Promise<OccApi> | null = null;

// Check if we should skip WASM loading (e.g., in dev mode with known issues)
const USE_STUB_ONLY = true; // Set to false when WASM loading is fixed

/**
 * Load the OpenCascade WASM module.
 * Returns a singleton instance.
 *
 * Note: Currently defaults to stub implementation due to Vite WASM loading issues.
 * Set USE_STUB_ONLY to false to attempt real WASM loading.
 */
export async function loadOcc(): Promise<OccApi> {
  if (occInstance) {
    return occInstance;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    // Use stub by default until WASM issues are resolved
    if (USE_STUB_ONLY) {
      console.log("[kernel] Using OCC stub implementation");
      occInstance = createOccStub();
      return occInstance;
    }

    try {
      // Try to load real OpenCascade.js
      const { loadRealOcc } = await import("./loader");
      const oc = await loadRealOcc();
      console.log("[kernel] OpenCascade.js WASM loaded successfully");
      const { OccApiImpl } = await import("./impl");
      occInstance = new OccApiImpl(oc);
      return occInstance;
    } catch (error) {
      // Fall back to stub implementation
      console.warn(
        "[kernel] Failed to load OpenCascade.js WASM, using stub:",
        error
      );
      occInstance = createOccStub();
      return occInstance;
    }
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
