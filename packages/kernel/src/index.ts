/**
 * @vibecad/kernel - WASM bindings for CAD kernels
 *
 * This package provides TypeScript bindings to:
 * - OpenCascade (OCC) for solid modeling
 * - SolveSpace (SLVS) for constraint solving
 */

// OpenCascade
export {
  loadOcc,
  getOcc,
  createOccStub,
  type OccApi,
  type MeshData,
  type ShapeHandle,
  type FaceHandle,
  type EdgeHandle,
  type VertexHandle,
} from "./occ";

// SolveSpace
export {
  loadSlvs,
  getSlvs,
  createSlvsStub,
  type SlvsApi,
  type SolveResult,
  type GroupHandle,
  type EntityHandle,
  type ConstraintHandle,
} from "./slvs";

// ============================================================================
// Combined Loader
// ============================================================================

import { loadOcc, type OccApi } from "./occ";
import { loadSlvs, type SlvsApi } from "./slvs";

export interface Kernel {
  occ: OccApi;
  slvs: SlvsApi;
}

let kernelInstance: Kernel | null = null;

/**
 * Load both kernel modules.
 * Returns a combined kernel interface.
 */
export async function loadKernel(): Promise<Kernel> {
  if (kernelInstance) {
    return kernelInstance;
  }

  const [occ, slvs] = await Promise.all([loadOcc(), loadSlvs()]);

  kernelInstance = { occ, slvs };
  return kernelInstance;
}

/**
 * Get the loaded kernel, or null if not loaded.
 */
export function getKernel(): Kernel | null {
  return kernelInstance;
}
