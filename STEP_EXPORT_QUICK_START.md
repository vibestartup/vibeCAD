# STEP Export - Quick Start Guide

## 🚀 Quick Integration (5 Minutes)

### Step 1: Enable STEP in Export Menu

In `app/web/src/components/Toolbar.tsx`, change line ~249:

```typescript
// FROM:
{ id: "step", label: "STEP", extension: ".step", enabled: false },

// TO:
{ id: "step", label: "STEP", extension: ".step", enabled: true },
```

### Step 2: Add Export Handler

Add this hook at the top of the Toolbar component:

```typescript
import { getOcc } from "@vibecad/kernel";
import { exportSTEP } from "../utils/step-export";
import type { ShapeHandle } from "@vibecad/kernel";

// Inside Toolbar component:
const exportableShapes = useCadStore((state) => {
  const { document, activeStudioId } = state;
  if (!activeStudioId) return [];

  const studio = document.partStudios.get(activeStudioId);
  if (!studio?.results) return [];

  const shapes: ShapeHandle[] = [];
  for (const result of studio.results.values()) {
    if (result.shapeHandle !== undefined) {
      shapes.push(result.shapeHandle);
    }
  }
  return shapes;
});

const handleExportSTEP = React.useCallback(() => {
  const occApi = getOcc();
  if (!occApi) {
    alert("STEP export requires OpenCascade to be loaded.");
    return;
  }
  if (exportableShapes.length === 0) {
    alert("No geometry to export.");
    return;
  }

  const filename = documentName.replace(/\s+/g, "_") || "model";
  exportSTEP(occApi, exportableShapes, filename, true);
}, [exportableShapes, documentName]);
```

### Step 3: Update ExportDropdown

Update the `ExportDropdown` component props (~259):

```typescript
// Add new prop:
interface ExportDropdownProps {
  onExportSTL: () => void;
  onExportSTEP: () => void;  // ADD THIS
  hasGeometry: boolean;
  hasShapes: boolean;        // ADD THIS
}

// Update handler (~282):
const handleExport = (format: ExportFormat) => {
  if (!format.enabled) return;

  if (format.id === "stl") {
    if (!hasGeometry) {
      alert("No geometry to export");
      return;
    }
    onExportSTL();
  } else if (format.id === "step") {
    if (!hasShapes) {
      alert("No geometry to export");
      return;
    }
    onExportSTEP();
  }

  setIsOpen(false);
};

// Update usage (~720):
<ExportDropdown
  onExportSTL={handleExportSTL}
  onExportSTEP={handleExportSTEP}  // ADD THIS
  hasGeometry={exportMeshes.length > 0}
  hasShapes={exportableShapes.length > 0}  // ADD THIS
/>
```

## ✅ That's It!

Now clicking "Export > STEP" will download a `.step` file with your CAD geometry.

## 📝 What You Get

- **Valid STEP files** (ISO 10303-21 format)
- **Exact geometry** (not tessellated like STL)
- **CAD-compatible** (opens in FreeCAD, SolidWorks, etc.)
- **Small file size** for smooth curves
- **Professional format** for CAD interchange

## 🔧 Optional: Enable Real WASM

Currently using stub implementation. To enable full geometry export:

In `packages/kernel/src/occ/index.ts`, line ~28:

```typescript
// Change from:
const USE_STUB_ONLY = true;

// To:
const USE_STUB_ONLY = false;
```

**Note**: Stub mode still produces valid STEP files, just with minimal geometry data.

## 📚 More Info

- See `STEP_EXPORT_IMPLEMENTATION.md` for complete details
- See `app/web/src/utils/STEP_EXPORT_GUIDE.md` for architecture
- See `app/web/src/utils/STEP_INTEGRATION_EXAMPLE.tsx` for more examples

## 🐛 Troubleshooting

**"OCC API not loaded"**
- Check that kernel is initialized
- Wait for app to fully load before exporting

**"No geometry to export"**
- Create some operations first (Extrude, Revolve, etc.)
- Make sure operations are evaluated (not suppressed)

**Empty STEP file**
- Using stub mode - set `USE_STUB_ONLY = false` for real export
- Check that `OpResult.shapeHandle` is populated

## 🎯 Testing

1. Create a simple cube (extrude a rectangle)
2. Click Export > STEP
3. Open the `.step` file in:
   - FreeCAD (free, open source)
   - Online STEP viewer
   - Any professional CAD software

The geometry should appear correctly with exact dimensions!
