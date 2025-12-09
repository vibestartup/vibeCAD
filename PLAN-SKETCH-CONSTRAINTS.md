# Sketch Constraints Implementation Plan

## Executive Summary

This document outlines the plan to fully implement sketch constraint solving in vibeCAD. We will use **PlaneGCS** (already integrated) for 2D sketch constraints and evaluate options for 3D assembly constraints separately.

## Current State Analysis

### What Exists

1. **PlaneGCS integration** (`packages/kernel/src/gcs/impl.ts`)
   - Full `GcsApi` implementation wrapping `@salusoft89/planegcs`
   - Supports: points, lines, circles, arcs
   - Supports all geometric constraints: coincident, horizontal, vertical, parallel, perpendicular, tangent, equal, midpoint, point-on-line
   - Supports dimensional constraints: distance, angle, radius, horizontal/vertical distance

2. **Constraint types** (`packages/core/src/types/constraint.ts`)
   - Complete type definitions for all sketch constraints
   - `DimValue` for parametric dimensions

3. **Sketch type** (`packages/core/src/types/sketch.ts`)
   - Has `constraints` map, `solvedPositions` map, `solveStatus`, `dof` fields
   - Ready to store solver results

### What's Missing

1. **Solver not wired up** - `evalSketchOp()` in `rebuild.ts` returns `null`
2. **No constraint UI** - Can't add constraints in SketchCanvas
3. **No DOF feedback** - User doesn't see under/over-constrained status
4. **No drag-with-constraints** - Dragging doesn't re-solve

---

## Solver Strategy Decision

### Option A: PlaneGCS for Sketches + libslvs WASM for Assemblies

| Pros | Cons |
|------|------|
| PlaneGCS is battle-tested for 2D | Need to build/maintain libslvs WASM |
| Already integrated | Two different solver APIs |
| Active npm package | |

### Option B: Build libslvs WASM for Everything

| Pros | Cons |
|------|------|
| One solver for 2D + 3D | No production-ready npm package |
| SolveSpace is proven | Full WASM port is [experimental and broken](https://github.com/solvespace/solvespace/issues/1037) |
| | Significant build work required |

### Option C: PlaneGCS for Sketches + Simple Assembly Math

| Pros | Cons |
|------|------|
| Fastest to implement | Limited assembly constraint types |
| No new dependencies | May need to rewrite later |

### **Decision: Option A (Phased)**

1. **Phase 1 (Now)**: Wire up PlaneGCS for sketch constraints
2. **Phase 2 (Later)**: Evaluate libslvs WASM vs. other options for assemblies
3. **Phase 3**: Implement assembly constraint solving

This is pragmatic because:
- PlaneGCS works great for 2D sketches
- Assembly constraints are future work anyway
- We can evaluate WASM options when needed

---

## Phase 1: Sketch Constraint Integration

### 1.1 Create Sketch Solver Service

Create a service that translates between our sketch data model and PlaneGCS.

**File:** `packages/core/src/sketch/solver.ts`

```typescript
interface SketchSolverResult {
  success: boolean;
  status: SolveStatus;
  dof: number;
  solvedPositions: Map<PrimitiveId, Vec2>;
  failedConstraints?: ConstraintId[];
}

function solveSketch(sketch: Sketch, gcs: GcsApi): SketchSolverResult;
```

**Responsibilities:**
1. Create a solver group
2. Add all primitives as entities (track ID mapping)
3. Add all constraints
4. Call `solve()`
5. Read back solved positions
6. Return result with status and DOF

### 1.2 Wire Up to Rebuild Pipeline

**File:** `packages/core/src/part-studio/rebuild.ts`

Update `evalSketchOp()` to actually solve:

```typescript
async function evalSketchOp(
  op: Extract<Op, { type: "sketch" }>,
  ctx: EvalContext
): Promise<OpResult | null> {
  const sketch = ctx.studio.sketches.get(op.sketchId);
  if (!sketch) return null;

  const result = solveSketch(sketch, ctx.gcs);

  // Update sketch with solved positions
  // This is a side-effect, but necessary for the model
  sketch.solvedPositions = result.solvedPositions;
  sketch.solveStatus = result.status;
  sketch.dof = result.dof;

  return null; // Sketches don't produce shapes
}
```

### 1.3 Add Constraint UI to SketchCanvas

**File:** `app/web/src/components/SketchCanvas.tsx`

Add constraint tools:
- **Coincident**: Click two points
- **Horizontal/Vertical**: Click a line or two points
- **Parallel/Perpendicular**: Click two lines
- **Distance**: Click two points or a line, enter value
- **Radius**: Click circle/arc, enter value
- **Equal**: Click two lines or two circles
- **Fixed**: Click a point or line

**UI Flow:**
1. Select constraint tool from toolbar
2. Click required entities (highlight valid selections)
3. For dimensional constraints, show input popup
4. Add constraint to sketch
5. Re-solve and update display

### 1.4 Constraint Visualization

**File:** `app/web/src/components/Viewport.tsx` (sketch visualization section)

Show constraints visually:
- Coincident: Small dot at merged point
- Horizontal: "H" icon on line
- Vertical: "V" icon on line
- Parallel: "||" between lines
- Perpendicular: "L" symbol
- Distance: Dimension line with value
- Radius: "R=" with value
- Equal: "=" between entities

### 1.5 DOF and Status Feedback

**UI Elements:**
1. Status bar showing: "DOF: 3" or "Fully Constrained" or "Over-Constrained!"
2. Color coding:
   - Green: Fully constrained (DOF = 0)
   - Yellow: Under-constrained (DOF > 0)
   - Red: Over-constrained or inconsistent
3. Highlight problem constraints in red

### 1.6 Drag with Constraint Solving

When user drags a point:
1. Update the point's position as a "soft" constraint
2. Re-solve with that point fixed
3. Update all other points to solved positions
4. On mouse up, optionally add a Fixed constraint or revert

**Implementation:**
```typescript
function dragPoint(sketch: Sketch, pointId: PrimitiveId, newPos: Vec2, gcs: GcsApi) {
  // Temporarily add fixed constraint for dragged point
  const tempConstraint = { type: "fixed", entities: [pointId] };
  const tempSketch = { ...sketch, constraints: new Map([...sketch.constraints, ["temp", tempConstraint]]) };

  // Update point position
  tempSketch.primitives.get(pointId).x = newPos[0];
  tempSketch.primitives.get(pointId).y = newPos[1];

  // Solve
  const result = solveSketch(tempSketch, gcs);

  return result.solvedPositions;
}
```

---

## Phase 2: Advanced Features

### 2.1 Auto-Constraints

Automatically infer constraints during drawing:
- Points near grid → Fixed to grid
- Lines nearly horizontal → Horizontal constraint
- Lines nearly vertical → Vertical constraint
- Points near other points → Coincident
- Lines nearly parallel → Parallel constraint

### 2.2 Construction Geometry

- Toggle primitives as "construction" (don't form profiles)
- Useful for reference lines, centerlines

### 2.3 Constraint Editing

- Double-click dimension to edit value
- Right-click constraint to delete
- Drag dimension text to reposition

### 2.4 Parametric Dimensions

- Link dimension values to parameters
- Use expressions: "Width / 2"
- Update dimensions when parameters change

---

## Phase 3: Assembly Constraints (Future)

### 3.1 Solver Options

Evaluate when we get here:

1. **libslvs WASM** - Build ourselves from SolveSpace source
2. **Custom 3D solver** - Implement basic mates with iterative solving
3. **Physics-based** - Use rigid body simulation for assembly positioning

### 3.2 Assembly Constraint Types

From `packages/core/src/types/assembly.ts`:
- **Mate**: Face/edge/point coincident, parallel, perpendicular
- **Axis**: Concentric, coaxial
- **Distance**: Offset between elements
- **Angle**: Rotation constraint

---

## Implementation Order

### Sprint 1: Core Solver Integration
- [ ] Create `sketch/solver.ts` with `solveSketch()` function
- [ ] Wire up `evalSketchOp()` to call solver
- [ ] Add solve-on-change to cad-store
- [ ] Show DOF in UI

### Sprint 2: Basic Constraint Tools
- [ ] Coincident constraint tool
- [ ] Horizontal/Vertical constraint tools
- [ ] Distance constraint tool (point-to-point)
- [ ] Basic constraint visualization

### Sprint 3: More Constraints + Polish
- [ ] Parallel/Perpendicular tools
- [ ] Radius constraint tool
- [ ] Equal constraint tool
- [ ] Improved visualization
- [ ] Error highlighting

### Sprint 4: Drag + Auto-Constraints
- [ ] Drag-with-solving
- [ ] Auto-constraint inference
- [ ] Construction geometry toggle

---

## Testing Strategy

### Unit Tests
- `solveSketch()` with various constraint combinations
- Edge cases: empty sketch, over-constrained, inconsistent

### Integration Tests
- Add primitive → add constraint → verify solved position
- Edit dimension → verify propagation

### Manual Tests
- Draw rectangle, constrain to specific size
- Draw mechanism with multiple moving parts
- Test undo/redo with constraints

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/sketch/solver.ts` | Create | Main solver service |
| `packages/core/src/sketch/index.ts` | Modify | Export solver |
| `packages/core/src/part-studio/rebuild.ts` | Modify | Call solver |
| `app/web/src/store/cad-store.ts` | Modify | Add constraint actions |
| `app/web/src/components/SketchCanvas.tsx` | Modify | Constraint tools |
| `app/web/src/components/Viewport.tsx` | Modify | Constraint visualization |
| `app/web/src/components/PropertiesPanel.tsx` | Modify | Constraint editing |
| `app/web/src/components/Toolbar.tsx` | Modify | Constraint tool buttons |

---

## References

- [PlaneGCS (npm)](https://www.npmjs.com/package/@salusoft89/planegcs) - The constraint solver we're using
- [FreeCAD Sketcher](https://wiki.freecad.org/Sketcher_Workbench) - Uses same solver, good UX reference
- [SolveSpace Library](https://solvespace.github.io/solvespace-web/library.html) - Reference for 3D constraints
- [SolveSpace WASM Issue](https://github.com/solvespace/solvespace/issues/1037) - Status of Emscripten port
