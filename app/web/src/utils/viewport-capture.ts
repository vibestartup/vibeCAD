/**
 * Viewport Capture Utility - captures the 3D viewport as an image
 */

export interface CaptureOptions {
  width: number;
  height: number;
  backgroundColor: string;
  transparentBackground: boolean;
  antialiasing: boolean;
  pixelRatio: number;
}

export const DEFAULT_CAPTURE_OPTIONS: CaptureOptions = {
  width: 1920,
  height: 1080,
  backgroundColor: "#0f0f1a",
  transparentBackground: false,
  antialiasing: true,
  pixelRatio: 2,
};

export interface CaptureResult {
  dataUrl: string;
  width: number;
  height: number;
  timestamp: number;
}

/**
 * Capture the viewport canvas as a data URL
 * This function finds the WebGL canvas in the viewport and captures it
 */
export function captureViewport(
  options: Partial<CaptureOptions> = {}
): CaptureResult | null {
  const opts = { ...DEFAULT_CAPTURE_OPTIONS, ...options };

  // Find all Three.js canvases and select the largest (main viewport, not ViewCube)
  const allCanvases = document.querySelectorAll("canvas");
  const threeCanvases = Array.from(allCanvases).filter(
    (c) => c.getAttribute("data-engine")?.startsWith("three.js")
  ) as HTMLCanvasElement[];

  // Sort by size (width * height) descending and pick the largest
  threeCanvases.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  const targetCanvas = threeCanvases[0] || null;

  if (!targetCanvas) {
    console.error("[Capture] No canvas found in viewport");
    return null;
  }

  try {
    const dataUrl = targetCanvas.toDataURL("image/png", 1.0);

    console.log("[Capture] Captured viewport:", targetCanvas.width, "x", targetCanvas.height);

    return {
      dataUrl,
      width: targetCanvas.width,
      height: targetCanvas.height,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error("[Capture] Failed to capture canvas:", err);
    return null;
  }
}

/**
 * Capture viewport with custom resolution by rendering to an offscreen canvas
 * Note: This requires access to the Three.js renderer, which must be passed in
 */
export function captureViewportHighRes(
  renderer: any, // THREE.WebGLRenderer
  scene: any, // THREE.Scene
  camera: any, // THREE.Camera
  options: Partial<CaptureOptions> = {}
): CaptureResult | null {
  const opts = { ...DEFAULT_CAPTURE_OPTIONS, ...options };

  if (!renderer || !scene || !camera) {
    console.error("[Capture] Missing renderer, scene, or camera");
    return null;
  }

  try {
    // Store original size
    const originalSize = renderer.getSize({ width: 0, height: 0 });
    const originalPixelRatio = renderer.getPixelRatio();

    // Set new size for high-res capture
    renderer.setSize(opts.width, opts.height);
    renderer.setPixelRatio(opts.pixelRatio);

    // Handle background
    const originalClearColor = renderer.getClearColor({ r: 0, g: 0, b: 0 });
    const originalClearAlpha = renderer.getClearAlpha();

    if (opts.transparentBackground) {
      renderer.setClearColor(0x000000, 0);
    } else {
      // Parse hex color
      const color = parseInt(opts.backgroundColor.replace("#", ""), 16);
      renderer.setClearColor(color, 1);
    }

    // Render
    renderer.render(scene, camera);

    // Capture
    const dataUrl = renderer.domElement.toDataURL("image/png", 1.0);

    // Restore original settings
    renderer.setSize(originalSize.width, originalSize.height);
    renderer.setPixelRatio(originalPixelRatio);
    renderer.setClearColor(originalClearColor, originalClearAlpha);

    // Re-render with original settings
    renderer.render(scene, camera);

    return {
      dataUrl,
      width: opts.width * opts.pixelRatio,
      height: opts.height * opts.pixelRatio,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error("[Capture] Failed to capture high-res:", err);
    return null;
  }
}

/**
 * Download a captured image
 */
export function downloadCapture(
  capture: CaptureResult,
  filename: string = "render"
): void {
  const link = document.createElement("a");
  link.href = capture.dataUrl;
  link.download = `${filename}_${capture.width}x${capture.height}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Get data URL size in bytes (approximate)
 */
export function getDataUrlSize(dataUrl: string): number {
  // Remove data URL prefix to get base64 content
  const base64 = dataUrl.split(",")[1] || "";
  // Base64 encodes 3 bytes into 4 characters
  return Math.round((base64.length * 3) / 4);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Capture a thumbnail of the viewport for project storage
 * Returns a small, compressed image suitable for localStorage
 */
export function captureThumbnail(
  maxWidth: number = 200,
  maxHeight: number = 150,
  quality: number = 0.7
): string | null {
  // Find the WebGL canvas (Three.js renderer)
  const canvas = document.querySelector(
    'canvas[data-engine="three.js"]'
  ) as HTMLCanvasElement | null;

  // Fallback: find any canvas in the viewport area
  const fallbackCanvas = document.querySelector(
    ".viewport canvas, [class*='viewport'] canvas, canvas"
  ) as HTMLCanvasElement | null;

  const targetCanvas = canvas || fallbackCanvas;

  if (!targetCanvas) {
    console.error("[Capture] No canvas found for thumbnail");
    return null;
  }

  try {
    // Calculate scaled dimensions maintaining aspect ratio
    const aspectRatio = targetCanvas.width / targetCanvas.height;
    let width = maxWidth;
    let height = maxWidth / aspectRatio;

    if (height > maxHeight) {
      height = maxHeight;
      width = maxHeight * aspectRatio;
    }

    // Create offscreen canvas for resizing
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;

    const ctx = offscreen.getContext("2d");
    if (!ctx) {
      console.error("[Capture] Failed to get 2D context for thumbnail");
      return null;
    }

    // Draw the viewport canvas scaled down
    ctx.drawImage(targetCanvas, 0, 0, width, height);

    // Export as JPEG for smaller size
    const dataUrl = offscreen.toDataURL("image/jpeg", quality);

    return dataUrl;
  } catch (err) {
    console.error("[Capture] Failed to capture thumbnail:", err);
    return null;
  }
}

/**
 * Preset resolutions
 */
export const RESOLUTION_PRESETS = [
  { label: "HD (1280×720)", width: 1280, height: 720 },
  { label: "Full HD (1920×1080)", width: 1920, height: 1080 },
  { label: "2K (2560×1440)", width: 2560, height: 1440 },
  { label: "4K (3840×2160)", width: 3840, height: 2160 },
  { label: "Square (1080×1080)", width: 1080, height: 1080 },
  { label: "Square (2160×2160)", width: 2160, height: 2160 },
  { label: "Portrait (1080×1920)", width: 1080, height: 1920 },
  { label: "Custom", width: 0, height: 0 },
] as const;

/**
 * Background color presets
 */
export const BACKGROUND_PRESETS = [
  { label: "Dark (Default)", color: "#0f0f1a" },
  { label: "Black", color: "#000000" },
  { label: "White", color: "#ffffff" },
  { label: "Gray", color: "#808080" },
  { label: "Blue", color: "#1a1a3e" },
  { label: "Transparent", color: "transparent" },
] as const;
