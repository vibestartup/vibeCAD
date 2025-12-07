/**
 * Constraint solver bindings using PlaneGCS (FreeCAD).
 */

export type {
  SlvsApi,
  SolveResult,
  GroupHandle,
  EntityHandle,
  ConstraintHandle,
} from "./api";

export type { PlaneGcsInstance } from "./loader";

// ============================================================================
// Loader
// ============================================================================

import type { SlvsApi } from "./api";
import { SlvsApiImpl } from "./impl";
import { GcsWrapper, init_planegcs_module } from "@salusoft89/planegcs";

let slvsInstance: SlvsApi | null = null;
let loadingPromise: Promise<SlvsApi> | null = null;
let gcsModule: any = null;

/**
 * Load the constraint solver WASM module.
 * Returns a singleton instance.
 */
export async function loadSlvs(): Promise<SlvsApi> {
  if (slvsInstance) {
    return slvsInstance;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    // Load PlaneGCS module
    gcsModule = await init_planegcs_module();
    console.log("[kernel] PlaneGCS WASM loaded successfully");

    // Create a factory that creates new GcsWrapper instances
    const gcsFactory = () => {
      const gcsSystem = new gcsModule.GcsSystem();
      return new GcsWrapper(gcsSystem);
    };

    slvsInstance = new SlvsApiImpl(gcsFactory);
    return slvsInstance;
  })();

  return loadingPromise;
}

/**
 * Get the loaded SLVS instance, or null if not loaded.
 */
export function getSlvs(): SlvsApi | null {
  return slvsInstance;
}
