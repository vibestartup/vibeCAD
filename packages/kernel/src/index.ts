/**
 * @vibecad/kernel - WASM bindings for CAD kernels
 *
 * This package provides TypeScript bindings to:
 * - OpenCascade (OCC) for solid modeling
 * - PlaneGCS (GCS) for 2D constraint solving
 */

// OpenCascade
export {
  loadOcc,
  getOcc,
  type OccApi,
  type MeshData,
  type ShapeHandle,
  type FaceHandle,
  type EdgeHandle,
  type VertexHandle,
} from "./occ";

// Geometric Constraint Solver (PlaneGCS)
export {
  loadGcs,
  getGcs,
  type GcsApi,
  type SolveResult,
  type GroupHandle,
  type EntityHandle,
  type ConstraintHandle,
} from "./gcs";

// ============================================================================
// Combined Loader
// ============================================================================

import { loadOcc, type OccApi } from "./occ";
import { loadGcs, type GcsApi } from "./gcs";

export interface Kernel {
  occ: OccApi;
  gcs: GcsApi;
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

  const [occ, gcs] = await Promise.all([loadOcc(), loadGcs()]);

  kernelInstance = { occ, gcs };
  return kernelInstance;
}

/**
 * Get the loaded kernel, or null if not loaded.
 */
export function getKernel(): Kernel | null {
  return kernelInstance;
}
