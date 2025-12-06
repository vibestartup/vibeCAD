/**
 * SolveSpace constraint solver bindings.
 */

export type {
  SlvsApi,
  SolveResult,
  GroupHandle,
  EntityHandle,
  ConstraintHandle,
} from "./api";

export { createSlvsStub } from "./stub";

// ============================================================================
// Loader
// ============================================================================

import type { SlvsApi } from "./api";
import { createSlvsStub } from "./stub";

let slvsInstance: SlvsApi | null = null;
let loadingPromise: Promise<SlvsApi> | null = null;

/**
 * Load the SolveSpace WASM module.
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
    // TODO: Load actual SolveSpace WASM module
    // For now, return stub implementation
    console.warn(
      "[kernel] Using SLVS stub implementation. Real WASM not loaded."
    );
    slvsInstance = createSlvsStub();
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
