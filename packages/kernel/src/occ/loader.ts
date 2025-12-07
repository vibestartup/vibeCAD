/**
 * OpenCascade.js WASM loader.
 */

// The OpenCascade.js module type
export interface OpenCascadeInstance {
  // We'll type the specific APIs we need as we use them
  [key: string]: any;
}

/**
 * Load the real OpenCascade.js WASM module.
 *
 * @internal
 */
export async function loadRealOcc(): Promise<OpenCascadeInstance> {
  // Dynamic import opencascade.js
  // The module exports { initOpenCascade } as a named export
  const occModule = await import("opencascade.js") as any;

  // Handle both named export and default export patterns
  const initFn = occModule.initOpenCascade || occModule.default?.initOpenCascade || occModule.default;

  if (typeof initFn !== 'function') {
    throw new Error('Failed to find initOpenCascade function in opencascade.js module');
  }

  const oc = await initFn();
  return oc;
}
