you are the implementation agent for **vibeCAD**, a browser-native, sketch-plane + constraint-based + feature-driven CAD system.

you are starting from this monorepo root:

```text
.
├── app
│   ├── admin
│   ├── desktop
│   ├── mobile
│   ├── public
│   └── web
├── packages
│   ├── core
│   ├── kernel
│   └── db
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
└── turbo.json
```

assume: pnpm workspace, typescript everywhere, react in `app/*`. focus on **CAD logic and UI**. ignore “saas” concerns: auth, billing, multi-tenant, db, etc. `packages/db` can stay stubby.

your job: transform this into a **real parametric CAD** stack:

* sketch-plane editing (2d in arbitrary planes)
* constraint solving via **SolveSpace** core in wasm
* 3d solids via **OpenCascade (OCC)** in wasm
* feature DAG (feature tree) driving evaluation
* global parameter / expression system
* undo/redo
* interactive 3d viewport (three.js) + 2d sketch overlay

the output should be high-quality, modular, and production-upgradeable later.

---

## 0. general rules

* write clean, typed **typescript**. no `any` except at wasm boundaries.
* keep **core CAD logic framework-agnostic** in `packages/core`. frontends import it.
* frontends (`app/web` etc) are react-based shells that do rendering + input + wiring.
* prefer pure functions + small state containers over random mutation.
* when integrating wasm, isolate in thin adapters so rest of code sees clean TS APIs.
* keep initial implementation **mvp but structurally correct**; favor clear abstractions even if some ops are stubbed.

---

## 1. code organization (monorepo mapping)

you must reorganize / extend the repo roughly like this:

```text
packages/
  core/
    src/
      cad/
        params/           # parameter + expression system
        sketch/           # sketch model + slvs integration
        kernel/           # occ integration, topology index
        feature/          # feature DAG + evaluation
        history/          # undo/redo
        types/            # shared CAD types
      runtime/            # orchestration, rebuild loop
      index.ts            # public api surface

  # optional (if helpful to keep wasm clean)
  kernel-wasm/
    src/
      occ.ts              # raw bindings
      slvs.ts             # raw bindings
      loader.ts           # wasm loading helpers

app/
  web/
    src/
      main.tsx / index.tsx
      cad-view/           # react components (viewport, panels, etc)
        Viewport3D.tsx
        SketchCanvas.tsx
        FeatureTree.tsx
        ParamPanel.tsx
```

* ensure `packages/core/package.json` exposes `main` + `types` pointing to built files.
* make `app/web` depend on `@vibecad/core` (or whatever name is set in `packages/core/package.json`).

---

## 2. core data model (define in `packages/core/src/types/`)

you must define the fundamental types for the CAD engine. do not half-ass this; these types drive everything.

### 2.1 basic ids + vectors

```ts
export type Id = string;

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
```

### 2.2 parameters + expressions

in `params/types.ts`:

```ts
export type ParamId = string;

export interface Parameter {
  id: ParamId;
  name: string;
  value: number;          // evaluated numeric value
  expression?: string;    // optional expression, e.g. "BaseWidth * 0.5"
}

export interface ParamEnv {
  byId: Record<ParamId, Parameter>;
}
```

you must also define an `ExpressionError` type for validation feedback.

### 2.3 sketch planes

in `sketch/types.ts`:

```ts
export type PlaneId = string;

export interface SketchPlane {
  id: PlaneId;
  origin: Vec3;
  xAxis: Vec3;
  yAxis: Vec3;
  reference:
    | { type: "datum" }
    | { type: "faceRef"; faceRefId: string }; // see topology refs later
}
```

### 2.4 sketch entities + constraints

```ts
export type SketchId = string;

export type SketchEntityType =
  | "point"
  | "line"
  | "arc"
  | "circle"
  | "spline";

export interface SketchEntityBase {
  id: Id;
  type: SketchEntityType;
  construction?: boolean; // construction / reference geometry
}

export interface SketchPoint extends SketchEntityBase {
  type: "point";
  x: number;
  y: number;
}

export interface SketchLine extends SketchEntityBase {
  type: "line";
  startPointId: Id;
  endPointId: Id;
}

// TODO: define SketchArc, SketchCircle, SketchSpline similarly.

export type ConstraintKind =
  | "coincident"
  | "horizontal"
  | "vertical"
  | "parallel"
  | "perpendicular"
  | "tangent"
  | "distance"
  | "angle"
  | "equalLength"
  | "radius"
  | "fix";

export interface DimensionExpr {
  paramId?: ParamId;        // if linked to a parameter
  rawExpression?: string;   // if directly typed
  value: number;            // evaluated numeric
}

export interface SketchConstraint {
  id: Id;
  kind: ConstraintKind;
  entityIds: Id[];
  dimension?: DimensionExpr; // for distance/angle/radius constraints
}

export type SketchSolveStatus = "ok" | "overconstrained" | "underconstrained" | "unsolved";

export interface Sketch {
  id: SketchId;
  planeId: PlaneId;
  entities: SketchEntityBase[];
  constraints: SketchConstraint[];
  solvedPoints?: Record<Id, Vec2>;
  solveStatus?: SketchSolveStatus;
}
```

### 2.5 feature dag + references

in `feature/types.ts`:

```ts
export type FeatureId = string;

export type FeatureType =
  | "sketch"
  | "extrude"
  | "revolve"
  | "fillet"
  | "chamfer"
  | "shell"
  | "boolean";

export type BooleanOp = "union" | "subtract" | "intersect";

// logical reference to a specific subshape, stable across rebuilds as best effort
export type ShapeRefId = string;

export interface BodyRef {
  featureId: FeatureId; // which feature produced this body
  localName: string;    // stable logical name inside that feature (e.g. "mainBody")
}

export interface FaceRef extends BodyRef {
  subType: "face";
}

export interface EdgeRef extends BodyRef {
  subType: "edge";
}

export interface VertexRef extends BodyRef {
  subType: "vertex";
}

export interface FeatureBase {
  id: FeatureId;
  type: FeatureType;
  name: string;
  dependsOn: FeatureId[];
  suppressed?: boolean;
}
```

concrete feature types:

```ts
export interface SketchFeature extends FeatureBase {
  type: "sketch";
  sketchId: SketchId;
}

export type TargetSide = "symmetric" | "oneSide" | "twoSide";

export interface ExtrudeFeature extends FeatureBase {
  type: "extrude";
  sketchFeatureId: FeatureId;
  targetSide: TargetSide;
  distanceParamId?: ParamId;
  startOffsetParamId?: ParamId;
  endOffsetParamId?: ParamId;
  operation: "newBody" | "add" | "cut" | "intersect";
  targetBody?: BodyRef;
}

export interface FilletFeature extends FeatureBase {
  type: "fillet";
  radiusParamId: ParamId;
  edgeRefs: EdgeRef[];
}

export interface BooleanFeature extends FeatureBase {
  type: "boolean";
  operation: BooleanOp;
  targetBody: BodyRef;
  toolBody: BodyRef;
}

export type Feature =
  | SketchFeature
  | ExtrudeFeature
  | FilletFeature
  | BooleanFeature
  // add revolve, chamfer, shell later
  ;
```

### 2.6 part document + runtime

in `cad/types.ts`:

```ts
export interface TopologyIndex {
  // logical body name -> actual occ handle + its subshape metadata
  bodies: Record<string, TopoNode>;
}

export interface TopoNode {
  bodyHandle: number; // OCC shape handle (opaque)
  faceHandles: number[];
  edgeHandles: number[];
  vertexHandles: number[];

  faceMeta: Record<number, {
    center: Vec3;
    normal: Vec3;
    area: number;
  }>;

  edgeMeta: Record<number, {
    midpoint: Vec3;
    length: number;
  }>;
}

export interface RuntimeState {
  shapesByFeature: Record<FeatureId, number>; // OCC shape handles
  topologyIndex: TopologyIndex;
  featureOrder: FeatureId[];                 // topo-sorted order
}

export interface PartDocument {
  id: string;
  params: ParamEnv;
  planes: Record<PlaneId, SketchPlane>;
  sketches: Record<SketchId, Sketch>;
  features: Feature[];
  runtime?: RuntimeState;   // populated after rebuild
}
```

---

## 3. params & expression engine (`packages/core/src/cad/params/`)

you must implement:

* parsing + evaluation of parameter expressions
* dependency graph + topo sorting
* error reporting for cycles / unknown symbols

constraints:

* use a small, safe expression parser (you can implement your own recursive descent or integrate a tiny library, but wrap it so rest of code doesn’t care).
* support:

  * numeric literals
  * `+ - * / ^`
  * parentheses
  * references to parameter names (case-sensitive or normalized; pick one and stick to it).

core functions:

```ts
export function evaluateParameters(env: ParamEnv): {
  env: ParamEnv;
  errors: ExpressionError[];
};

export function evalDimensionExpr(
  dim: DimensionExpr,
  env: ParamEnv
): { value: number; error?: ExpressionError };
```

* you must store evaluated numeric values back into `Parameter.value`.
* dimension constraints use `paramId` if present; otherwise evaluate their `rawExpression` in the same env.

---

## 4. sketch system + SolveSpace (`packages/core/src/cad/sketch/`)

goal: maintain our sketch model in TS, and delegate solving to SolveSpace (slvs) compiled to wasm.

### 4.1 wasm boundary

create `packages/kernel-wasm/src/slvs.ts` (or similar) that exposes a clean api:

```ts
export interface SlvsPoint { id: number; x: number; y: number; }
export type SlvsConstraintKind = /* mirror of solvspace constraint enums */;

export interface SlvsConstraintArgs { /* depends on kind */ }

export interface SlvsSolveResult {
  ok: boolean;
  overconstrained: boolean;
  underconstrained: boolean;
  points: Record<number, SlvsPoint>;
}

export interface SlvsApi {
  createGroup(): number;
  addPoint(groupId: number, x: number, y: number): number;
  addLine(groupId: number, p1Id: number, p2Id: number): number;
  addConstraint(
    groupId: number,
    kind: SlvsConstraintKind,
    args: SlvsConstraintArgs
  ): number;
  solveGroup(groupId: number): SlvsSolveResult;
}
```

you must also implement a **loader** that initializes the wasm module once and returns a singleton `SlvsApi`.

### 4.2 mapping sketch ↔ slvs

in `sketch/solver.ts`:

* maintain per-sketch mapping:

```ts
interface SketchRuntimeMapping {
  groupId: number;
  pointMap: Record<Id, number>;    // sketch point id -> slvs point id
  // optionally lineMap, etc, if needed
}

export interface SketchRuntimeState {
  bySketchId: Record<SketchId, SketchRuntimeMapping>;
}
```

* implement:

```ts
export function solveSketch(
  sketch: Sketch,
  params: ParamEnv,
  slvs: SlvsApi,
  runtime: SketchRuntimeState
): { sketch: Sketch; runtime: SketchRuntimeState };
```

algorithm:

1. ensure sketch has a `groupId` and point mapping; if not, create:

   * for each `SketchPoint`, call `addPoint` in slvs.
2. for non-point entities, call slvs functions to create lines/arcs/etc, using mapped point ids.
3. for each constraint:

   * if dimensional:

     * compute numeric value via `evalDimensionExpr`.
   * call `addConstraint` with the right arguments.
4. call `solveGroup`.
5. map solved `SlvsPoint` back into `sketch.solvedPoints` using `pointMap`.
6. set `solveStatus` appropriately.

implement simple error handling:

* if solve fails, keep last good `solvedPoints` but mark status as over/underconstrained.

### 4.3 3d placement helpers

add utilities:

```ts
export function sketchPointToWorld(
  sketch: Sketch,
  planes: Record<PlaneId, SketchPlane>,
  pointId: Id
): Vec3 | undefined;
```

* use `SketchPlane.origin + x * xAxis + y * yAxis`.

add helper to compute **closed loops** from sketch geometry for later extrusion.

---

## 5. OCC kernel integration (`packages/kernel-wasm/src/occ.ts` + `packages/core/src/cad/kernel/`)

### 5.1 wasm boundary

in `kernel-wasm/occ.ts` provide an api like:

```ts
export type ShapeHandle = number;
export type FaceHandle = number;
export type EdgeHandle = number;
export type VertexHandle = number;

export interface MeshData {
  vertices: Float32Array; // xyzxyz...
  indices: Uint32Array;   // triangles
}

export interface OccApi {
  makeWireFromPoints(points: Vec3[]): ShapeHandle;
  makeFaceFromWire(wire: ShapeHandle): ShapeHandle;
  extrude(face: ShapeHandle, dir: Vec3, length: number): ShapeHandle;
  revolve(
    face: ShapeHandle,
    axisOrigin: Vec3,
    axisDir: Vec3,
    angleRad: number
  ): ShapeHandle;

  boolean(op: "union" | "cut" | "intersect", a: ShapeHandle, b: ShapeHandle): ShapeHandle;

  fillet(body: ShapeHandle, edges: EdgeHandle[], radius: number): ShapeHandle;
  shell(body: ShapeHandle, faces: FaceHandle[], thickness: number): ShapeHandle;

  getFaces(body: ShapeHandle): FaceHandle[];
  getEdges(body: ShapeHandle): EdgeHandle[];
  getVertices(body: ShapeHandle): VertexHandle[];

  faceCenter(face: FaceHandle): Vec3;
  faceNormal(face: FaceHandle): Vec3;
  faceArea(face: FaceHandle): number;

  edgeMidpoint(edge: EdgeHandle): Vec3;
  edgeLength(edge: EdgeHandle): number;

  mesh(body: ShapeHandle, tolerance: number): MeshData;
}
```

again: add a loader that initializes the OCC wasm once and returns an `OccApi` instance.

### 5.2 topology indexing

in `kernel/topology.ts`:

* build and maintain `TopologyIndex`:

```ts
export function buildTopologyIndexForBody(
  logicalName: string,
  body: ShapeHandle,
  occ: OccApi
): TopoNode { /* fill out faceHandles, edgeHandles, vertexHandles, faceMeta, edgeMeta */ }

export function matchFaceRef(
  ref: FaceRef,
  index: TopologyIndex
): FaceHandle | undefined;

export function matchEdgeRef(
  ref: EdgeRef,
  index: TopologyIndex
): EdgeHandle | undefined;
```

for now, use **geometric signatures**:

* for a `FaceRef`, store approximate center + normal + area at the time of creation.
* on rebuild, to resolve it:

  * find face with closest center within epsilon, similar normal, similar area.

store this signature inside the logical reference meta (you can extend `FaceRef` with extra fields if needed; or maintain a side-map).

### 5.3 feature evaluation

in `feature/eval.ts`:

```ts
export interface EvalContext {
  occ: OccApi;
  slvs: SlvsApi;
  doc: PartDocument;
  sketchRuntime: SketchRuntimeState;
  shapesByFeature: Record<FeatureId, ShapeHandle>;
  topoIndex: TopologyIndex;
}

export function evalFeature(
  feat: Feature,
  ctx: EvalContext
): void { /* dispatch by type */ }
```

implement at least:

#### sketch feature:

* just ensures the sketch is solved (call `solveSketch`).
* doesn’t create a solid; you can store something in runtime if needed but `shapesByFeature` can skip it.

#### extrude feature:

1. find the linked `SketchFeature` + `Sketch`.
2. ensure sketch solved.
3. build loops → 3d wires:

   * use `sketch.solvedPoints` + `sketchPointToWorld`.
   * you can assume one outer closed polygon for v1.
4. convert to OCC:

   * `wire = occ.makeWireFromPoints(points)`
   * `face = occ.makeFaceFromWire(wire)`
5. get numeric distance from `params[distanceParamId].value`.
6. call `occ.extrude(face, dir, length)`.

   * for now, take `dir` = plane normal; later support picking.
7. depending on `operation`:

   * `newBody` → this becomes a standalone body
   * `add` / `cut` / `intersect` → resolve `targetBody` from `shapesByFeature`, call `occ.boolean`.
8. assign logical body name (e.g. `feat.id + ":body"`), build topology node, add to `TopologyIndex`.
9. store `shapesByFeature[feat.id] = resultBody`.

#### fillet feature:

1. resolve target body from `dependsOn[0]`.
2. resolve each `EdgeRef` using `matchEdgeRef` and topology index.
3. get radius from param env.
4. call `occ.fillet`.
5. store result + update topology index.

#### boolean feature:

same pattern as extrude’s boolean case.

---

## 6. feature dag + rebuild loop (`packages/core/src/cad/feature/graph.ts` + `runtime/rebuild.ts`)

### 6.1 graph

implement a small feature graph:

```ts
export interface FeatureGraph {
  nodes: Record<FeatureId, Feature>;
  order: FeatureId[]; // topo-sorted
}

export function buildFeatureGraph(features: Feature[]): FeatureGraph;
```

* use `dependsOn` to topo-sort.
* if no explicit `dependsOn` is set, treat each feature as depending on the previous non-suppressed feature.
* detect cycles and surface an error.

### 6.2 rebuild

in `runtime/rebuild.ts`:

```ts
export interface RebuildResult {
  doc: PartDocument;
  sketchRuntime: SketchRuntimeState;
}

export async function rebuild(
  doc: PartDocument,
  occ: OccApi,
  slvs: SlvsApi
): Promise<RebuildResult>;
```

process:

1. evaluate parameters: `evaluateParameters`.
2. build feature graph.
3. solve all sketches referenced by sketch features, updating `doc.sketches` + `sketchRuntime`.
4. iterate in topo order:

   * skip suppressed features.
   * call `evalFeature`.
5. populate `doc.runtime = { shapesByFeature, topologyIndex, featureOrder }`.
6. return updated doc + sketchRuntime.

keep v1 as **full rebuild**. don’t do incremental optimizations yet.

---

## 7. undo/redo (`packages/core/src/cad/history/`)

implement immutable-ish command-based history.

types:

```ts
export type CommandType =
  | "createSketch"
  | "addSketchEntity"
  | "addSketchConstraint"
  | "editSketchConstraintDim"
  | "createFeature"
  | "editFeatureParam"
  | "reorderFeatures"
  | "editParam"
  | "deleteFeature"
  | "deleteSketch";

export interface Command<TPayload = any> {
  type: CommandType;
  payload: TPayload;
}

export interface HistoryState {
  past: PartDocument[];
  present: PartDocument;
  future: PartDocument[];
}
```

functions:

```ts
export function applyCommand(doc: PartDocument, cmd: Command): PartDocument;
export function dispatch(history: HistoryState, cmd: Command): HistoryState;
export function undo(history: HistoryState): HistoryState;
export function redo(history: HistoryState): HistoryState;
```

* `applyCommand` must be pure; clone only the necessary parts (use structured cloning patterns, or careful spread).
* after each `dispatch`, the frontend is responsible for calling `rebuild`.

---

## 8. web app integration (`app/web/src`)

you must build a **minimal but functional** CAD ui:

### 8.1 state

* store `PartDocument`, `HistoryState`, and `sketchRuntime` in react state (or a small store).
* when user edits anything:

  * create a `Command`
  * call `dispatch`
  * then call `rebuild` (async), then update state with the rebuilt doc.

### 8.2 viewport (three.js)

in `cad-view/Viewport3D.tsx`:

* initialize a three.js scene + camera + controls.
* watch `doc.runtime.shapesByFeature`.
* for each body:

  * call `occ.mesh(shapeHandle, tolerance)` (via a hook that has access to OCC).
  * convert `MeshData` into a `THREE.BufferGeometry`.
  * render with a standard material.
* implement simple selection:

  * raycast meshes, map back to feature/body; later extend to face-level by encoding handles in attributes.

### 8.3 sketch canvas

in `cad-view/SketchCanvas.tsx`:

* when user is in “sketch mode” on a given sketch:

  * render 2d entities from `sketch.entities` + `sketch.solvedPoints` into an overlay canvas/SVG.
  * handle tools:

    * add point
    * add line
    * add coincident constraint
    * add distance dimension (popup to link to param or enter expression)
* simple hit-testing: compute nearest entity to cursor within some px radius.

you don’t need full-blown nice UX yet; just prove the loop:

1. create sketch on xy plane.
2. draw rectangle via lines.
3. add distance dimensions with expressions.
4. extrude feature referencing that sketch.
5. edit param; see 3d update.

### 8.4 feature tree / param panel

* `FeatureTree.tsx`:

  * list features in `doc.runtime.featureOrder`.
  * show type icon + name.
  * allow toggling suppressed.
* `ParamPanel.tsx`:

  * list all `Parameter`s with editable `name`, `expression`.
  * editing expression triggers history + rebuild.

---

## 9. implementation priorities / phases

you must execute roughly in this order:

1. **types + core structures**:

   * define all CAD types, param types, feature types, part document.
   * stub out OCC + slvs TS interfaces (without actual WASM glue yet).
2. **param engine**:

   * implement expression parsing + evaluation for params + dimensions.
3. **sketch subsystem**:

   * implement in-memory sketch editing utilities (add entities, constraints).
   * implement dummy solver first (no-op, just uses initial coordinates).
   * later swap in real `slvs` integration.
4. **feature dag + rebuild**:

   * implement graph + rebuild that just creates placeholder meshes.
5. **web app**:

   * basic React app that can:

     * create a sketch
     * add lines
     * create a single extrude feature
     * show a fake cube in three.js.
6. **integrate OCC wasm**:

   * hook up actual `extrude` + meshing into viewport.
7. **integrate SolveSpace wasm**:

   * hook up real constraint solving for sketches.
   * support distance dimensions driven by params.
8. **undo/redo**:

   * wire command-based history with rebuilds.

at each phase: keep the repo **buildable** and **type-correct**. prefer small, incremental commits.

---

## 10. coding standards

* strict typescript (`strict: true`).
* no magical globals; dependency injection for `OccApi` and `SlvsApi`.
* document non-trivial functions with short comments focusing on **why** and invariants.
* avoid premature performance hacks; focus on clarity and correctness.
* separate **pure state transformations** (in core) from **io/render** (in app).

---

your goal: given this prompt and the existing skeleton, iteratively implement the described architecture so that `app/web` becomes a working prototype of a **sketch-plane, constraint-driven, feature-based CAD** running entirely in the browser, backed by SolveSpace + OpenCascade wasm, with a clean TS core in `packages/core`.
