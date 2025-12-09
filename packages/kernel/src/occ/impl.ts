/**
 * OpenCascade.js implementation of the OCC API.
 */

import type { Vec3 } from "@vibecad/core";
import type {
  OccApi,
  ShapeHandle,
  FaceHandle,
  EdgeHandle,
  VertexHandle,
  MeshData,
  ProjectionResult,
  ProjectedEdge2D,
  ProjectedEdgeType,
} from "./api";
import type { OpenCascadeInstance } from "./loader";

/**
 * Shape storage - maps handles to actual OCC objects.
 * We use numeric handles so we can serialize references.
 */
class ShapeStore {
  private shapes = new Map<number, any>();
  private nextHandle = 1;

  store(shape: any): number {
    const handle = this.nextHandle++;
    this.shapes.set(handle, shape);
    return handle;
  }

  get(handle: number): any {
    const shape = this.shapes.get(handle);
    if (!shape) {
      throw new Error(`Shape not found: ${handle}`);
    }
    return shape;
  }

  free(handle: number): void {
    this.shapes.delete(handle);
  }

  clear(): void {
    this.shapes.clear();
  }
}

/**
 * Real OpenCascade.js implementation of OccApi.
 */
export class OccApiImpl implements OccApi {
  private store = new ShapeStore();

  constructor(private oc: OpenCascadeInstance) {}

  // ============================================================================
  // Wire/Face Creation
  // ============================================================================

  makePolygon(points: Vec3[]): ShapeHandle {
    const polygon = new this.oc.BRepBuilderAPI_MakePolygon_1();

    for (const [x, y, z] of points) {
      polygon.Add_1(new this.oc.gp_Pnt_3(x, y, z));
    }
    polygon.Close();

    if (!polygon.IsDone()) {
      throw new Error("Failed to create polygon");
    }

    return this.store.store(polygon.Wire());
  }

  makeWire(edges: ShapeHandle[]): ShapeHandle {
    const wireBuilder = new this.oc.BRepBuilderAPI_MakeWire_1();

    for (const edgeHandle of edges) {
      const edge = this.store.get(edgeHandle);
      wireBuilder.Add_1(edge);
    }

    if (!wireBuilder.IsDone()) {
      throw new Error("Failed to create wire from edges");
    }

    return this.store.store(wireBuilder.Wire());
  }

  makeFace(wire: ShapeHandle): ShapeHandle {
    const wireObj = this.store.get(wire);
    const face = new this.oc.BRepBuilderAPI_MakeFace_15(wireObj, true);

    if (!face.IsDone()) {
      throw new Error("Failed to create face from wire");
    }

    return this.store.store(face.Face());
  }

  makeFaceWithHoles(outerWire: ShapeHandle, innerWires: ShapeHandle[]): ShapeHandle {
    const outerWireObj = this.store.get(outerWire);
    const faceMaker = new this.oc.BRepBuilderAPI_MakeFace_15(outerWireObj, true);

    if (!faceMaker.IsDone()) {
      throw new Error("Failed to create face from outer wire");
    }

    // Add inner wires (holes)
    for (const innerWireHandle of innerWires) {
      const innerWireObj = this.store.get(innerWireHandle);
      faceMaker.Add(innerWireObj);
    }

    return this.store.store(faceMaker.Face());
  }

  makeCircleWire(center: Vec3, normal: Vec3, radius: number): ShapeHandle {
    const centerPnt = new this.oc.gp_Pnt_3(center[0], center[1], center[2]);
    const normalDir = new this.oc.gp_Dir_4(normal[0], normal[1], normal[2]);
    const axis = new this.oc.gp_Ax2_3(centerPnt, normalDir);

    const circle = new this.oc.gp_Circ_2(axis, radius);
    const edge = new this.oc.BRepBuilderAPI_MakeEdge_8(circle);

    if (!edge.IsDone()) {
      throw new Error("Failed to create circle edge");
    }

    const wire = new this.oc.BRepBuilderAPI_MakeWire_2(edge.Edge());

    if (!wire.IsDone()) {
      throw new Error("Failed to create circle wire");
    }

    return this.store.store(wire.Wire());
  }

  makeArcEdge(center: Vec3, start: Vec3, end: Vec3, normal: Vec3): ShapeHandle {
    const centerPnt = new this.oc.gp_Pnt_3(center[0], center[1], center[2]);
    const startPnt = new this.oc.gp_Pnt_3(start[0], start[1], start[2]);
    const endPnt = new this.oc.gp_Pnt_3(end[0], end[1], end[2]);
    const normalDir = new this.oc.gp_Dir_4(normal[0], normal[1], normal[2]);

    // Calculate radius from center to start
    const dx = start[0] - center[0];
    const dy = start[1] - center[1];
    const dz = start[2] - center[2];
    const radius = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const axis = new this.oc.gp_Ax2_3(centerPnt, normalDir);
    const circle = new this.oc.gp_Circ_2(axis, radius);

    // Create arc edge from start to end along the circle
    const edge = new this.oc.BRepBuilderAPI_MakeEdge_9(circle, startPnt, endPnt);

    if (!edge.IsDone()) {
      throw new Error("Failed to create arc edge");
    }

    return this.store.store(edge.Edge());
  }

  makeLineEdge(start: Vec3, end: Vec3): ShapeHandle {
    const startPnt = new this.oc.gp_Pnt_3(start[0], start[1], start[2]);
    const endPnt = new this.oc.gp_Pnt_3(end[0], end[1], end[2]);

    const edge = new this.oc.BRepBuilderAPI_MakeEdge_3(startPnt, endPnt);

    if (!edge.IsDone()) {
      throw new Error("Failed to create line edge");
    }

    return this.store.store(edge.Edge());
  }

  // ============================================================================
  // Primitive Solids
  // ============================================================================

  makeBox(center: Vec3, dimensions: Vec3): ShapeHandle {
    const [width, depth, height] = dimensions;

    // BRepPrimAPI_MakeBox_3(gp_Pnt, gp_Pnt) - two corner points
    const p1 = new this.oc.gp_Pnt_3(0, 0, 0);
    const p2 = new this.oc.gp_Pnt_3(width, depth, height);
    const box = new this.oc.BRepPrimAPI_MakeBox_3(p1, p2);
    let shape = box.Shape();

    // Translate to center (box is created with one corner at origin)
    // So we need to translate by center - half dimensions
    const offsetX = center[0] - width / 2;
    const offsetY = center[1] - depth / 2;
    const offsetZ = center[2] - height / 2;

    if (Math.abs(offsetX) > 1e-9 || Math.abs(offsetY) > 1e-9 || Math.abs(offsetZ) > 1e-9) {
      const vec = new this.oc.gp_Vec_4(offsetX, offsetY, offsetZ);
      const trsf = new this.oc.gp_Trsf_1();
      trsf.SetTranslation_1(vec);

      const transform = new this.oc.BRepBuilderAPI_Transform_2(shape, trsf, true);
      if (transform.IsDone()) {
        shape = transform.Shape();
      }
    }

    return this.store.store(shape);
  }

  makeCylinder(center: Vec3, axis: Vec3, radius: number, height: number): ShapeHandle {
    // BRepPrimAPI_MakeCylinder_1(R, H) - creates cylinder at origin along Z
    const cylinder = new this.oc.BRepPrimAPI_MakeCylinder_1(radius, height);
    let shape = cylinder.Shape();

    // Transform to desired position/orientation
    const cx = center[0], cy = center[1], cz = center[2];
    const ax = axis[0], ay = axis[1], az = axis[2];
    const needsTransform =
      Math.abs(cx) > 1e-9 || Math.abs(cy) > 1e-9 || Math.abs(cz) > 1e-9 ||
      Math.abs(ax) > 1e-9 || Math.abs(ay) > 1e-9 || Math.abs(az - 1) > 1e-9;

    if (needsTransform) {
      const trsf = new this.oc.gp_Trsf_1();

      // Handle rotation if axis is not Z
      const isZAxis = Math.abs(ax) < 1e-6 && Math.abs(ay) < 1e-6 && Math.abs(az - 1) < 1e-6;
      if (!isZAxis) {
        const sourceDir = new this.oc.gp_Dir_4(0, 0, 1);
        const targetDir = new this.oc.gp_Dir_4(ax, ay, az);
        const rotAxis = sourceDir.IsParallel(targetDir, 1e-6)
          ? new this.oc.gp_Ax1_2(new this.oc.gp_Pnt_3(0, 0, 0), new this.oc.gp_Dir_4(1, 0, 0))
          : new this.oc.gp_Ax1_2(new this.oc.gp_Pnt_3(0, 0, 0), sourceDir.Crossed(targetDir));
        const angle = Math.acos(Math.max(-1, Math.min(1, sourceDir.Dot(targetDir))));
        if (Math.abs(angle) > 1e-9) {
          trsf.SetRotation_1(rotAxis, angle);
        }
      }

      // Translate to center
      const vec = new this.oc.gp_Vec_4(cx, cy, cz);
      const transTrsf = new this.oc.gp_Trsf_1();
      transTrsf.SetTranslation_1(vec);
      trsf.Multiply(transTrsf);

      const transform = new this.oc.BRepBuilderAPI_Transform_2(shape, trsf, true);
      if (transform.IsDone()) {
        shape = transform.Shape();
      }
    }

    return this.store.store(shape);
  }

  makeSphere(center: Vec3, radius: number): ShapeHandle {
    // BRepPrimAPI_MakeSphere_1(R) - creates sphere at origin
    const sphere = new this.oc.BRepPrimAPI_MakeSphere_1(radius);
    let shape = sphere.Shape();

    // Translate to center
    const cx = center[0], cy = center[1], cz = center[2];
    if (Math.abs(cx) > 1e-9 || Math.abs(cy) > 1e-9 || Math.abs(cz) > 1e-9) {
      const vec = new this.oc.gp_Vec_4(cx, cy, cz);
      const trsf = new this.oc.gp_Trsf_1();
      trsf.SetTranslation_1(vec);

      const transform = new this.oc.BRepBuilderAPI_Transform_2(shape, trsf, true);
      if (transform.IsDone()) {
        shape = transform.Shape();
      }
    }

    return this.store.store(shape);
  }

  makeCone(center: Vec3, axis: Vec3, radius1: number, radius2: number, height: number): ShapeHandle {
    // BRepPrimAPI_MakeCone_1(R1, R2, H) - creates cone at origin along Z
    const cone = new this.oc.BRepPrimAPI_MakeCone_1(radius1, radius2, height);
    let shape = cone.Shape();

    // Transform to desired position/orientation
    const cx = center[0], cy = center[1], cz = center[2];
    const ax = axis[0], ay = axis[1], az = axis[2];
    const needsTransform =
      Math.abs(cx) > 1e-9 || Math.abs(cy) > 1e-9 || Math.abs(cz) > 1e-9 ||
      Math.abs(ax) > 1e-9 || Math.abs(ay) > 1e-9 || Math.abs(az - 1) > 1e-9;

    if (needsTransform) {
      const trsf = new this.oc.gp_Trsf_1();

      // Handle rotation if axis is not Z
      const isZAxis = Math.abs(ax) < 1e-6 && Math.abs(ay) < 1e-6 && Math.abs(az - 1) < 1e-6;
      if (!isZAxis) {
        const sourceDir = new this.oc.gp_Dir_4(0, 0, 1);
        const targetDir = new this.oc.gp_Dir_4(ax, ay, az);
        const rotAxis = sourceDir.IsParallel(targetDir, 1e-6)
          ? new this.oc.gp_Ax1_2(new this.oc.gp_Pnt_3(0, 0, 0), new this.oc.gp_Dir_4(1, 0, 0))
          : new this.oc.gp_Ax1_2(new this.oc.gp_Pnt_3(0, 0, 0), sourceDir.Crossed(targetDir));
        const angle = Math.acos(Math.max(-1, Math.min(1, sourceDir.Dot(targetDir))));
        if (Math.abs(angle) > 1e-9) {
          trsf.SetRotation_1(rotAxis, angle);
        }
      }

      // Translate to center
      const vec = new this.oc.gp_Vec_4(cx, cy, cz);
      const transTrsf = new this.oc.gp_Trsf_1();
      transTrsf.SetTranslation_1(vec);
      trsf.Multiply(transTrsf);

      const transform = new this.oc.BRepBuilderAPI_Transform_2(shape, trsf, true);
      if (transform.IsDone()) {
        shape = transform.Shape();
      }
    }

    return this.store.store(shape);
  }

  // ============================================================================
  // Transform Operations
  // ============================================================================

  translate(shape: ShapeHandle, vector: Vec3): ShapeHandle {
    const shapeObj = this.store.get(shape);
    const vec = new this.oc.gp_Vec_4(vector[0], vector[1], vector[2]);

    const trsf = new this.oc.gp_Trsf_1();
    trsf.SetTranslation_1(vec);

    const transform = new this.oc.BRepBuilderAPI_Transform_2(shapeObj, trsf, true);

    if (!transform.IsDone()) {
      throw new Error("Failed to translate shape");
    }

    return this.store.store(transform.Shape());
  }

  rotate(shape: ShapeHandle, axisOrigin: Vec3, axisDir: Vec3, angleRad: number): ShapeHandle {
    const shapeObj = this.store.get(shape);

    const origin = new this.oc.gp_Pnt_3(axisOrigin[0], axisOrigin[1], axisOrigin[2]);
    const direction = new this.oc.gp_Dir_4(axisDir[0], axisDir[1], axisDir[2]);
    const axis = new this.oc.gp_Ax1_2(origin, direction);

    const trsf = new this.oc.gp_Trsf_1();
    trsf.SetRotation_1(axis, angleRad);

    const transform = new this.oc.BRepBuilderAPI_Transform_2(shapeObj, trsf, true);

    if (!transform.IsDone()) {
      throw new Error("Failed to rotate shape");
    }

    return this.store.store(transform.Shape());
  }

  scale(shape: ShapeHandle, center: Vec3, factor: number): ShapeHandle {
    const shapeObj = this.store.get(shape);

    const centerPnt = new this.oc.gp_Pnt_3(center[0], center[1], center[2]);

    const trsf = new this.oc.gp_Trsf_1();
    trsf.SetScale(centerPnt, factor);

    const transform = new this.oc.BRepBuilderAPI_Transform_2(shapeObj, trsf, true);

    if (!transform.IsDone()) {
      throw new Error("Failed to scale shape");
    }

    return this.store.store(transform.Shape());
  }

  // ============================================================================
  // Primary Operations
  // ============================================================================

  extrude(face: ShapeHandle, direction: Vec3, depth: number): ShapeHandle {
    const faceObj = this.store.get(face);
    const [dx, dy, dz] = direction;

    // Create direction vector with length = depth
    const vec = new this.oc.gp_Vec_4(dx * depth, dy * depth, dz * depth);

    const prism = new this.oc.BRepPrimAPI_MakePrism_1(
      faceObj,
      vec,
      false, // copy
      true   // canonize
    );

    if (!prism.IsDone()) {
      throw new Error("Extrusion failed");
    }

    return this.store.store(prism.Shape());
  }

  revolve(
    face: ShapeHandle,
    axisOrigin: Vec3,
    axisDir: Vec3,
    angleRad: number
  ): ShapeHandle {
    const faceObj = this.store.get(face);

    const origin = new this.oc.gp_Pnt_3(axisOrigin[0], axisOrigin[1], axisOrigin[2]);
    const direction = new this.oc.gp_Dir_4(axisDir[0], axisDir[1], axisDir[2]);
    const axis = new this.oc.gp_Ax1_2(origin, direction);

    const revolve = new this.oc.BRepPrimAPI_MakeRevol_1(
      faceObj,
      axis,
      angleRad,
      false // copy
    );

    if (!revolve.IsDone()) {
      throw new Error("Revolve failed");
    }

    return this.store.store(revolve.Shape());
  }

  sweep(profile: ShapeHandle, path: ShapeHandle): ShapeHandle {
    const profileObj = this.store.get(profile);
    const pathObj = this.store.get(path);

    const sweep = new this.oc.BRepOffsetAPI_MakePipe_1(pathObj, profileObj);

    if (!sweep.IsDone()) {
      throw new Error("Sweep failed");
    }

    return this.store.store(sweep.Shape());
  }

  loft(profiles: ShapeHandle[]): ShapeHandle {
    const loft = new this.oc.BRepOffsetAPI_ThruSections(true, false);

    for (const profileHandle of profiles) {
      const profile = this.store.get(profileHandle);
      // Check if it's a wire or vertex
      if (profile.ShapeType() === this.oc.TopAbs_ShapeEnum.TopAbs_WIRE) {
        loft.AddWire(this.oc.TopoDS.Wire_1(profile));
      } else if (profile.ShapeType() === this.oc.TopAbs_ShapeEnum.TopAbs_VERTEX) {
        loft.AddVertex(this.oc.TopoDS.Vertex_1(profile));
      }
    }

    loft.Build();

    if (!loft.IsDone()) {
      throw new Error("Loft failed");
    }

    return this.store.store(loft.Shape());
  }

  sweepWithOptions(
    profile: ShapeHandle,
    path: ShapeHandle,
    options?: {
      solid?: boolean;
      transition?: "transformed" | "right" | "round";
    }
  ): ShapeHandle {
    const profileObj = this.store.get(profile);
    const pathObj = this.store.get(path);

    // Default options
    const solid = options?.solid ?? true;
    const transition = options?.transition ?? "transformed";

    // Map transition mode to OCC enum
    let occTransition;
    switch (transition) {
      case "right":
        occTransition = this.oc.BRepBuilderAPI_TransitionMode.BRepBuilderAPI_RightCorner;
        break;
      case "round":
        occTransition = this.oc.BRepBuilderAPI_TransitionMode.BRepBuilderAPI_RoundCorner;
        break;
      case "transformed":
      default:
        occTransition = this.oc.BRepBuilderAPI_TransitionMode.BRepBuilderAPI_Transformed;
        break;
    }

    // Use BRepOffsetAPI_MakePipeShell for more options
    const pipeShell = new this.oc.BRepOffsetAPI_MakePipeShell(pathObj);
    pipeShell.SetTransitionMode(occTransition);
    pipeShell.SetMode_5(false); // Frenet trihedron

    // Add the profile
    if (profileObj.ShapeType() === this.oc.TopAbs_ShapeEnum.TopAbs_WIRE) {
      pipeShell.Add_1(this.oc.TopoDS.Wire_1(profileObj), false, false);
    } else if (profileObj.ShapeType() === this.oc.TopAbs_ShapeEnum.TopAbs_FACE) {
      // Get outer wire of the face
      const outerWire = this.oc.BRepTools.OuterWire(this.oc.TopoDS.Face_1(profileObj));
      pipeShell.Add_1(outerWire, false, false);
    } else {
      throw new Error("Profile must be a wire or face");
    }

    pipeShell.Build();

    if (!pipeShell.IsDone()) {
      throw new Error("Sweep with options failed");
    }

    let result = pipeShell.Shape();

    // If solid is requested and the shape is a shell, try to make it solid
    if (solid && result.ShapeType() === this.oc.TopAbs_ShapeEnum.TopAbs_SHELL) {
      try {
        const solidMaker = new this.oc.BRepBuilderAPI_MakeSolid_2(this.oc.TopoDS.Shell_1(result));
        if (solidMaker.IsDone()) {
          result = solidMaker.Shape();
        }
      } catch {
        // If solid making fails, return the shell
      }
    }

    return this.store.store(result);
  }

  loftWithOptions(
    profiles: ShapeHandle[],
    options?: {
      solid?: boolean;
      ruled?: boolean;
      closed?: boolean;
      guides?: ShapeHandle[];
    }
  ): ShapeHandle {
    // Default options
    const solid = options?.solid ?? true;
    const ruled = options?.ruled ?? false;
    const closed = options?.closed ?? false;

    const loft = new this.oc.BRepOffsetAPI_ThruSections(solid, ruled);

    // Set if the loft should be closed (periodic)
    if (closed) {
      loft.SetSmoothing(true);
    }

    for (const profileHandle of profiles) {
      const profile = this.store.get(profileHandle);
      // Check shape type and add appropriately
      const shapeType = profile.ShapeType();
      if (shapeType === this.oc.TopAbs_ShapeEnum.TopAbs_WIRE) {
        loft.AddWire(this.oc.TopoDS.Wire_1(profile));
      } else if (shapeType === this.oc.TopAbs_ShapeEnum.TopAbs_VERTEX) {
        loft.AddVertex(this.oc.TopoDS.Vertex_1(profile));
      } else if (shapeType === this.oc.TopAbs_ShapeEnum.TopAbs_FACE) {
        // Extract outer wire from face
        const outerWire = this.oc.BRepTools.OuterWire(this.oc.TopoDS.Face_1(profile));
        loft.AddWire(outerWire);
      } else if (shapeType === this.oc.TopAbs_ShapeEnum.TopAbs_EDGE) {
        // Convert edge to wire
        const wireMaker = new this.oc.BRepBuilderAPI_MakeWire_2(this.oc.TopoDS.Edge_1(profile));
        if (wireMaker.IsDone()) {
          loft.AddWire(wireMaker.Wire());
        }
      }
    }

    loft.Build();

    if (!loft.IsDone()) {
      throw new Error("Loft with options failed");
    }

    return this.store.store(loft.Shape());
  }

  // ============================================================================
  // Boolean Operations
  // ============================================================================

  fuse(a: ShapeHandle, b: ShapeHandle): ShapeHandle {
    const shapeA = this.store.get(a);
    const shapeB = this.store.get(b);

    // OpenCascade.js 1.1.1: Use builder pattern - create, set shapes, build
    const fuse = new this.oc.BRepAlgoAPI_Fuse_1();
    fuse.SetArguments(this.makeListOfShape([shapeA]));
    fuse.SetTools(this.makeListOfShape([shapeB]));
    fuse.Build();

    if (!fuse.IsDone()) {
      throw new Error("Boolean union failed");
    }

    return this.store.store(fuse.Shape());
  }

  cut(a: ShapeHandle, b: ShapeHandle): ShapeHandle {
    const shapeA = this.store.get(a);
    const shapeB = this.store.get(b);

    // OpenCascade.js 1.1.1: Use builder pattern
    const cut = new this.oc.BRepAlgoAPI_Cut_1();
    cut.SetArguments(this.makeListOfShape([shapeA]));
    cut.SetTools(this.makeListOfShape([shapeB]));
    cut.Build();

    if (!cut.IsDone()) {
      throw new Error("Boolean subtraction failed");
    }

    return this.store.store(cut.Shape());
  }

  intersect(a: ShapeHandle, b: ShapeHandle): ShapeHandle {
    const shapeA = this.store.get(a);
    const shapeB = this.store.get(b);

    // OpenCascade.js 1.1.1: Use builder pattern
    const common = new this.oc.BRepAlgoAPI_Common_1();
    common.SetArguments(this.makeListOfShape([shapeA]));
    common.SetTools(this.makeListOfShape([shapeB]));
    common.Build();

    if (!common.IsDone()) {
      throw new Error("Boolean intersection failed");
    }

    return this.store.store(common.Shape());
  }

  // Helper to create TopTools_ListOfShape
  private makeListOfShape(shapes: any[]): any {
    const list = new this.oc.TopTools_ListOfShape_1();
    for (const shape of shapes) {
      list.Append_1(shape);
    }
    return list;
  }

  // ============================================================================
  // Modification Operations
  // ============================================================================

  fillet(shape: ShapeHandle, edges: EdgeHandle[], radius: number): ShapeHandle {
    const shapeObj = this.store.get(shape);

    const fillet = new this.oc.BRepFilletAPI_MakeFillet(
      shapeObj,
      this.oc.ChFi3d_FilletShape.ChFi3d_Rational
    );

    for (const edgeHandle of edges) {
      const edge = this.store.get(edgeHandle);
      fillet.Add_2(radius, this.oc.TopoDS.Edge_1(edge));
    }

    const result = fillet.Shape();
    return this.store.store(result);
  }

  chamfer(shape: ShapeHandle, edges: EdgeHandle[], distance: number): ShapeHandle {
    const shapeObj = this.store.get(shape);

    const chamfer = new this.oc.BRepFilletAPI_MakeChamfer(shapeObj);

    for (const edgeHandle of edges) {
      const edge = this.store.get(edgeHandle);
      chamfer.Add_2(distance, this.oc.TopoDS.Edge_1(edge));
    }

    const result = chamfer.Shape();
    return this.store.store(result);
  }

  shell(
    shape: ShapeHandle,
    facesToRemove: FaceHandle[],
    thickness: number
  ): ShapeHandle {
    const shapeObj = this.store.get(shape);

    // Create list of faces to remove
    const faceList = new this.oc.TopTools_ListOfShape_1();
    for (const faceHandle of facesToRemove) {
      const face = this.store.get(faceHandle);
      faceList.Append_1(face);
    }

    const shell = new this.oc.BRepOffsetAPI_MakeThickSolid();
    // OpenCascade.js 1.1.1 - use overload without progress range
    shell.MakeThickSolidByJoin(
      shapeObj,
      faceList,
      thickness,
      1e-6, // tolerance
      this.oc.BRepOffset_Mode.BRepOffset_Skin,
      false, // intersection
      false, // self intersection
      this.oc.GeomAbs_JoinType.GeomAbs_Arc,
      false // remove internal edges
    );

    if (!shell.IsDone()) {
      throw new Error("Shell operation failed");
    }

    return this.store.store(shell.Shape());
  }

  // ============================================================================
  // Topology Queries
  // ============================================================================

  getFaces(shape: ShapeHandle): FaceHandle[] {
    const shapeObj = this.store.get(shape);
    const faces: FaceHandle[] = [];

    const explorer = new this.oc.TopExp_Explorer_2(
      shapeObj,
      this.oc.TopAbs_ShapeEnum.TopAbs_FACE,
      this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );

    while (explorer.More()) {
      const face = this.oc.TopoDS.Face_1(explorer.Current());
      faces.push(this.store.store(face));
      explorer.Next();
    }

    return faces;
  }

  getEdges(shape: ShapeHandle): EdgeHandle[] {
    const shapeObj = this.store.get(shape);
    const edges: EdgeHandle[] = [];

    const explorer = new this.oc.TopExp_Explorer_2(
      shapeObj,
      this.oc.TopAbs_ShapeEnum.TopAbs_EDGE,
      this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );

    while (explorer.More()) {
      const edge = this.oc.TopoDS.Edge_1(explorer.Current());
      edges.push(this.store.store(edge));
      explorer.Next();
    }

    return edges;
  }

  getVertices(shape: ShapeHandle): VertexHandle[] {
    const shapeObj = this.store.get(shape);
    const vertices: VertexHandle[] = [];

    const explorer = new this.oc.TopExp_Explorer_2(
      shapeObj,
      this.oc.TopAbs_ShapeEnum.TopAbs_VERTEX,
      this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );

    while (explorer.More()) {
      const vertex = this.oc.TopoDS.Vertex_1(explorer.Current());
      vertices.push(this.store.store(vertex));
      explorer.Next();
    }

    return vertices;
  }

  // ============================================================================
  // Geometry Queries
  // ============================================================================

  faceCenter(face: FaceHandle): Vec3 {
    const faceObj = this.store.get(face);

    const props = new this.oc.GProp_GProps_1();
    // OCC.js 1.1.1 requires 4 args: shape, props, useTriangulation, skipShared
    this.oc.BRepGProp.SurfaceProperties_1(faceObj, props, false, false);

    const center = props.CentreOfMass();
    return [center.X(), center.Y(), center.Z()];
  }

  faceNormal(face: FaceHandle): Vec3 {
    const faceObj = this.store.get(face);

    // Use BRepAdaptor_Surface which handles the face directly
    const adaptor = new this.oc.BRepAdaptor_Surface_2(faceObj, true);

    // Get UV bounds from the adaptor
    const uMin = adaptor.FirstUParameter();
    const uMax = adaptor.LastUParameter();
    const vMin = adaptor.FirstVParameter();
    const vMax = adaptor.LastVParameter();

    // Evaluate at center of UV
    const uMid = (uMin + uMax) / 2;
    const vMid = (vMin + vMax) / 2;

    const pnt = new this.oc.gp_Pnt_1();
    const d1u = new this.oc.gp_Vec_1();
    const d1v = new this.oc.gp_Vec_1();

    adaptor.D1(uMid, vMid, pnt, d1u, d1v);

    // Normal is cross product of d1u and d1v
    const normal = d1u.Crossed(d1v);
    normal.Normalize();

    // Account for face orientation
    if (faceObj.Orientation_1() === this.oc.TopAbs_Orientation.TopAbs_REVERSED) {
      normal.Reverse();
    }

    return [normal.X(), normal.Y(), normal.Z()];
  }

  faceArea(face: FaceHandle): number {
    const faceObj = this.store.get(face);

    const props = new this.oc.GProp_GProps_1();
    this.oc.BRepGProp.SurfaceProperties_1(faceObj, props, false);

    return props.Mass();
  }

  edgeMidpoint(edge: EdgeHandle): Vec3 {
    const edgeObj = this.store.get(edge);

    const curve = new this.oc.BRepAdaptor_Curve_2(edgeObj);
    const first = curve.FirstParameter();
    const last = curve.LastParameter();
    const mid = (first + last) / 2;

    const point = curve.Value(mid);
    return [point.X(), point.Y(), point.Z()];
  }

  edgeLength(edge: EdgeHandle): number {
    const edgeObj = this.store.get(edge);

    const props = new this.oc.GProp_GProps_1();
    this.oc.BRepGProp.LinearProperties(edgeObj, props, false);

    return props.Mass();
  }

  // ============================================================================
  // Meshing
  // ============================================================================

  mesh(shape: ShapeHandle, deflection: number): MeshData {
    const shapeObj = this.store.get(shape);

    // Tessellate the shape
    new this.oc.BRepMesh_IncrementalMesh_2(
      shapeObj,
      deflection,      // linear deflection
      false,           // relative
      deflection * 2,  // angular deflection
      false            // in parallel
    );

    // Extract mesh data from all faces
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const faceGroups: { start: number; count: number }[] = [];
    let vertexOffset = 0;
    let triangleOffset = 0;

    const faceExplorer = new this.oc.TopExp_Explorer_2(
      shapeObj,
      this.oc.TopAbs_ShapeEnum.TopAbs_FACE,
      this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );

    while (faceExplorer.More()) {
      const face = this.oc.TopoDS.Face_1(faceExplorer.Current());
      const location = new this.oc.TopLoc_Location_1();
      const triangulation = this.oc.BRep_Tool.Triangulation(face, location);

      if (!triangulation.IsNull()) {
        const transformation = location.Transformation();
        const tri = triangulation.get();
        const numNodes = tri.NbNodes();
        const numTriangles = tri.NbTriangles();

        // Track face group - start index in the indices array (multiply by 3 since each triangle has 3 indices)
        const faceGroupStart = triangleOffset;

        // Extract vertices and normals
        for (let i = 1; i <= numNodes; i++) {
          const node = tri.Node(i);
          const transformed = node.Transformed(transformation);
          positions.push(transformed.X(), transformed.Y(), transformed.Z());

          // Get normal if available
          if (tri.HasNormals()) {
            const normal = tri.Normal(i);
            const transformedNormal = normal.IsNull()
              ? new this.oc.gp_Dir_1()
              : normal.Transformed(transformation);
            normals.push(transformedNormal.X(), transformedNormal.Y(), transformedNormal.Z());
          } else {
            normals.push(0, 0, 1); // Default normal, will be recalculated
          }
        }

        // Extract triangle indices
        const isReversed = face.Orientation_1() === this.oc.TopAbs_Orientation.TopAbs_REVERSED;

        for (let i = 1; i <= numTriangles; i++) {
          const triangle = tri.Triangle(i);
          let idx1 = triangle.Value(1) - 1 + vertexOffset;
          let idx2 = triangle.Value(2) - 1 + vertexOffset;
          let idx3 = triangle.Value(3) - 1 + vertexOffset;

          if (isReversed) {
            // Reverse winding for correct normals
            indices.push(idx1, idx3, idx2);
          } else {
            indices.push(idx1, idx2, idx3);
          }
        }

        // Record face group
        faceGroups.push({
          start: faceGroupStart,
          count: numTriangles,
        });

        vertexOffset += numNodes;
        triangleOffset += numTriangles;
      }

      faceExplorer.Next();
    }

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      indices: new Uint32Array(indices),
      faceGroups,
    };
  }

  // ============================================================================
  // Import/Export
  // ============================================================================

  exportSTEP(shapes: ShapeHandle[], asCompound: boolean = true): string | null {
    if (shapes.length === 0) {
      console.warn("[OCC] No shapes to export to STEP");
      return null;
    }

    try {
      // Create STEP writer
      const writer = new this.oc.STEPControl_Writer_1();

      if (asCompound && shapes.length > 1) {
        // Export multiple shapes as a compound
        const compound = new this.oc.TopoDS_Compound();
        const builder = new this.oc.BRep_Builder();
        builder.MakeCompound(compound);

        for (const shapeHandle of shapes) {
          const shape = this.store.get(shapeHandle);
          builder.Add(compound, shape);
        }

        // Transfer compound to STEP (OpenCascade.js 1.1.1 - no progress range)
        writer.Transfer(
          compound,
          this.oc.STEPControl_StepModelType.STEPControl_AsIs,
          true
        );
      } else {
        // Export shapes individually
        for (const shapeHandle of shapes) {
          const shape = this.store.get(shapeHandle);
          writer.Transfer(
            shape,
            this.oc.STEPControl_StepModelType.STEPControl_AsIs,
            true
          );
        }
      }

      // Generate unique filename to avoid conflicts
      const timestamp = Date.now();
      const stepFilename = `export_${timestamp}.step`;

      // Write to Emscripten virtual filesystem
      const status = writer.Write(stepFilename);

      if (status !== this.oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
        console.error("[OCC] STEP write failed with status:", status);
        return null;
      }

      // Read file from virtual filesystem
      const stepContent = this.oc.FS.readFile("/" + stepFilename, {
        encoding: "utf8",
      });

      // Clean up virtual filesystem
      try {
        this.oc.FS.unlink("/" + stepFilename);
      } catch (e) {
        console.warn("[OCC] Failed to clean up virtual STEP file:", e);
      }

      return stepContent;
    } catch (error) {
      console.error("[OCC] STEP export failed:", error);
      return null;
    }
  }

  exportShapeToSTEP(shape: ShapeHandle): string | null {
    return this.exportSTEP([shape], false);
  }

  // ============================================================================
  // 2D Projection (for Drawing Views)
  // ============================================================================

  projectTo2D(
    shape: ShapeHandle,
    viewDir: Vec3,
    upDir: Vec3,
    scale: number = 1.0
  ): ProjectionResult {
    const shapeObj = this.store.get(shape);

    // Create the projector (camera setup)
    // HLRAlgo_Projector defines the view transformation
    const eyeDir = new this.oc.gp_Dir_4(viewDir[0], viewDir[1], viewDir[2]);
    const upVec = new this.oc.gp_Dir_4(upDir[0], upDir[1], upDir[2]);

    // Create coordinate system for projection
    // The view looks along -Z in the projection coordinate system
    const origin = new this.oc.gp_Pnt_3(0, 0, 0);

    // Calculate the right vector (X axis of projection plane)
    const rightVec = upVec.Crossed(eyeDir);

    // Build the projection axes
    const ax2 = new this.oc.gp_Ax2_3(origin, eyeDir, rightVec);

    // Create HLR algorithm
    const hlrAlgo = new this.oc.HLRBRep_Algo_1();
    hlrAlgo.Add_1(shapeObj, 0);

    // Create projector and set it
    const projector = new this.oc.HLRAlgo_Projector_2(ax2);
    hlrAlgo.Projector_1(projector);

    // Perform hidden line removal
    hlrAlgo.Update();
    hlrAlgo.Hide_1();

    // Extract results using HLRBRep_HLRToShape
    const hlrToShape = new this.oc.HLRBRep_HLRToShape(new this.oc.Handle_HLRBRep_Algo_2(hlrAlgo));

    const edges: ProjectedEdge2D[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // Helper to extract edges from a shape and add them to the result
    const extractEdges = (edgeShape: any, type: ProjectedEdgeType) => {
      if (edgeShape.IsNull()) return;

      const explorer = new this.oc.TopExp_Explorer_2(
        edgeShape,
        this.oc.TopAbs_ShapeEnum.TopAbs_EDGE,
        this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE
      );

      while (explorer.More()) {
        const edge = this.oc.TopoDS.Edge_1(explorer.Current());
        const points = this.discretizeEdge2D(edge, scale);

        if (points.length > 0) {
          // Update bounding box
          for (const [x, y] of points) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }

          edges.push({ type, points });
        }

        explorer.Next();
      }
    };

    // Extract visible edges (sharp edges that are visible)
    try {
      extractEdges(hlrToShape.VCompound_1(), "visible");
    } catch (e) {
      console.warn("[OCC] Failed to extract visible edges:", e);
    }

    // Extract hidden edges (sharp edges that are hidden)
    try {
      extractEdges(hlrToShape.HCompound_1(), "hidden");
    } catch (e) {
      console.warn("[OCC] Failed to extract hidden edges:", e);
    }

    // Extract outline edges (silhouette/contour)
    try {
      extractEdges(hlrToShape.OutLineVCompound_1(), "outline");
    } catch (e) {
      console.warn("[OCC] Failed to extract outline edges:", e);
    }

    // Extract silhouette edges
    try {
      extractEdges(hlrToShape.Rg1LineVCompound_1(), "silhouette");
    } catch (e) {
      console.warn("[OCC] Failed to extract silhouette edges:", e);
    }

    // Handle case where no edges were found
    if (edges.length === 0) {
      // Fallback: try to project edges directly without HLR
      console.warn("[OCC] HLR produced no edges, attempting direct projection");
      return this.projectEdgesDirect(shapeObj, viewDir, upDir, scale);
    }

    return {
      edges,
      boundingBox: {
        min: [minX === Infinity ? 0 : minX, minY === Infinity ? 0 : minY],
        max: [maxX === -Infinity ? 0 : maxX, maxY === -Infinity ? 0 : maxY],
      },
    };
  }

  /**
   * Discretize a 2D edge into a polyline.
   * The edge is already in the 2D projection plane.
   */
  private discretizeEdge2D(edge: any, scale: number): [number, number][] {
    const points: [number, number][] = [];

    try {
      const curve = new this.oc.BRepAdaptor_Curve_2(edge);
      const first = curve.FirstParameter();
      const last = curve.LastParameter();

      // Determine number of segments based on edge length
      const numSegments = Math.max(2, Math.min(50, Math.ceil((last - first) * 10)));

      for (let i = 0; i <= numSegments; i++) {
        const t = first + (i / numSegments) * (last - first);
        const pnt = curve.Value(t);
        // In HLR projection, X and Y are in the projection plane
        points.push([pnt.X() * scale, pnt.Y() * scale]);
      }
    } catch (e) {
      console.warn("[OCC] Failed to discretize edge:", e);
    }

    return points;
  }

  /**
   * Fallback: Direct projection of edges without HLR.
   * Used when HLR fails or produces no results.
   */
  private projectEdgesDirect(
    shape: any,
    viewDir: Vec3,
    upDir: Vec3,
    scale: number
  ): ProjectionResult {
    const edges: ProjectedEdge2D[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // Build projection transformation matrix
    const vd = this.normalize(viewDir);
    const up = this.normalize(upDir);
    const right = this.cross(up, vd);
    const correctedUp = this.cross(vd, right);

    // Project all edges
    const explorer = new this.oc.TopExp_Explorer_2(
      shape,
      this.oc.TopAbs_ShapeEnum.TopAbs_EDGE,
      this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );

    while (explorer.More()) {
      const edge = this.oc.TopoDS.Edge_1(explorer.Current());
      const points: [number, number][] = [];

      try {
        const curve = new this.oc.BRepAdaptor_Curve_2(edge);
        const first = curve.FirstParameter();
        const last = curve.LastParameter();
        const numSegments = Math.max(2, Math.min(50, Math.ceil((last - first) * 10)));

        for (let i = 0; i <= numSegments; i++) {
          const t = first + (i / numSegments) * (last - first);
          const pnt3d = curve.Value(t);

          // Project 3D point to 2D using the view transformation
          const px = pnt3d.X(), py = pnt3d.Y(), pz = pnt3d.Z();
          const x2d = (px * right[0] + py * right[1] + pz * right[2]) * scale;
          const y2d = (px * correctedUp[0] + py * correctedUp[1] + pz * correctedUp[2]) * scale;

          points.push([x2d, y2d]);

          minX = Math.min(minX, x2d);
          minY = Math.min(minY, y2d);
          maxX = Math.max(maxX, x2d);
          maxY = Math.max(maxY, y2d);
        }

        if (points.length > 0) {
          edges.push({ type: "visible", points });
        }
      } catch (e) {
        console.warn("[OCC] Failed to project edge:", e);
      }

      explorer.Next();
    }

    return {
      edges,
      boundingBox: {
        min: [minX === Infinity ? 0 : minX, minY === Infinity ? 0 : minY],
        max: [maxX === -Infinity ? 0 : maxX, maxY === -Infinity ? 0 : maxY],
      },
    };
  }

  private normalize(v: Vec3): Vec3 {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 1];
  }

  private cross(a: Vec3, b: Vec3): Vec3 {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }

  /**
   * Create a section view by cutting the shape with a plane.
   * Projects the visible edges and the section cut lines.
   */
  projectSection(
    shape: ShapeHandle,
    planeOrigin: Vec3,
    planeNormal: Vec3,
    viewDir: Vec3,
    upDir: Vec3,
    scale: number = 1.0
  ): ProjectionResult {
    const shapeObj = this.store.get(shape);

    const edges: ProjectedEdge2D[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // Build projection transformation
    const vd = this.normalize(viewDir);
    const up = this.normalize(upDir);
    const right = this.cross(up, vd);
    const correctedUp = this.cross(vd, right);

    try {
      // Create the section plane
      const origin = new this.oc.gp_Pnt_3(planeOrigin[0], planeOrigin[1], planeOrigin[2]);
      const normal = new this.oc.gp_Dir_4(planeNormal[0], planeNormal[1], planeNormal[2]);
      const plane = new this.oc.gp_Pln_3(origin, normal);

      // Create section algorithm
      const section = new this.oc.BRepAlgoAPI_Section_3(shapeObj, plane, false);
      section.Build();

      if (section.IsDone()) {
        const sectionShape = section.Shape();

        // Extract section edges (the cut lines - marked as "section" type)
        const sectionExplorer = new this.oc.TopExp_Explorer_2(
          sectionShape,
          this.oc.TopAbs_ShapeEnum.TopAbs_EDGE,
          this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE
        );

        while (sectionExplorer.More()) {
          const edge = this.oc.TopoDS.Edge_1(sectionExplorer.Current());
          const points: [number, number][] = [];

          try {
            const curve = new this.oc.BRepAdaptor_Curve_2(edge);
            const first = curve.FirstParameter();
            const last = curve.LastParameter();
            const numSegments = Math.max(2, Math.min(50, Math.ceil((last - first) * 10)));

            for (let i = 0; i <= numSegments; i++) {
              const t = first + (i / numSegments) * (last - first);
              const pnt3d = curve.Value(t);

              // Project 3D point to 2D
              const px = pnt3d.X(), py = pnt3d.Y(), pz = pnt3d.Z();
              const x2d = (px * right[0] + py * right[1] + pz * right[2]) * scale;
              const y2d = (px * correctedUp[0] + py * correctedUp[1] + pz * correctedUp[2]) * scale;

              points.push([x2d, y2d]);

              minX = Math.min(minX, x2d);
              minY = Math.min(minY, y2d);
              maxX = Math.max(maxX, x2d);
              maxY = Math.max(maxY, y2d);
            }

            if (points.length > 0) {
              edges.push({ type: "section", points });
            }
          } catch (e) {
            console.warn("[OCC] Failed to project section edge:", e);
          }

          sectionExplorer.Next();
        }
      }

      // Also project the visible edges of the original shape
      // using the same view direction (half-section showing the inside)
      const visibleResult = this.projectTo2D(shape, viewDir, upDir, scale);
      edges.push(...visibleResult.edges);

      // Update bounding box
      if (visibleResult.boundingBox.min[0] < minX) minX = visibleResult.boundingBox.min[0];
      if (visibleResult.boundingBox.min[1] < minY) minY = visibleResult.boundingBox.min[1];
      if (visibleResult.boundingBox.max[0] > maxX) maxX = visibleResult.boundingBox.max[0];
      if (visibleResult.boundingBox.max[1] > maxY) maxY = visibleResult.boundingBox.max[1];

    } catch (err) {
      console.error("[OCC] Section projection failed:", err);
      // Fallback to regular projection
      return this.projectTo2D(shape, viewDir, upDir, scale);
    }

    return {
      edges,
      boundingBox: {
        min: [minX === Infinity ? 0 : minX, minY === Infinity ? 0 : minY],
        max: [maxX === -Infinity ? 0 : maxX, maxY === -Infinity ? 0 : maxY],
      },
    };
  }

  // ============================================================================
  // Memory Management
  // ============================================================================

  freeShape(shape: ShapeHandle): void {
    this.store.free(shape);
  }
}
