/**
 * OpenCascade.js WASM loader.
 *
 * Note: This loader is currently disabled due to Vite WASM loading issues.
 * The stub implementation is used instead.
 */

// The OpenCascade.js module type
export interface OpenCascadeInstance {
  // We'll type the specific APIs we need as we use them
  [key: string]: any;
}

/**
 * Attempt to load the real OpenCascade.js WASM module.
 * This is separated out so it can be dynamically imported only when needed.
 *
 * @internal
 */
export async function loadRealOcc(): Promise<OpenCascadeInstance> {
  // Use a variable to prevent Vite from statically analyzing the import
  const moduleName = ["opencascade", "js"].join(".");
  const initOpenCascade = await import(/* @vite-ignore */ moduleName);
  const oc = await (initOpenCascade.default || initOpenCascade)();
  return oc;
}
