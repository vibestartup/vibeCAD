# STEP Export Implementation Guide

## Overview

STEP (Standard for the Exchange of Product model data, ISO 10303-21) export has been implemented for vibeCAD. Unlike STL/OBJ formats which export tessellated meshes, STEP preserves exact CAD geometry, making it ideal for professional CAD-to-CAD data exchange.

## Architecture

### Components

1. **OCC API Layer** (`packages/kernel/src/occ/api.ts`)
   - Added `exportSTEP(shapes: ShapeHandle[], asCompound?: boolean): string | null`
   - Added `exportShapeToSTEP(shape: ShapeHandle): string | null`

2. **OCC Implementation** (`packages/kernel/src/occ/impl.ts`)
   - Real implementation using OpenCascade.js `STEPControl_Writer`
   - Supports exporting multiple shapes as compound or individually
   - Uses Emscripten virtual filesystem for file generation

3. **OCC Stub** (`packages/kernel/src/occ/stub.ts`)
   - Stub implementation for development/testing
   - Generates minimal valid STEP file header

4. **Export Utility** (`app/web/src/utils/step-export.ts`)
   - High-level export functions
   - Download trigger functionality
   - MIME type utilities

## How It Works

### OpenCascade.js STEP Export Flow

```
1. Create STEPControl_Writer instance
2. For each shape:
   - Transfer shape to writer with STEPControl_AsIs mode
3. Write to virtual filesystem (Emscripten FS)
4. Read file content from virtual FS
5. Clean up virtual file
6. Return STEP content as string
```

### Key OpenCascade.js Classes Used

- `STEPControl_Writer_1()` - STEP file writer
- `Message_ProgressRange_1()` - Progress tracking
- `TopoDS_Compound` - Container for multiple shapes
- `BRep_Builder` - Builder for compound shapes
- `STEPControl_StepModelType.STEPControl_AsIs` - Translation mode

## Usage

### In the UI (Toolbar/Menu)

To add STEP export to your UI, you need access to:
1. The OCC API instance (from kernel)
2. The shape handles of the geometry to export

Example integration:

```typescript
import { exportSTEP } from "../utils/step-export";
import { getOcc } from "@vibecad/kernel";

// In your component
const handleExportSTEP = async () => {
  const occApi = getOcc();
  if (!occApi) {
    console.error("OCC not loaded");
    return;
  }

  // Get shape handles from your CAD store/state
  const shapeHandles = getShapeHandlesFromDocument();

  exportSTEP(
    occApi,
    shapeHandles,
    "my-model", // filename
    true // export as compound
  );
};
```

### Required Data Flow

The current architecture requires access to:

```
Document → PartStudio → Operations → OpResults → ShapeHandles
```

You'll need to:
1. Access the active PartStudio from the document
2. Get the results map with evaluated operations
3. Extract shape handles from the final operations
4. Pass these handles to the export function

### Example: Exporting from CAD Store

```typescript
// In your export handler
const document = useCADStore(state => state.document);
const activeStudioId = useCADStore(state => state.activeStudioId);

const handleExport = async () => {
  if (!activeStudioId) return;

  const studio = document.partStudios.get(activeStudioId);
  if (!studio?.results) return;

  const occApi = getOcc();
  if (!occApi) return;

  // Collect all shape handles from evaluated operations
  const shapeHandles: ShapeHandle[] = [];
  for (const [opId, result] of studio.results) {
    if (result.shapeHandle) {
      shapeHandles.push(result.shapeHandle);
    }
  }

  exportSTEP(occApi, shapeHandles, studio.name || "model", true);
};
```

## Current Status

### ✅ Implemented
- OCC API interface with STEP export methods
- Real implementation using OpenCascade.js (when WASM is loaded)
- Stub implementation for development mode
- Export utility with download trigger
- Support for single and multiple shape export
- Compound shape export

### ⚠️ Known Limitations

1. **WASM Loading**: Currently the app uses stub OCC by default (`USE_STUB_ONLY = true` in `packages/kernel/src/occ/index.ts`). To use real STEP export, set this to `false` and ensure OpenCascade.js WASM loads correctly.

2. **Shape Handle Access**: The export utility needs actual shape handles. The current architecture stores these in `OpResult.shapeHandle`, but this needs to be properly wired through the evaluation pipeline.

3. **Assembly Support**: Basic implementation exports shapes individually or as a compound. For true assembly structure with metadata, you'd need to use `STEPCAFControl_Writer` instead.

### 🔄 Integration TODO

To fully integrate STEP export into the UI:

1. **Add to Toolbar/Menu**:
   - Add "Export STEP" button/menu item
   - Wire it to the export handler

2. **Wire Shape Handles**:
   - Ensure OpResult stores shapeHandle
   - Update part-studio rebuild to propagate handles
   - Add getter in CAD store to collect exportable shapes

3. **Enable Real WASM** (optional):
   - Set `USE_STUB_ONLY = false` in kernel
   - Test with real OpenCascade.js
   - Handle WASM loading errors gracefully

4. **UI Enhancements**:
   - Add export options dialog (compound vs individual)
   - Show progress/feedback during export
   - Add format selection (STEP/STL/OBJ)

## Technical References

### STEP Export in OpenCascade.js

From the research, here's how STEP export works in OpenCascade.js:

```javascript
// Create writer
const writer = new oc.STEPControl_Writer_1();
const progress = new oc.Message_ProgressRange_1();

// Transfer shape(s)
writer.Transfer(
  shape,
  oc.STEPControl_StepModelType.STEPControl_AsIs,
  true,
  progress
);

// Write to virtual FS
writer.Write("filename.step");

// Read from virtual FS
const content = oc.FS.readFile("/filename.step", { encoding: "utf8" });

// Clean up
oc.FS.unlink("/filename.step");
```

### Translation Modes

- `STEPControl_AsIs` - Automatic based on shape type (recommended)
- `STEPControl_ManifoldSolidBrep` - For solid models
- `STEPControl_BrepWithVoids` - For shells with voids
- `STEPControl_FacetedBrep` - For faceted representation
- `STEPControl_ShellBasedSurfaceModel` - For surface models
- `STEPControl_GeometricCurveSet` - For wireframes

### File Extensions

Standard STEP file extensions:
- `.step` - Full name
- `.stp` - Short form (more common)

Both are supported by the utility.

## Resources

- [OpenCascade STEP Documentation](https://dev.opencascade.org/doc/overview/html/occt_user_guides__step.html)
- [STEPControl_Writer Reference](https://dev.opencascade.org/doc/occt-6.9.1/refman/html/class_s_t_e_p_control___writer.html)
- [OpenCascade.js STEP Export Issue](https://github.com/donalffons/opencascade.js/issues/106)
- [Stack Overflow: Using STEPControl_Writer](https://stackoverflow.com/questions/75603196/how-to-use-stepcontrol-writer-in-opencascade-js)

## Next Steps

1. Wire shape handles through the evaluation pipeline
2. Add STEP export button to UI (Toolbar component)
3. Test with real OpenCascade.js WASM
4. Consider adding import functionality (STEPControl_Reader)
5. Add assembly metadata support for complex models
