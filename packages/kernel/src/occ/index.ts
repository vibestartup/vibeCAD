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
export { OccApiImpl } from "./impl";
export type { OpenCascadeInstance } from "./loader";

// ============================================================================
// Loader
// ============================================================================

import type { OccApi } from "./api";
import { createOccStub } from "./stub";
import { OccApiImpl } from "./impl";

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
    try {
      // Try to load real OpenCascade.js
      const initOpenCascade = await import("opencascade.js");
      const oc = await (initOpenCascade.default || initOpenCascade)();
      console.log("[kernel] OpenCascade.js WASM loaded successfully");
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
