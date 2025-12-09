/**
 * Geometric Constraint Solver (GCS) bindings using PlaneGCS (FreeCAD).
 */

export type {
  GcsApi,
  SolveResult,
  GroupHandle,
  EntityHandle,
  ConstraintHandle,
} from "./api";

// ============================================================================
// Loader
// ============================================================================

import type { GcsApi } from "./api";
import { GcsApiImpl } from "./impl";
import { GcsWrapper, init_planegcs_module } from "@salusoft89/planegcs";

let gcsInstance: GcsApi | null = null;
let loadingPromise: Promise<GcsApi> | null = null;
let gcsModule: any = null;

/**
 * Load the constraint solver WASM module.
 * Returns a singleton instance.
 */
export async function loadGcs(): Promise<GcsApi> {
  if (gcsInstance) {
    return gcsInstance;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    gcsModule = await init_planegcs_module();
    console.log("[kernel] PlaneGCS WASM loaded successfully");

    const gcsFactory = () => {
      const gcsSystem = new gcsModule.GcsSystem();
      return new GcsWrapper(gcsSystem);
    };

    gcsInstance = new GcsApiImpl(gcsFactory);
    return gcsInstance;
  })();

  return loadingPromise;
}

/**
 * Get the loaded GCS instance, or null if not loaded.
 */
export function getGcs(): GcsApi | null {
  return gcsInstance;
}
