/**
 * STEP Export Integration Example
 *
 * This file shows how to integrate STEP export into the Toolbar component.
 * Copy the relevant parts into your Toolbar.tsx file.
 */

import React from "react";
import { useCadStore } from "../store";
import { exportSTEP } from "./step-export";
import { getOcc } from "@vibecad/kernel";
import type { ShapeHandle } from "@vibecad/kernel";

/**
 * Hook to get exportable shape handles from the current document
 */
export function useExportableShapes(): ShapeHandle[] {
  return useCadStore((state) => {
    const { document, activeStudioId, timelinePosition } = state;

    if (!activeStudioId) return [];

    const studio = document.partStudios.get(activeStudioId);
    if (!studio?.results) return [];

    const shapeHandles: ShapeHandle[] = [];

    // Get operations up to timeline position (or all if null)
    const opsToInclude = timelinePosition !== null
      ? studio.opOrder.slice(0, timelinePosition + 1)
      : studio.opOrder;

    // Collect shape handles from evaluated operations
    for (const opId of opsToInclude) {
      const result = studio.results.get(opId);
      if (result?.shapeHandle !== undefined && !isNaN(result.shapeHandle)) {
        shapeHandles.push(result.shapeHandle);
      }
    }

    return shapeHandles;
  });
}

/**
 * Example: Adding STEP export to the Toolbar
 *
 * Step 1: Add this to the top of your Toolbar component
 */
function ToolbarWithSTEPExport() {
  // Existing STL export
  const exportMeshes = useCadStore((s) => s.exportMeshes);
  const documentName = useCadStore((s) => s.document.name);

  // NEW: Shape handles for STEP export
  const exportableShapes = useExportableShapes();

  // Existing STL export handler
  const handleExportSTL = React.useCallback(() => {
    if (exportMeshes.length === 0) {
      console.warn("[Toolbar] No meshes available for export");
      return;
    }
    const filename = documentName.replace(/\s+/g, "_") || "model";
    // ... existing STL export code
  }, [exportMeshes, documentName]);

  // NEW: STEP export handler
  const handleExportSTEP = React.useCallback(() => {
    const occApi = getOcc();

    if (!occApi) {
      console.error("[Toolbar] OCC API not loaded");
      alert("STEP export requires OpenCascade to be loaded.");
      return;
    }

    if (exportableShapes.length === 0) {
      console.warn("[Toolbar] No shapes available for export");
      alert("No geometry to export. Create some operations first.");
      return;
    }

    const filename = documentName.replace(/\s+/g, "_") || "model";

    try {
      exportSTEP(occApi, exportableShapes, filename, true);
      console.log(`[Toolbar] Exported ${exportableShapes.length} shape(s) to STEP:`, filename);
    } catch (error) {
      console.error("[Toolbar] STEP export failed:", error);
      alert("STEP export failed. Check console for details.");
    }
  }, [exportableShapes, documentName]);

  // ... rest of toolbar implementation
  return null; // Your actual toolbar JSX
}

/**
 * Step 2: Update the EXPORT_FORMATS array
 */
const EXPORT_FORMATS_UPDATED = [
  { id: "stl", label: "STL", extension: ".stl", enabled: true },
  { id: "step", label: "STEP", extension: ".step", enabled: true }, // Changed to true!
  { id: "obj", label: "OBJ", extension: ".obj", enabled: false },
  { id: "gltf", label: "glTF", extension: ".gltf", enabled: false },
];

/**
 * Step 3: Update ExportDropdown props and handler
 */
interface ExportDropdownProps {
  onExportSTL: () => void;
  onExportSTEP: () => void; // NEW
  hasGeometry: boolean;
  hasShapes: boolean; // NEW - for STEP export
}

function ExportDropdownUpdated({
  onExportSTL,
  onExportSTEP,
  hasGeometry,
  hasShapes,
}: ExportDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleExport = (format: typeof EXPORT_FORMATS_UPDATED[0]) => {
    if (!format.enabled) return;

    // Check if we have the required data for this format
    if (format.id === "stl" && !hasGeometry) {
      alert("No geometry to export");
      return;
    }
    if (format.id === "step" && !hasShapes) {
      alert("No geometry to export");
      return;
    }

    // Call the appropriate handler
    if (format.id === "stl") {
      onExportSTL();
    } else if (format.id === "step") {
      onExportSTEP();
    }

    setIsOpen(false);
  };

  // ... rest of dropdown implementation
  return null; // Your actual dropdown JSX
}

/**
 * Step 4: Update the ExportDropdown usage in Toolbar
 */
function ToolbarUsageExample() {
  const exportMeshes = useCadStore((s) => s.exportMeshes);
  const exportableShapes = useExportableShapes();

  // ... your handlers

  return (
    <div>
      {/* ... other toolbar content ... */}

      <ExportDropdownUpdated
        onExportSTL={() => {/* your STL handler */}}
        onExportSTEP={() => {/* your STEP handler */}}
        hasGeometry={exportMeshes.length > 0}
        hasShapes={exportableShapes.length > 0}
      />
    </div>
  );
}

/**
 * Alternative: Simple button implementation (without dropdown)
 */
function SimpleSTEPExportButton() {
  const exportableShapes = useExportableShapes();
  const documentName = useCadStore((s) => s.document.name);

  const handleExportSTEP = () => {
    const occApi = getOcc();
    if (!occApi || exportableShapes.length === 0) return;

    const filename = documentName.replace(/\s+/g, "_") || "model";
    exportSTEP(occApi, exportableShapes, filename, true);
  };

  return (
    <button
      onClick={handleExportSTEP}
      disabled={exportableShapes.length === 0}
      title="Export to STEP"
    >
      Export STEP
    </button>
  );
}

export { ToolbarWithSTEPExport, ExportDropdownUpdated, SimpleSTEPExportButton };
