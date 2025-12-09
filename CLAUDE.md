# vibeCAD Implementation Guide

You are the implementation agent for **vibeCAD**, a browser-native parametric CAD system with sketch-plane constraints, feature-based modeling, and assembly support.

## Tech Stack

- **Frontend:** React 18, TypeScript 5, Zustand (state), Three.js (3D rendering)
- **CAD Kernel:** OpenCascade.js 1.1.1 (WASM) - solid modeling
- **Constraint Solver:** PlaneGCS via @salusoft89/planegcs (WASM) - 2D sketch constraints (see Constraint Solver Strategy below)
- **Build:** Vite 6, pnpm workspace (monorepo), Turbo
- **Deployment:** Vercel-ready

## Monorepo Structure

```
.
├── packages/
│   ├── core/           # Pure CAD logic (framework-agnostic)
│   │   └── src/
│   │       ├── types/          # All type definitions
│   │       │   ├── id.ts           # Branded ID types + newId()
│   │       │   ├── math.ts         # Vec2/Vec3/Mat3 + vector math
│   │       │   ├── plane.ts        # SketchPlane, datum planes
│   │       │   ├── primitive.ts    # Sketch primitives
│   │       │   ├── constraint.ts   # Sketch constraints
│   │       │   ├── sketch.ts       # Sketch aggregate
│   │       │   ├── op.ts           # Operations (all types)
│   │       │   ├── part-studio.ts  # OpNode, OpResult, Mesh
│   │       │   ├── part.ts         # Part, Material
│   │       │   ├── params.ts       # Parameter environment
│   │       │   ├── assembly.ts     # Assembly constraints
│   │       │   └── document.ts     # Top-level document
│   │       ├── sketch/         # Sketch operations
│   │       │   ├── primitives.ts   # Add/remove primitives
│   │       │   ├── constraints.ts  # Add/remove constraints
│   │       │   ├── loops.ts        # Closed loop detection
│   │       │   └── transform.ts    # Sketch↔World transforms
│   │       ├── ops/            # Operation evaluation
│   │       ├── part-studio/    # Graph building, rebuild
│   │       ├── assembly/       # Assembly (stub)
│   │       ├── params/         # Parameter & expression system
│   │       │   ├── parser.ts       # Expression parsing
│   │       │   ├── eval.ts         # Expression evaluation
│   │       │   └── deps.ts         # Dependency graph, cycle detection
│   │       ├── history/        # Undo/redo
│   │       └── index.ts
│   │
│   ├── kernel/         # WASM bindings
│   │   └── src/
│   │       ├── occ/
│   │       │   ├── api.ts          # OccApi interface
│   │       │   ├── impl.ts         # Full OCC implementation
│   │       │   ├── loader.ts       # WASM loader
│   │       │   └── opencascade.d.ts
│   │       ├── gcs/
│   │       │   ├── api.ts          # GcsApi interface
│   │       │   ├── impl.ts         # PlaneGCS implementation
│   │       │   └── index.ts        # Loader
│   │       └── index.ts        # Combined kernel loader
│   │
│   ├── react/          # React component library
│   │   └── src/
│   │       ├── components/
│   │       ├── contexts/
│   │       └── hooks/
│   │
│   └── db/             # Persistence (stub)
│
└── app/
    └── web/            # Main React + Three.js frontend
        └── src/
            ├── components/
            │   ├── Viewport.tsx        # 3D viewport (Three.js + OCC)
            │   ├── SketchCanvas.tsx    # 2D sketch overlay
            │   ├── OpTimeline.tsx      # Operation list/timeline
            │   ├── PropertiesPanel.tsx # Context-sensitive properties
            │   ├── Toolbar.tsx         # Tool palette
            │   ├── SettingsModal.tsx   # Settings UI
            │   └── TabBar.tsx          # Document tabs
            ├── layouts/
            │   └── EditorLayout.tsx
            ├── pages/
            │   └── Editor.tsx
            ├── store/
            │   ├── cad-store.ts        # Main Zustand store
            │   ├── settings-store.ts   # User preferences
            │   ├── project-store.ts    # Project save/load
            │   └── tabs-store.ts       # Tab management
            └── utils/
                ├── stl-export.ts       # STL export
                ├── obj-export.ts       # OBJ export
                ├── gltf-export.ts      # GLTF export
                ├── step-export.ts      # STEP export (via OCC)
                ├── units.ts            # Unit conversion
                └── viewport-capture.ts # Screenshot capture
```

---

## Current Implementation Status

### Fully Implemented

**Core Type System** (`packages/core/src/types/`)
- Branded ID types with `newId()` generator
- Complete Vec2/Vec3/Mat3 math operations
- SketchPlane with datum planes (XY, XZ, YZ)
- All sketch primitives: Point, Line, Arc, Circle, Spline, Rect
- All constraints: geometric (coincident, horizontal, vertical, parallel, perpendicular, tangent, equal, fixed, symmetric) and dimensional (distance, angle, radius, diameter)
- Operations: Sketch, Extrude, Revolve, Sweep, Loft, Boolean, Fillet, Chamfer, Shell, Pattern, Mirror
- Unified Profile abstraction for Extrude/Revolve (sketch profiles OR existing faces)

**OpenCascade.js Integration** (`packages/kernel/src/occ/`)
- Wire/Face creation (makePolygon, makeWire, makeFace)
- Primary operations (extrude, revolve, sweep, loft)
- Boolean operations (fuse, cut, intersect)
- Modification operations (fillet, chamfer, shell)
- Topology queries (getFaces, getEdges, getVertices)
- Geometry queries (faceCenter, faceNormal, edgeMidpoint, etc.)
- Meshing with face groups for face selection
- **STEP export** (exportSTEP, exportShapeToSTEP)

**PlaneGCS Integration** (`packages/kernel/src/gcs/`)
- 2D constraint solver API wrapper (`GcsApi` interface)
- Point, line, arc, circle entities
- All geometric and dimensional constraints
- **Note:** API is implemented but NOT yet wired to UI - see `PLAN-SKETCH-CONSTRAINTS.md`

**Parameter System** (`packages/core/src/params/`)
- Expression parsing (numbers, operators, identifiers, function calls)
- Safe expression evaluation with variable context
- Dependency graph with cycle detection

**History** (`packages/core/src/history/`)
- Complete undo/redo with past/present/future stack

**3D Viewport** (`app/web/src/components/Viewport.tsx`)
- Three.js scene with orbit controls
- Real-time OpenCascade.js geometry rendering
- Dynamic grid with unit-aware spacing and labels
- Datum plane visualization with hover selection
- Sketch visualization in 3D (transparent overlay)
- Face/edge selection and highlighting
- Extrude preview during configuration
- Grid snapping (toggleable)
- View presets (top, front, right, iso)
- Coordinate system: CAD Z-up ↔ Three.js Y-up conversion

**Sketch Canvas** (`app/web/src/components/SketchCanvas.tsx`)
- Multi-step drawing tools (line, rect, circle, arc)
- In-progress shape preview
- Coordinate display and cursor hints

**State Management** (`app/web/src/store/cad-store.ts`)
- Complete Zustand store with:
  - Document state + history
  - Editor modes: object, select-plane, sketch, select-face
  - Active tool system
  - Pending operation workflows (extrude, revolve, fillet, boolean)
  - Timeline position for operation scrubbing
  - Export mesh/shape handle storage

**Export Formats**
- STL (binary/ASCII)
- OBJ
- GLTF
- STEP (ISO 10303-21) via OpenCascade.js

**Unit System**
- Length units: mm, in, cm
- Dynamic grid calculation based on unit
- Settings persistence

### Partially Implemented

- **Constraint solving integration** - PlaneGCS API implemented in `gcs/impl.ts`, but `evalSketchOp()` in rebuild.ts is a no-op. See `PLAN-SKETCH-CONSTRAINTS.md` for full implementation plan.
- **Revolve/Sweep/Loft** - Types + UI exist, OCC execution needs completion
- **Boolean operations** - Framework in place, needs full integration
- **File model refactor** - Currently uses Document→PartStudios structure, needs simplification to 1 file = 1 OpGraph (see "File & Data Model" section)

### Not Implemented

- Full automatic rebuild pipeline
- Pattern/Mirror operations
- Advanced constraint tools (tangent, symmetric)
- Assembly operations (InsertPart, Mate) - will be regular ops, not a separate file type
- Database persistence (localStorage only)
- Desktop/mobile apps

---

## File & Data Model

### Design Philosophy

**1 file = 1 operation graph = 1 tab**

A `.vibecad` file is simply a sequence of operations (OpGraph) that produces geometry. There is no distinction between "Part Studio" and "Assembly" - they are the same thing. The difference is just which operations you use:

- **Part-like files:** Use sketch, extrude, fillet, boolean, etc.
- **Assembly-like files:** Also use `InsertPart` (reference another file) and `Mate` (position constraints)

This unified model means:
- Each open file = one tab in the UI
- Switching tabs = switching files
- No nested "documents containing multiple part studios"
- Assemblies reference other files by relative path (e.g., `./bracket.vibecad`)
- Users organize files however they want - no forced folder structure

### File Format

```
.vibecad file = {
  name: string,
  opGraph: Map<OpId, Op>,      // All operations
  opOrder: OpId[],             // Execution order
  sketches: Map<SketchId, Sketch>,
  planes: Map<PlaneId, Plane>,
  params: ParamEnv,            // Parameters/variables
  meta: { version, created, modified }
}
```

### Assembly Operations (Future)

When we implement assemblies, they'll just be additional operation types:

- `InsertPart { path: string, transform?: Mat4 }` - Import geometry from another file
- `Mate { partA: Ref, partB: Ref, type: MateType }` - Position constraint between parts

These operations live in the same OpGraph as everything else.

---

## Key Architecture Patterns

### 1. Unified Profile Abstraction

Operations like Extrude and Revolve use a unified profile type:

```ts
export type ExtrudeProfile =
  | { type: "sketch"; sketchId: SketchId; profileIndices?: number[] }
  | { type: "face"; faceRef: TopoRef };
```

This allows extruding from sketch loops OR existing body faces.

### 2. Editor Modes

The app uses distinct modes for different interactions:

```ts
type EditorMode = "object" | "select-plane" | "sketch" | "select-face";
```

- `object`: Normal 3D navigation and selection
- `select-plane`: Picking a plane for new sketch
- `sketch`: 2D sketch editing mode
- `select-face`: Selecting faces for operations

### 3. Pending Operations

Complex operations use a pending state workflow:

```ts
pendingExtrude: {
  sketchId: string | null;
  loopIndex?: number;
  bodyFace: { opId: string; faceIndex: number } | null;
  depth: number;
  direction: "normal" | "reverse" | "symmetric";
} | null;
```

Users configure parameters in PropertiesPanel, then confirm.

### 4. Timeline Scrubbing

Operations can be evaluated incrementally:

```ts
timelinePosition: number | null; // null = show all operations
```

Setting a position shows geometry up to that operation index.

### 5. Coordinate Systems

- **CAD convention:** Z-up, XY is ground plane
- **Three.js convention:** Y-up
- Viewport handles conversion automatically
- Sketches use 2D local coordinates, transformed to world via plane

---

## Constraint Solver Strategy

### Current State

- **PlaneGCS** (`@salusoft89/planegcs`) is integrated for 2D sketch constraints
- The `GcsApi` interface and implementation exist in `packages/kernel/src/gcs/`
- **NOT YET WIRED UP** - `evalSketchOp()` returns null, no constraint UI exists

### Why PlaneGCS for Sketches

PlaneGCS (from FreeCAD) is purpose-built for 2D parametric sketch solving:
- Actively maintained npm package
- Proven in production (powers FreeCAD Sketcher)
- All standard sketch constraints supported
- 2D-only scope matches our sketch needs

### Assembly Constraints (Future)

For 3D assembly constraints (mate, axis alignment, etc.), we'll need a different approach since PlaneGCS is 2D-only. Options being evaluated:

1. **libslvs WASM** - Build SolveSpace's constraint solver to WASM (no production npm package exists)
2. **Custom 3D solver** - Implement basic rigid body positioning
3. **Physics-based** - Use rigid body simulation

Decision deferred until assembly implementation begins. See `PLAN-SKETCH-CONSTRAINTS.md` for detailed analysis.

### Key Files

| File | Purpose |
|------|---------|
| `packages/kernel/src/gcs/api.ts` | `GcsApi` interface |
| `packages/kernel/src/gcs/impl.ts` | PlaneGCS implementation |
| `packages/core/src/types/constraint.ts` | Constraint type definitions |
| `packages/core/src/types/sketch.ts` | Sketch with solver output fields |
| `PLAN-SKETCH-CONSTRAINTS.md` | Full implementation plan |

---

## Coding Standards

- **TypeScript strict mode** everywhere
- **Immutable updates**: functions return new objects, don't mutate
- **No `any`** except at WASM boundaries (wrap immediately)
- **Small, focused functions** with clear inputs/outputs
- **Dependency injection** for OCC/GCS APIs

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Main store | `app/web/src/store/cad-store.ts` |
| 3D rendering | `app/web/src/components/Viewport.tsx` |
| Sketch UI | `app/web/src/components/SketchCanvas.tsx` |
| Operation types | `packages/core/src/types/op.ts` |
| OCC bindings | `packages/kernel/src/occ/impl.ts` |
| Constraint solver | `packages/kernel/src/gcs/impl.ts` |
| Constraint types | `packages/core/src/types/constraint.ts` |
| STEP export | `app/web/src/utils/step-export.ts` |
| **Constraint plan** | `PLAN-SKETCH-CONSTRAINTS.md` |

---

## Key Invariants

1. **OpGraph is always acyclic** - validate on every edit
2. **Sketches reference valid planes** - plane deletion cascades or blocks
3. **TopoRefs are best-effort** - rebuilds may invalidate; handle gracefully
4. **Parameters form a DAG** - detect cycles during evaluation
5. **All IDs are globally unique** - use `newId()` with prefixes

---

## Common Tasks

### Adding a New Operation Type

1. Add type in `packages/core/src/types/op.ts`
2. Add type guard (e.g., `isMyOp`)
3. Update `getOpDependencies()` if needed
4. Add UI in `PropertiesPanel.tsx`
5. Add evaluation in `Viewport.tsx` (or ops module when rebuild is wired)

### Adding a New Sketch Primitive

1. Add type in `packages/core/src/types/primitive.ts`
2. Add creation function in `packages/core/src/sketch/primitives.ts`
3. Add to loop detection in `packages/core/src/sketch/loops.ts`
4. Add rendering in `Viewport.tsx` sketch visualization
5. Add tool in `SketchCanvas.tsx`

### Adding a New Export Format

1. Create utility in `app/web/src/utils/`
2. Add button in `Toolbar.tsx`
3. Use `exportMeshes` or `exportShapeHandles` from store

---

## Running the Project

```bash
pnpm install
pnpm dev:web
```

Opens at http://localhost:5173
