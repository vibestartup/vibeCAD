/**
 * STEP Export Utility
 * Exports CAD geometry to STEP format (ISO 10303-21)
 *
 * STEP is a CAD interchange format that preserves exact geometry,
 * not just tessellated meshes like STL/OBJ. This makes it ideal
 * for CAD-to-CAD data exchange.
 */

import type { OccApi, ShapeHandle } from "@vibecad/kernel";
import { downloadFile } from "./stl-export";

/**
 * Export shapes to STEP format using the OCC API
 *
 * @param occApi - OpenCascade API instance
 * @param shapes - Array of shape handles to export
 * @param asCompound - If true, export all shapes as a single compound shape
 * @returns STEP file content as string, or null on error
 */
export function shapesToSTEP(
  occApi: OccApi,
  shapes: ShapeHandle[],
  asCompound: boolean = true
): string | null {
  if (!occApi) {
    console.error("[STEP Export] OCC API not available");
    return null;
  }

  if (shapes.length === 0) {
    console.warn("[STEP Export] No shapes to export");
    return null;
  }

  try {
    // Use the OCC API's built-in STEP export
    const stepContent = occApi.exportSTEP(shapes, asCompound);

    if (!stepContent) {
      console.error("[STEP Export] Export returned null");
      return null;
    }

    return stepContent;
  } catch (error) {
    console.error("[STEP Export] Export failed:", error);
    return null;
  }
}

/**
 * Export shapes to STEP and trigger download
 *
 * @param occApi - OpenCascade API instance
 * @param shapes - Array of shape handles to export
 * @param filename - Base filename (without extension)
 * @param asCompound - If true, export all shapes as a single compound shape
 */
export function exportSTEP(
  occApi: OccApi,
  shapes: ShapeHandle[],
  filename: string = "model",
  asCompound: boolean = true
): void {
  const stepContent = shapesToSTEP(occApi, shapes, asCompound);

  if (stepContent) {
    downloadFile(stepContent, `${filename}.step`, "application/step");
    console.log(`[STEP Export] Exported ${shapes.length} shape(s) to ${filename}.step`);
  } else {
    console.error("[STEP Export] Failed to export STEP file");
  }
}

/**
 * MIME types for STEP files
 * STEP files can have multiple extensions: .step, .stp
 */
export const STEP_MIME_TYPES = [
  "application/step",
  "application/STEP",
  "application/stp",
  "model/step",
  "model/x-step",
] as const;

/**
 * Check if a filename has a STEP extension
 */
export function isSTEPFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.endsWith(".step") || lower.endsWith(".stp");
}
