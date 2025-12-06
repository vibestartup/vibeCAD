/**
 * OpenCascade.js WASM loader.
 */

// The OpenCascade.js module type
export interface OpenCascadeInstance {
  // We'll type the specific APIs we need as we use them
  [key: string]: any;
}

let occInstance: OpenCascadeInstance | null = null;
let loadingPromise: Promise<OpenCascadeInstance> | null = null;

/**
 * Load the OpenCascade.js WASM module.
 * Returns cached instance if already loaded.
 */
export async function loadOcc(): Promise<OpenCascadeInstance> {
  if (occInstance) {
    return occInstance;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      // Dynamic import of opencascade.js
      const initOpenCascade = await import("opencascade.js");

      // Initialize the WASM module
      const oc = await (initOpenCascade.default || initOpenCascade)();

      occInstance = oc;
      return oc;
    } catch (error) {
      loadingPromise = null;
      throw new Error(`Failed to load OpenCascade.js: ${error}`);
    }
  })();

  return loadingPromise;
}

/**
 * Check if OCC is loaded.
 */
export function isOccLoaded(): boolean {
  return occInstance !== null;
}

/**
 * Get the OCC instance (throws if not loaded).
 */
export function getOcc(): OpenCascadeInstance {
  if (!occInstance) {
    throw new Error("OpenCascade.js not loaded. Call loadOcc() first.");
  }
  return occInstance;
}
