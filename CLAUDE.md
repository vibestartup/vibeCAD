# vibeCAD Implementation Guide

You are the implementation agent for **vibeCAD**, a browser-native parametric CAD system with sketch-plane constraints, feature-based modeling, and assembly support.

## Monorepo Structure

```
.
├── packages/
│   ├── core/           # Pure CAD logic (framework-agnostic)
│   │   └── src/
│   │       ├── types/          # All type definitions
│   │       ├── sketch/         # Sketch primitives, constraints, solver
│   │       ├── ops/            # Operations (sketch->solid, solid->solid)
│   │       ├── part-studio/    # Operation graph, evaluation
│   │       ├── assembly/       # Assembly constraints, positioning
│   │       ├── params/         # Parameter & expression system
│   │       ├── history/        # Undo/redo
│   │       └── index.ts
│   │
│   ├── kernel/         # WASM bindings (OCC + SolveSpace)
│   │   └── src/
│   │       ├── occ.ts          # OpenCascade bindings
│   │       ├── slvs.ts         # SolveSpace bindings
│   │       └── loader.ts       # WASM initialization
│   │
│   └── db/             # Persistence (stub for now)
│
└── app/
    └── web/            # React + Three.js frontend
        └── src/
            ├── components/
            │   ├── Viewport3D.tsx
            │   ├── SketchCanvas.tsx
            │   ├── FeatureTree.tsx
            │   └── ParamPanel.tsx
            ├── hooks/
            └── store/
```

---

## 1. Core Type System

All types live in `packages/core/src/types/`. This is the foundation - get it right.

### 1.1 Primitives

```ts
// types/primitives.ts

/** Branded ID types for type safety */
export type Id<T extends string> = string & { readonly __brand: T };

export type SketchPlaneId = Id<"SketchPlane">;
export type SketchId = Id<"Sketch">;
export type PrimitiveId = Id<"Primitive">;
export type ConstraintId = Id<"Constraint">;
export type OpId = Id<"Op">;
export type PartId = Id<"Part">;
export type AssemblyId = Id<"Assembly">;
export type ParamId = Id<"Param">;

/** Generate a new ID */
export function newId<T extends string>(prefix: T): Id<T>;

/** Math primitives */
export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly [Vec3, Vec3, Vec3];  // row-major
export type Mat4 = readonly [number, number, number, number,
                             number, number, number, number,
                             number, number, number, number,
                             number, number, number, number];

/** A plane in 3D space defined by origin and two orthonormal axes */
export interface SketchPlane {
  id: SketchPlaneId;
  origin: Vec3;
  axisX: Vec3;   // u direction
  axisY: Vec3;   // v direction
  // normal is cross(axisX, axisY)
}

/** Standard datum planes */
export const DATUM_XY: SketchPlane;
export const DATUM_XZ: SketchPlane;
export const DATUM_YZ: SketchPlane;
```

### 1.2 Sketch Primitives

```ts
// types/sketch.ts

/** Base for all sketch primitives */
interface PrimitiveBase {
  id: PrimitiveId;
  construction: boolean;  // construction geometry doesn't form profiles
}

export interface PointPrimitive extends PrimitiveBase {
  type: "point";
  x: number;
  y: number;
}

export interface LinePrimitive extends PrimitiveBase {
  type: "line";
  start: PrimitiveId;  // ref to PointPrimitive
  end: PrimitiveId;
}

export interface ArcPrimitive extends PrimitiveBase {
  type: "arc";
  center: PrimitiveId;
  start: PrimitiveId;
  end: PrimitiveId;
  clockwise: boolean;
}

export interface CirclePrimitive extends PrimitiveBase {
  type: "circle";
  center: PrimitiveId;
  radius: number;
}

export interface SplinePrimitive extends PrimitiveBase {
  type: "spline";
  controlPoints: PrimitiveId[];
  degree: number;
  knots?: number[];  // for NURBS
  weights?: number[]; // for rational
}

export type SketchPrimitive =
  | PointPrimitive
  | LinePrimitive
  | ArcPrimitive
  | CirclePrimitive
  | SplinePrimitive;

export type PrimitiveType = SketchPrimitive["type"];
```

### 1.3 Sketch Constraints

```ts
// types/constraints.ts

/** Dimension value - either literal or parameter reference */
export interface DimValue {
  paramId?: ParamId;      // if bound to a parameter
  expression?: string;    // if using an expression
  value: number;          // evaluated numeric value
}

interface ConstraintBase {
  id: ConstraintId;
  entities: PrimitiveId[];  // primitives this constraint affects
}

// Geometric constraints (no dimension)
export interface CoincidentConstraint extends ConstraintBase {
  type: "coincident";
  // entities: [point1, point2] or [point, line] etc.
}

export interface HorizontalConstraint extends ConstraintBase {
  type: "horizontal";
  // entities: [line] or [point1, point2]
}

export interface VerticalConstraint extends ConstraintBase {
  type: "vertical";
}

export interface ParallelConstraint extends ConstraintBase {
  type: "parallel";
  // entities: [line1, line2]
}

export interface PerpendicularConstraint extends ConstraintBase {
  type: "perpendicular";
}

export interface TangentConstraint extends ConstraintBase {
  type: "tangent";
}

export interface EqualConstraint extends ConstraintBase {
  type: "equal";
  // equal length for lines, equal radius for arcs/circles
}

export interface FixedConstraint extends ConstraintBase {
  type: "fixed";
  // locks position
}

export interface SymmetricConstraint extends ConstraintBase {
  type: "symmetric";
  // entities: [entity1, entity2, symmetryLine]
}

// Dimensional constraints (have a value)
export interface DistanceConstraint extends ConstraintBase {
  type: "distance";
  dim: DimValue;
}

export interface AngleConstraint extends ConstraintBase {
  type: "angle";
  dim: DimValue;
}

export interface RadiusConstraint extends ConstraintBase {
  type: "radius";
  dim: DimValue;
}

export interface DiameterConstraint extends ConstraintBase {
  type: "diameter";
  dim: DimValue;
}

export type GeometricConstraint =
  | CoincidentConstraint
  | HorizontalConstraint
  | VerticalConstraint
  | ParallelConstraint
  | PerpendicularConstraint
  | TangentConstraint
  | EqualConstraint
  | FixedConstraint
  | SymmetricConstraint;

export type DimensionalConstraint =
  | DistanceConstraint
  | AngleConstraint
  | RadiusConstraint
  | DiameterConstraint;

export type SketchConstraint = GeometricConstraint | DimensionalConstraint;
export type ConstraintType = SketchConstraint["type"];
```

### 1.4 Sketch

```ts
// types/sketch.ts (continued)

export type SolveStatus =
  | "ok"
  | "under-constrained"
  | "over-constrained"
  | "inconsistent"
  | "error";

export interface Sketch {
  id: SketchId;
  planeId: SketchPlaneId;
  primitives: Map<PrimitiveId, SketchPrimitive>;
  constraints: Map<ConstraintId, SketchConstraint>;

  // Solver output
  solvedPositions?: Map<PrimitiveId, Vec2>;  // solved positions for points
  solveStatus?: SolveStatus;
  dof?: number;  // degrees of freedom remaining
}
```

### 1.5 Operations

```ts
// types/ops.ts

/** Reference to a topological element (face, edge, vertex) */
export interface TopoRef {
  opId: OpId;           // which op produced this
  subType: "face" | "edge" | "vertex";
  index: number;        // stable index within that op's output
  // For re-matching after rebuild:
  signature?: {
    center?: Vec3;
    normal?: Vec3;
    area?: number;
    length?: number;
  };
}

interface OpBase {
  id: OpId;
  name: string;
  suppressed: boolean;
}

// === Primary Operations (Sketch -> Solid) ===

export interface ExtrudeOp extends OpBase {
  type: "extrude";
  sketchId: SketchId;
  profiles: PrimitiveId[];  // which closed loops to extrude (empty = all)
  direction: "normal" | "reverse" | "symmetric";
  depth: DimValue;
  draft?: { angle: DimValue; inward: boolean };
}

export interface RevolveOp extends OpBase {
  type: "revolve";
  sketchId: SketchId;
  profiles: PrimitiveId[];
  axis: TopoRef | { origin: Vec3; direction: Vec3 };
  angle: DimValue;  // radians, or full revolution if 2*PI
}

export interface SweepOp extends OpBase {
  type: "sweep";
  profileSketchId: SketchId;
  pathSketchId: SketchId;
}

export interface LoftOp extends OpBase {
  type: "loft";
  profileSketchIds: SketchId[];
  guideSketchIds?: SketchId[];
}

export type PrimaryOp = ExtrudeOp | RevolveOp | SweepOp | LoftOp;

// === Secondary Operations (Solid -> Solid) ===

export interface BooleanOp extends OpBase {
  type: "boolean";
  operation: "union" | "subtract" | "intersect";
  targetOp: OpId;
  toolOp: OpId;
}

export interface FilletOp extends OpBase {
  type: "fillet";
  targetOp: OpId;
  edges: TopoRef[];
  radius: DimValue;
}

export interface ChamferOp extends OpBase {
  type: "chamfer";
  targetOp: OpId;
  edges: TopoRef[];
  distance: DimValue;
  angle?: DimValue;  // if asymmetric
}

export interface ShellOp extends OpBase {
  type: "shell";
  targetOp: OpId;
  facesToRemove: TopoRef[];
  thickness: DimValue;
}

export interface PatternOp extends OpBase {
  type: "pattern";
  targetOp: OpId;
  patternType: "linear" | "circular";
  direction?: Vec3;
  axis?: { origin: Vec3; direction: Vec3 };
  count: number;
  spacing: DimValue;
}

export interface MirrorOp extends OpBase {
  type: "mirror";
  targetOp: OpId;
  plane: SketchPlaneId | TopoRef;
}

export type SecondaryOp =
  | BooleanOp
  | FilletOp
  | ChamferOp
  | ShellOp
  | PatternOp
  | MirrorOp;

// === Sketch Operation (creates a sketch on a plane/face) ===

export interface SketchOp extends OpBase {
  type: "sketch";
  sketchId: SketchId;
  planeRef: SketchPlaneId | TopoRef;  // datum plane or face reference
}

export type Op = SketchOp | PrimaryOp | SecondaryOp;
export type OpType = Op["type"];
```

### 1.6 Part Studio & Part

```ts
// types/part.ts

/** Mesh data for rendering */
export interface Mesh {
  positions: Float32Array;  // xyz xyz xyz...
  normals: Float32Array;    // xyz xyz xyz...
  indices: Uint32Array;     // triangle indices
}

/** Material properties */
export interface Material {
  color: Vec3;        // RGB 0-1
  metalness: number;  // 0-1
  roughness: number;  // 0-1
  opacity: number;    // 0-1
}

export const DEFAULT_MATERIAL: Material = {
  color: [0.7, 0.7, 0.8],
  metalness: 0.1,
  roughness: 0.5,
  opacity: 1.0,
};

/** A node in the operation graph */
export interface OpNode {
  op: Op;
  deps: OpId[];  // operations this depends on
}

/** Evaluated state for an operation */
export interface OpResult {
  shapeHandle: number;  // OCC shape handle
  mesh?: Mesh;
  topoMap: {
    faces: TopoRef[];
    edges: TopoRef[];
    vertices: TopoRef[];
  };
}

/** A Part Studio contains sketches and operations */
export interface PartStudio {
  id: Id<"PartStudio">;
  name: string;

  planes: Map<SketchPlaneId, SketchPlane>;
  sketches: Map<SketchId, Sketch>;
  opGraph: Map<OpId, OpNode>;
  opOrder: OpId[];  // topologically sorted

  // Runtime state (populated after rebuild)
  results?: Map<OpId, OpResult>;
}

/** A Part is a materialized solid from a PartStudio */
export interface Part {
  id: PartId;
  name: string;
  studioId: Id<"PartStudio">;
  finalOpId: OpId;  // which op produces this part
  material: Material;

  // Cached for rendering
  mesh?: Mesh;
}
```

### 1.7 Assembly

```ts
// types/assembly.ts

/** Transform for positioning a part */
export interface Transform {
  rotation: Mat3;
  translation: Vec3;
}

export const IDENTITY_TRANSFORM: Transform = {
  rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  translation: [0, 0, 0],
};

/** An instance of a part in an assembly */
export interface PartInstance {
  id: Id<"PartInstance">;
  partId: PartId;
  transform: Transform;
  fixed: boolean;  // if true, cannot be moved by constraints
}

/** Assembly constraints */
interface AssemblyConstraintBase {
  id: Id<"AssemblyConstraint">;
  instanceA: Id<"PartInstance">;
  instanceB: Id<"PartInstance">;
}

export interface MateConstraint extends AssemblyConstraintBase {
  type: "mate";
  refA: TopoRef;  // face/edge/point on A
  refB: TopoRef;  // face/edge/point on B
  mateType: "coincident" | "parallel" | "perpendicular";
  offset?: DimValue;
}

export interface AxisConstraint extends AssemblyConstraintBase {
  type: "axis";
  refA: TopoRef;
  refB: TopoRef;
  axisType: "concentric" | "coaxial";
}

export interface DistanceConstraint extends AssemblyConstraintBase {
  type: "distance";
  refA: TopoRef;
  refB: TopoRef;
  distance: DimValue;
}

export type AssemblyConstraint =
  | MateConstraint
  | AxisConstraint
  | DistanceConstraint;

export interface Assembly {
  id: AssemblyId;
  name: string;
  instances: Map<Id<"PartInstance">, PartInstance>;
  constraints: Map<Id<"AssemblyConstraint">, AssemblyConstraint>;

  // Solved transforms
  solvedTransforms?: Map<Id<"PartInstance">, Transform>;
}
```

### 1.8 Parameters

```ts
// types/params.ts

export interface Parameter {
  id: ParamId;
  name: string;
  expression: string;  // e.g. "10", "Width * 0.5", "Height + 2"
  value: number;       // evaluated result
  unit?: string;       // "mm", "in", "deg", etc. (display only for v1)
}

export interface ParamEnv {
  params: Map<ParamId, Parameter>;
  errors: Map<ParamId, string>;  // evaluation errors
}
```

### 1.9 Document

```ts
// types/document.ts

/** Top-level document containing everything */
export interface Document {
  id: Id<"Document">;
  name: string;

  params: ParamEnv;
  partStudios: Map<Id<"PartStudio">, PartStudio>;
  parts: Map<PartId, Part>;
  assemblies: Map<AssemblyId, Assembly>;
}
```

---

## 2. Module Specifications

### 2.1 Sketch Module (`packages/core/src/sketch/`)

```ts
// sketch/index.ts - public API

/** Add a primitive to a sketch */
export function addPrimitive(sketch: Sketch, primitive: SketchPrimitive): Sketch;

/** Remove a primitive (also removes constraints referencing it) */
export function removePrimitive(sketch: Sketch, id: PrimitiveId): Sketch;

/** Add a constraint */
export function addConstraint(sketch: Sketch, constraint: SketchConstraint): Sketch;

/** Remove a constraint */
export function removeConstraint(sketch: Sketch, id: ConstraintId): Sketch;

/** Update a dimensional constraint's value */
export function setDimValue(
  sketch: Sketch,
  constraintId: ConstraintId,
  dim: DimValue
): Sketch;

/** Find closed loops in the sketch for profiling */
export function findClosedLoops(sketch: Sketch): PrimitiveId[][];

/** Transform sketch coordinates to world coordinates */
export function sketchToWorld(
  point: Vec2,
  plane: SketchPlane
): Vec3;

export function worldToSketch(
  point: Vec3,
  plane: SketchPlane
): Vec2;
```

```ts
// sketch/solver.ts

export interface SolveResult {
  positions: Map<PrimitiveId, Vec2>;
  status: SolveStatus;
  dof: number;
}

/** Solve sketch constraints using SolveSpace */
export function solveSketch(
  sketch: Sketch,
  params: ParamEnv,
  slvs: SlvsApi
): SolveResult;
```

### 2.2 Operations Module (`packages/core/src/ops/`)

```ts
// ops/index.ts

export interface EvalContext {
  occ: OccApi;
  slvs: SlvsApi;
  params: ParamEnv;
  studio: PartStudio;
}

/** Evaluate a single operation */
export function evalOp(op: Op, ctx: EvalContext): OpResult;

/** Resolve a TopoRef to an OCC handle */
export function resolveTopoRef(
  ref: TopoRef,
  results: Map<OpId, OpResult>
): number | undefined;
```

### 2.3 Part Studio Module (`packages/core/src/part-studio/`)

```ts
// part-studio/index.ts

/** Build dependency graph and return topologically sorted op order */
export function buildOpOrder(opGraph: Map<OpId, OpNode>): OpId[];

/** Detect cycles in the op graph */
export function detectCycles(opGraph: Map<OpId, OpNode>): OpId[][] | null;

/** Full rebuild of a part studio */
export function rebuild(
  studio: PartStudio,
  params: ParamEnv,
  occ: OccApi,
  slvs: SlvsApi
): PartStudio;

/** Incremental rebuild starting from a changed op */
export function rebuildFrom(
  studio: PartStudio,
  changedOpId: OpId,
  params: ParamEnv,
  occ: OccApi,
  slvs: SlvsApi
): PartStudio;
```

### 2.4 Parameters Module (`packages/core/src/params/`)

```ts
// params/index.ts

/** Parse and evaluate all parameters, detecting cycles and errors */
export function evaluateParams(env: ParamEnv): ParamEnv;

/** Evaluate a DimValue given the current param environment */
export function evalDimValue(dim: DimValue, env: ParamEnv): number;

/** Get all parameters that a given expression depends on */
export function getExpressionDeps(expression: string): string[];
```

```ts
// params/parser.ts

export type Expr =
  | { type: "number"; value: number }
  | { type: "ident"; name: string }
  | { type: "binary"; op: "+" | "-" | "*" | "/" | "^"; left: Expr; right: Expr }
  | { type: "unary"; op: "-"; arg: Expr }
  | { type: "call"; fn: string; args: Expr[] };

export function parseExpression(input: string): Expr;
export function evalExpression(expr: Expr, vars: Record<string, number>): number;
```

### 2.5 History Module (`packages/core/src/history/`)

```ts
// history/index.ts

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function pushState<T>(history: HistoryState<T>, state: T): HistoryState<T>;
export function undo<T>(history: HistoryState<T>): HistoryState<T>;
export function redo<T>(history: HistoryState<T>): HistoryState<T>;
export function canUndo<T>(history: HistoryState<T>): boolean;
export function canRedo<T>(history: HistoryState<T>): boolean;
```

---

## 3. Kernel Bindings (`packages/kernel/`)

### 3.1 SolveSpace (`kernel/src/slvs.ts`)

```ts
export interface SlvsApi {
  // Group management
  createGroup(): number;
  freeGroup(groupId: number): void;

  // Points (in 2D workplane)
  addPoint2d(groupId: number, x: number, y: number): number;
  getPoint2d(pointId: number): { x: number; y: number };

  // Lines
  addLine2d(groupId: number, p1: number, p2: number): number;

  // Arcs
  addArc2d(
    groupId: number,
    center: number,
    start: number,
    end: number
  ): number;

  // Circles
  addCircle2d(groupId: number, center: number, radius: number): number;

  // Constraints
  addCoincident(groupId: number, p1: number, p2: number): number;
  addHorizontal(groupId: number, line: number): number;
  addVertical(groupId: number, line: number): number;
  addDistance(groupId: number, p1: number, p2: number, dist: number): number;
  addAngle(groupId: number, l1: number, l2: number, angle: number): number;
  addParallel(groupId: number, l1: number, l2: number): number;
  addPerpendicular(groupId: number, l1: number, l2: number): number;
  addEqual(groupId: number, e1: number, e2: number): number;
  addTangent(groupId: number, e1: number, e2: number): number;
  addPointOnLine(groupId: number, pt: number, line: number): number;
  addRadius(groupId: number, circle: number, radius: number): number;

  // Solving
  solve(groupId: number): {
    ok: boolean;
    dof: number;
    status: "ok" | "over" | "under" | "inconsistent";
  };
}

export function loadSlvs(): Promise<SlvsApi>;
```

### 3.2 OpenCascade (`kernel/src/occ.ts`)

```ts
export type ShapeHandle = number;
export type FaceHandle = number;
export type EdgeHandle = number;
export type VertexHandle = number;

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export interface OccApi {
  // Wire/face creation
  makePolygon(points: Vec3[]): ShapeHandle;
  makeWire(edges: ShapeHandle[]): ShapeHandle;
  makeFace(wire: ShapeHandle): ShapeHandle;

  // Primary operations
  extrude(face: ShapeHandle, direction: Vec3, depth: number): ShapeHandle;
  revolve(
    face: ShapeHandle,
    axisOrigin: Vec3,
    axisDir: Vec3,
    angleRad: number
  ): ShapeHandle;
  sweep(profile: ShapeHandle, path: ShapeHandle): ShapeHandle;
  loft(profiles: ShapeHandle[]): ShapeHandle;

  // Boolean operations
  fuse(a: ShapeHandle, b: ShapeHandle): ShapeHandle;
  cut(a: ShapeHandle, b: ShapeHandle): ShapeHandle;
  intersect(a: ShapeHandle, b: ShapeHandle): ShapeHandle;

  // Modification operations
  fillet(shape: ShapeHandle, edges: EdgeHandle[], radius: number): ShapeHandle;
  chamfer(shape: ShapeHandle, edges: EdgeHandle[], distance: number): ShapeHandle;
  shell(shape: ShapeHandle, facesToRemove: FaceHandle[], thickness: number): ShapeHandle;

  // Topology queries
  getFaces(shape: ShapeHandle): FaceHandle[];
  getEdges(shape: ShapeHandle): EdgeHandle[];
  getVertices(shape: ShapeHandle): VertexHandle[];

  // Geometry queries
  faceCenter(face: FaceHandle): Vec3;
  faceNormal(face: FaceHandle): Vec3;
  faceArea(face: FaceHandle): number;
  edgeMidpoint(edge: EdgeHandle): Vec3;
  edgeLength(edge: EdgeHandle): number;

  // Meshing
  mesh(shape: ShapeHandle, deflection: number): MeshData;

  // Memory management
  freeShape(shape: ShapeHandle): void;
}

export function loadOcc(): Promise<OccApi>;
```

---

## 4. Frontend (`app/web/`)

### 4.1 State Management

Use a simple store (zustand or similar):

```ts
// store/cad-store.ts

interface CadStore {
  document: Document;
  history: HistoryState<Document>;
  activeStudioId: Id<"PartStudio"> | null;
  activeSketchId: SketchId | null;
  selection: Set<string>;  // selected entity IDs

  // Actions
  dispatch(action: CadAction): void;
  undo(): void;
  redo(): void;
  rebuild(): Promise<void>;
}
```

### 4.2 Components

**Viewport3D.tsx**: Three.js scene rendering parts
- Orbit controls
- Selection via raycasting
- Highlight faces/edges on hover

**SketchCanvas.tsx**: 2D sketch editing overlay
- Renders solved sketch geometry
- Tools: point, line, arc, circle
- Constraint visualization (dimension labels, coincident markers)
- Direct dimension editing

**FeatureTree.tsx**: Operation list
- Show opOrder with icons
- Drag to reorder
- Toggle suppressed
- Rename operations

**ParamPanel.tsx**: Global parameters
- Add/edit/delete parameters
- Show expression errors
- Link dimensions to parameters

---

## 5. Implementation Order

### Phase 1: Types & Structure
1. Define all types in `packages/core/src/types/`
2. Set up package exports and build
3. Create stub APIs for OCC and SLVS

### Phase 2: Sketch Core
1. Implement sketch primitive operations (add/remove)
2. Implement constraint operations
3. Implement `findClosedLoops`
4. Create dummy solver (returns initial positions)

### Phase 3: Part Studio Core
1. Implement op graph building and topological sort
2. Implement rebuild loop (with stubs for ops)
3. Implement extrude op (simplest primary op)

### Phase 4: Basic UI
1. Three.js viewport rendering hardcoded mesh
2. Feature tree showing ops
3. Basic sketch canvas (view only)

### Phase 5: WASM Integration
1. Integrate OpenCascade WASM
2. Real extrude → mesh pipeline
3. Integrate SolveSpace WASM
4. Real constraint solving

### Phase 6: Full Loop
1. Sketch editing tools
2. Constraint tools with dimensions
3. Parameter panel with expressions
4. Undo/redo

### Phase 7: Polish
1. More operations (revolve, fillet, boolean)
2. Face/edge selection for references
3. Assembly basics

---

## 6. Coding Standards

- **TypeScript strict mode** everywhere
- **Immutable updates**: functions return new objects, don't mutate
- **No `any`** except at WASM boundaries (and then wrap immediately)
- **Small, focused functions** with clear inputs/outputs
- **Tests** for core logic (params parser, graph algorithms)
- **Dependency injection** for OCC/SLVS APIs

---

## 7. Key Invariants

1. **OpGraph is always acyclic** - validate on every edit
2. **Sketches reference valid planes** - plane deletion cascades or blocks
3. **TopoRefs are best-effort** - rebuilds may invalidate; handle gracefully
4. **Parameters form a DAG** - detect cycles during evaluation
5. **All IDs are globally unique** - use UUID or prefixed counters
