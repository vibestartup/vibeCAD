/**
 * GcsApi implementation using PlaneGCS from FreeCAD.
 *
 * PlaneGCS is the constraint solver used by FreeCAD's Sketcher workbench.
 *
 * ## Status: IMPLEMENTED but NOT WIRED UP
 *
 * This code works, but constraint solving is not yet connected to the UI.
 * See `PLAN-SKETCH-CONSTRAINTS.md` for the integration plan.
 */

import type { GcsWrapper } from "@salusoft89/planegcs";
import type {
  GcsApi,
  GroupHandle,
  EntityHandle,
  ConstraintHandle,
  SolveResult,
} from "./api";

interface Group {
  id: GroupHandle;
  points: Map<EntityHandle, { x: number; y: number; pointId: string }>;
  lines: Map<EntityHandle, { p1: EntityHandle; p2: EntityHandle; id: string }>;
  circles: Map<EntityHandle, { center: EntityHandle; radius: number; id: string }>;
  arcs: Map<EntityHandle, { center: EntityHandle; start: EntityHandle; end: EntityHandle; id: string }>;
  constraints: Set<ConstraintHandle>;
  gcs: GcsWrapper;
}

let nextGroupId = 1;
let nextGlobalEntityId = 1;
let nextGlobalConstraintId = 1;

export class GcsApiImpl implements GcsApi {
  private groups: Map<GroupHandle, Group> = new Map();
  private gcsFactory: () => GcsWrapper;

  constructor(gcsFactory: () => GcsWrapper) {
    this.gcsFactory = gcsFactory;
  }

  createGroup(): GroupHandle {
    const id = nextGroupId++;
    const gcs = this.gcsFactory();
    this.groups.set(id, {
      id,
      points: new Map(),
      lines: new Map(),
      circles: new Map(),
      arcs: new Map(),
      constraints: new Set(),
      gcs,
    });
    return id;
  }

  freeGroup(groupId: GroupHandle): void {
    this.groups.delete(groupId);
  }

  private getGroup(groupId: GroupHandle): Group {
    const group = this.groups.get(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);
    return group;
  }

  addPoint2d(groupId: GroupHandle, x: number, y: number): EntityHandle {
    const group = this.getGroup(groupId);
    const entityId = nextGlobalEntityId++;
    const pointId = `pt_${entityId}`;

    group.gcs.push_primitives_and_params([
      {
        type: "point" as const,
        id: pointId,
        x,
        y,
        fixed: false,
      },
    ]);

    group.points.set(entityId, { x, y, pointId });
    return entityId;
  }

  getPoint2d(pointId: EntityHandle): { x: number; y: number } {
    for (const group of Array.from(this.groups.values())) {
      const point = group.points.get(pointId);
      if (point) {
        const primitives = group.gcs.sketch_index.get_primitives();
        const ptData = primitives.find((p: any) => p.id === point.pointId);
        if (ptData && ptData.type === "point") {
          return { x: ptData.x as number, y: ptData.y as number };
        }
        return { x: point.x, y: point.y };
      }
    }
    throw new Error(`Point ${pointId} not found`);
  }

  addLine2d(groupId: GroupHandle, p1: EntityHandle, p2: EntityHandle): EntityHandle {
    const group = this.getGroup(groupId);
    const entityId = nextGlobalEntityId++;
    const id = `line_${entityId}`;

    const pt1 = group.points.get(p1);
    const pt2 = group.points.get(p2);
    if (!pt1 || !pt2) throw new Error("Points not found for line");

    group.gcs.push_primitives_and_params([
      {
        type: "line" as const,
        id,
        p1_id: pt1.pointId,
        p2_id: pt2.pointId,
      },
    ]);

    group.lines.set(entityId, { p1, p2, id });
    return entityId;
  }

  addCircle2d(groupId: GroupHandle, center: EntityHandle, radius: number): EntityHandle {
    const group = this.getGroup(groupId);
    const entityId = nextGlobalEntityId++;
    const id = `circle_${entityId}`;

    const centerPt = group.points.get(center);
    if (!centerPt) throw new Error("Center point not found");

    group.gcs.push_primitives_and_params([
      {
        type: "circle" as const,
        id,
        c_id: centerPt.pointId,
        radius,
      },
    ]);

    group.circles.set(entityId, { center, radius, id });
    return entityId;
  }

  addArc2d(
    groupId: GroupHandle,
    center: EntityHandle,
    start: EntityHandle,
    end: EntityHandle
  ): EntityHandle {
    const group = this.getGroup(groupId);
    const entityId = nextGlobalEntityId++;
    const id = `arc_${entityId}`;

    const centerPt = group.points.get(center);
    const startPt = group.points.get(start);
    const endPt = group.points.get(end);
    if (!centerPt || !startPt || !endPt) throw new Error("Points not found for arc");

    const dx = startPt.x - centerPt.x;
    const dy = startPt.y - centerPt.y;
    const radius = Math.sqrt(dx * dx + dy * dy);

    const startAngle = Math.atan2(startPt.y - centerPt.y, startPt.x - centerPt.x);
    const endAngle = Math.atan2(endPt.y - centerPt.y, endPt.x - centerPt.x);

    group.gcs.push_primitives_and_params([
      {
        type: "arc" as const,
        id,
        c_id: centerPt.pointId,
        start_id: startPt.pointId,
        end_id: endPt.pointId,
        radius,
        start_angle: startAngle,
        end_angle: endAngle,
      },
    ]);

    group.arcs.set(entityId, { center, start, end, id });
    return entityId;
  }

  addCoincident(groupId: GroupHandle, p1: EntityHandle, p2: EntityHandle): ConstraintHandle {
    const group = this.getGroup(groupId);
    const constraintId = nextGlobalConstraintId++;

    const pt1 = group.points.get(p1);
    const pt2 = group.points.get(p2);
    if (!pt1 || !pt2) throw new Error("Points not found");

    group.gcs.push_primitives_and_params([
      {
        type: "p2p_coincident" as const,
        id: `c_${constraintId}`,
        p1_id: pt1.pointId,
        p2_id: pt2.pointId,
      },
    ]);

    group.constraints.add(constraintId);
    return constraintId;
  }

  addHorizontal(groupId: GroupHandle, line: EntityHandle): ConstraintHandle {
    const group = this.getGroup(groupId);
    const constraintId = nextGlobalConstraintId++;
    const lineData = group.lines.get(line);
    if (!lineData) throw new Error(`Line ${line} not found`);

    group.gcs.push_primitives_and_params([
      {
        type: "horizontal_l" as const,
        id: `c_${constraintId}`,
        l_id: lineData.id,
      },
    ]);

    group.constraints.add(constraintId);
    return constraintId;
  }

  addVertical(groupId: GroupHandle, line: EntityHandle): ConstraintHandle {
    const group = this.getGroup(groupId);
    const constraintId = nextGlobalConstraintId++;
    const lineData = group.lines.get(line);
    if (!lineData) throw new Error(`Line ${line} not found`);

    group.gcs.push_primitives_and_params([
      {
        type: "vertical_l" as const,
        id: `c_${constraintId}`,
        l_id: lineData.id,
      },
    ]);

    group.constraints.add(constraintId);
    return constraintId;
  }

  addParallel(groupId: GroupHandle, l1: EntityHandle, l2: EntityHandle): ConstraintHandle {
    const group = this.getGroup(groupId);
    const constraintId = nextGlobalConstraintId++;
    const line1 = group.lines.get(l1);
    const line2 = group.lines.get(l2);
    if (!line1 || !line2) throw new Error("Lines not found");

    group.gcs.push_primitives_and_params([
      {
        type: "parallel" as const,
        id: `c_${constraintId}`,
        l1_id: line1.id,
        l2_id: line2.id,
      },
    ]);

    group.constraints.add(constraintId);
    return constraintId;
  }

  addPerpendicular(groupId: GroupHandle, l1: EntityHandle, l2: EntityHandle): ConstraintHandle {
    const group = this.getGroup(groupId);
    const constraintId = nextGlobalConstraintId++;
    const line1 = group.lines.get(l1);
    const line2 = group.lines.get(l2);
    if (!line1 || !line2) throw new Error("Lines not found");

    group.gcs.push_primitives_and_params([
      {
        type: "perpendicular_ll" as const,
        id: `c_${constraintId}`,
        l1_id: line1.id,
        l2_id: line2.id,
      },
    ]);

    group.constraints.add(constraintId);
    return constraintId;
  }

  addTangent(groupId: GroupHandle, e1: EntityHandle, e2: EntityHandle): ConstraintHandle {
    const group = this.getGroup(groupId);
    const constraintId = nextGlobalConstraintId++;

    const circle1 = group.circles.get(e1);
    const circle2 = group.circles.get(e2);
    const line1 = group.lines.get(e1);
    const line2 = group.lines.get(e2);

    if (circle1 && line2) {
      group.gcs.push_primitives_and_params([
        { type: "tangent_lc" as const, id: `c_${constraintId}`, l_id: line2.id, c_id: circle1.id },
      ]);
    } else if (line1 && circle2) {
      group.gcs.push_primitives_and_params([
        { type: "tangent_lc" as const, id: `c_${constraintId}`, l_id: line1.id, c_id: circle2.id },
      ]);
    } else if (circle1 && circle2) {
      group.gcs.push_primitives_and_params([
        { type: "tangent_cc" as const, id: `c_${constraintId}`, c1_id: circle1.id, c2_id: circle2.id },
      ]);
    }

    group.constraints.add(constraintId);
    return constraintId;
  }

  addEqual(groupId: GroupHandle, e1: EntityHandle, e2: EntityHandle): ConstraintHandle {
    const group = this.getGroup(groupId);
    const constraintId = nextGlobalConstraintId++;

    const line1 = group.lines.get(e1);
    const line2 = group.lines.get(e2);
    const circle1 = group.circles.get(e1);
    const circle2 = group.circles.get(e2);

    if (line1 && line2) {
      group.gcs.push_primitives_and_params([
        { type: "equal_length" as const, id: `c_${constraintId}`, l1_id: line1.id, l2_id: line2.id },
      ]);
    } else if (circle1 && circle2) {
      group.gcs.push_primitives_and_params([
        { type: "equal_radius_cc" as const, id: `c_${constraintId}`, c1_id: circle1.id, c2_id: circle2.id },
      ]);
    }

    group.constraints.add(constraintId);
    return constraintId;
  }

  addPointOnLine(groupId: GroupHandle, pt: EntityHandle, line: EntityHandle): ConstraintHandle {
    const group = this.getGroup(groupId);
    const constraintId = nextGlobalConstraintId++;
    const lineData = group.lines.get(line);
    const pointData = group.points.get(pt);
    if (!lineData || !pointData) throw new Error("Line or point not found");

    group.gcs.push_primitives_and_params([
      { type: "p2l_distance" as const, id: `c_${constraintId}`, p_id: pointData.pointId, l_id: lineData.id, distance: 0 },
    ]);

    group.constraints.add(constraintId);
    return constraintId;
  }

  addMidpoint(groupId: GroupHandle, pt: EntityHandle, line: EntityHandle): ConstraintHandle {
    const group = this.getGroup(groupId);
    const constraintId = nextGlobalConstraintId++;
    const lineData = group.lines.get(line);
    const pointData = group.points.get(pt);
    if (!lineData || !pointData) throw new Error("Line or point not found");

    const p1 = group.points.get(lineData.p1);
    const p2 = group.points.get(lineData.p2);
    if (!p1 || !p2) throw new Error("Line endpoints not found");

    group.gcs.push_primitives_and_params([
      { type: "p2p_symmetric_ppp" as const, id: `c_${constraintId}`, p1_id: p1.pointId, p2_id: p2.pointId, p_id: pointData.pointId },
    ]);

    group.constraints.add(constraintId);
    return constraintId;
  }

  addDistance(groupId: GroupHandle, p1: EntityHandle, p2: EntityHandle, distance: number): ConstraintHandle {
    const group = this.getGroup(groupId);
    const constraintId = nextGlobalConstraintId++;

    const pt1 = group.points.get(p1);
    const pt2 = group.points.get(p2);
    if (!pt1 || !pt2) throw new Error("Points not found");

    group.gcs.push_primitives_and_params([
      { type: "p2p_distance" as const, id: `c_${constraintId}`, p1_id: pt1.pointId, p2_id: pt2.pointId, distance },
    ]);

    group.constraints.add(constraintId);
    return constraintId;
  }

  addAngle(groupId: GroupHandle, l1: EntityHandle, l2: EntityHandle, angleRad: number): ConstraintHandle {
    const group = this.getGroup(groupId);
    const constraintId = nextGlobalConstraintId++;
    const line1 = group.lines.get(l1);
    const line2 = group.lines.get(l2);
    if (!line1 || !line2) throw new Error("Lines not found");

    group.gcs.push_primitives_and_params([
      { type: "l2l_angle_ll" as const, id: `c_${constraintId}`, l1_id: line1.id, l2_id: line2.id, angle: angleRad * (180 / Math.PI) },
    ]);

    group.constraints.add(constraintId);
    return constraintId;
  }

  addRadius(groupId: GroupHandle, circle: EntityHandle, radius: number): ConstraintHandle {
    const group = this.getGroup(groupId);
    const constraintId = nextGlobalConstraintId++;
    const circleData = group.circles.get(circle);
    if (!circleData) throw new Error(`Circle ${circle} not found`);

    group.gcs.push_primitives_and_params([
      { type: "circle_radius" as const, id: `c_${constraintId}`, c_id: circleData.id, radius },
    ]);

    group.constraints.add(constraintId);
    return constraintId;
  }

  addHorizontalDistance(groupId: GroupHandle, p1: EntityHandle, p2: EntityHandle, distance: number): ConstraintHandle {
    const group = this.getGroup(groupId);
    const constraintId = nextGlobalConstraintId++;

    const pt1 = group.points.get(p1);
    const pt2 = group.points.get(p2);
    if (!pt1 || !pt2) throw new Error("Points not found");

    group.gcs.push_primitives_and_params([
      { type: "difference" as const, id: `c_${constraintId}`, param1: { o_id: pt2.pointId, prop: "x" as const }, param2: { o_id: pt1.pointId, prop: "x" as const }, difference: distance },
    ]);

    group.constraints.add(constraintId);
    return constraintId;
  }

  addVerticalDistance(groupId: GroupHandle, p1: EntityHandle, p2: EntityHandle, distance: number): ConstraintHandle {
    const group = this.getGroup(groupId);
    const constraintId = nextGlobalConstraintId++;

    const pt1 = group.points.get(p1);
    const pt2 = group.points.get(p2);
    if (!pt1 || !pt2) throw new Error("Points not found");

    group.gcs.push_primitives_and_params([
      { type: "difference" as const, id: `c_${constraintId}`, param1: { o_id: pt2.pointId, prop: "y" as const }, param2: { o_id: pt1.pointId, prop: "y" as const }, difference: distance },
    ]);

    group.constraints.add(constraintId);
    return constraintId;
  }

  solve(groupId: GroupHandle): SolveResult {
    const group = this.getGroup(groupId);

    try {
      const result = group.gcs.solve();
      group.gcs.apply_solution();

      const primitives = group.gcs.sketch_index.get_primitives();
      for (const [, point] of Array.from(group.points)) {
        const ptData = primitives.find((p: any) => p.id === point.pointId);
        if (ptData && ptData.type === "point") {
          point.x = ptData.x as number;
          point.y = ptData.y as number;
        }
      }

      const dof = result === 0 ? 0 : -1;

      return {
        ok: result === 0,
        dof,
        status: result === 0 ? "ok" : "inconsistent",
      };
    } catch (error) {
      console.error("[GCS] Solve error:", error);
      return { ok: false, dof: -1, status: "inconsistent" };
    }
  }
}
