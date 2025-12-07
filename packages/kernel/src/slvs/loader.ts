/**
 * PlaneGCS WASM loader.
 * Uses FreeCAD's PlaneGCS constraint solver.
 */

import { init_planegcs_module, GcsWrapper } from "@salusoft89/planegcs";

export type PlaneGcsInstance = GcsWrapper;

let gcsInstance: PlaneGcsInstance | null = null;
let loadingPromise: Promise<PlaneGcsInstance> | null = null;

/**
 * Load the PlaneGCS WASM module.
 * @internal
 */
export async function loadPlaneGcs(): Promise<PlaneGcsInstance> {
  if (gcsInstance) {
    return gcsInstance;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const mod = await init_planegcs_module();
    const gcsSystem = new mod.GcsSystem();
    gcsInstance = new GcsWrapper(gcsSystem);
    console.log("[kernel] PlaneGCS WASM loaded successfully");
    return gcsInstance;
  })();

  return loadingPromise;
}
