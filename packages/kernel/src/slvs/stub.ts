/**
 * Stub implementation of SolveSpace API for development/testing.
 * Returns placeholder data that allows the system to run without real WASM.
 */

import type { SlvsApi, SolveResult, GroupHandle, EntityHandle, ConstraintHandle } from "./api";

interface Point2d {
  x: number;
  y: number;
}

interface Group {
  points: Map<EntityHandle, Point2d>;
  lines: Map<EntityHandle, { p1: EntityHandle; p2: EntityHandle }>;
  circles: Map<EntityHandle, { center: EntityHandle; radius: number }>;
  constraints: Map<ConstraintHandle, unknown>;
}

let handleCounter = 0;

function nextHandle(): number {
  return ++handleCounter;
}

export function createSlvsStub(): SlvsApi {
  const groups = new Map<GroupHandle, Group>();

  function getGroup(groupId: GroupHandle): Group {
    let group = groups.get(groupId);
    if (!group) {
      group = {
        points: new Map(),
        lines: new Map(),
        circles: new Map(),
        constraints: new Map(),
      };
      groups.set(groupId, group);
    }
    return group;
  }

  return {
    // Group management
    createGroup(): GroupHandle {
      const handle = nextHandle();
      groups.set(handle, {
        points: new Map(),
        lines: new Map(),
        circles: new Map(),
        constraints: new Map(),
      });
      return handle;
    },

    freeGroup(groupId: GroupHandle): void {
      groups.delete(groupId);
    },

    // Points
    addPoint2d(groupId: GroupHandle, x: number, y: number): EntityHandle {
      const group = getGroup(groupId);
      const handle = nextHandle();
      group.points.set(handle, { x, y });
      return handle;
    },

    getPoint2d(pointId: EntityHandle): { x: number; y: number } {
      // Search all groups for the point
      for (const group of groups.values()) {
        const point = group.points.get(pointId);
        if (point) {
          return { ...point };
        }
      }
      return { x: 0, y: 0 };
    },

    // Lines and curves
    addLine2d(groupId: GroupHandle, p1: EntityHandle, p2: EntityHandle): EntityHandle {
      const group = getGroup(groupId);
      const handle = nextHandle();
      group.lines.set(handle, { p1, p2 });
      return handle;
    },

    addCircle2d(groupId: GroupHandle, center: EntityHandle, radius: number): EntityHandle {
      const group = getGroup(groupId);
      const handle = nextHandle();
      group.circles.set(handle, { center, radius });
      return handle;
    },

    addArc2d(
      groupId: GroupHandle,
      center: EntityHandle,
      _start: EntityHandle,
      _end: EntityHandle
    ): EntityHandle {
      const group = getGroup(groupId);
      const handle = nextHandle();
      group.circles.set(handle, { center, radius: 1 }); // Stub: treat as circle
      return handle;
    },

    // Geometric constraints (all return stub handles)
    addCoincident(groupId: GroupHandle, _p1: EntityHandle, _p2: EntityHandle): ConstraintHandle {
      const handle = nextHandle();
      getGroup(groupId).constraints.set(handle, { type: "coincident" });
      return handle;
    },

    addHorizontal(groupId: GroupHandle, _line: EntityHandle): ConstraintHandle {
      const handle = nextHandle();
      getGroup(groupId).constraints.set(handle, { type: "horizontal" });
      return handle;
    },

    addVertical(groupId: GroupHandle, _line: EntityHandle): ConstraintHandle {
      const handle = nextHandle();
      getGroup(groupId).constraints.set(handle, { type: "vertical" });
      return handle;
    },

    addParallel(groupId: GroupHandle, _l1: EntityHandle, _l2: EntityHandle): ConstraintHandle {
      const handle = nextHandle();
      getGroup(groupId).constraints.set(handle, { type: "parallel" });
      return handle;
    },

    addPerpendicular(groupId: GroupHandle, _l1: EntityHandle, _l2: EntityHandle): ConstraintHandle {
      const handle = nextHandle();
      getGroup(groupId).constraints.set(handle, { type: "perpendicular" });
      return handle;
    },

    addTangent(groupId: GroupHandle, _e1: EntityHandle, _e2: EntityHandle): ConstraintHandle {
      const handle = nextHandle();
      getGroup(groupId).constraints.set(handle, { type: "tangent" });
      return handle;
    },

    addEqual(groupId: GroupHandle, _e1: EntityHandle, _e2: EntityHandle): ConstraintHandle {
      const handle = nextHandle();
      getGroup(groupId).constraints.set(handle, { type: "equal" });
      return handle;
    },

    addPointOnLine(groupId: GroupHandle, _pt: EntityHandle, _line: EntityHandle): ConstraintHandle {
      const handle = nextHandle();
      getGroup(groupId).constraints.set(handle, { type: "pointOnLine" });
      return handle;
    },

    addMidpoint(groupId: GroupHandle, _pt: EntityHandle, _line: EntityHandle): ConstraintHandle {
      const handle = nextHandle();
      getGroup(groupId).constraints.set(handle, { type: "midpoint" });
      return handle;
    },

    // Dimensional constraints
    addDistance(
      groupId: GroupHandle,
      _p1: EntityHandle,
      _p2: EntityHandle,
      _distance: number
    ): ConstraintHandle {
      const handle = nextHandle();
      getGroup(groupId).constraints.set(handle, { type: "distance" });
      return handle;
    },

    addAngle(
      groupId: GroupHandle,
      _l1: EntityHandle,
      _l2: EntityHandle,
      _angleRad: number
    ): ConstraintHandle {
      const handle = nextHandle();
      getGroup(groupId).constraints.set(handle, { type: "angle" });
      return handle;
    },

    addRadius(groupId: GroupHandle, _circle: EntityHandle, _radius: number): ConstraintHandle {
      const handle = nextHandle();
      getGroup(groupId).constraints.set(handle, { type: "radius" });
      return handle;
    },

    addHorizontalDistance(
      groupId: GroupHandle,
      _p1: EntityHandle,
      _p2: EntityHandle,
      _distance: number
    ): ConstraintHandle {
      const handle = nextHandle();
      getGroup(groupId).constraints.set(handle, { type: "horizontalDistance" });
      return handle;
    },

    addVerticalDistance(
      groupId: GroupHandle,
      _p1: EntityHandle,
      _p2: EntityHandle,
      _distance: number
    ): ConstraintHandle {
      const handle = nextHandle();
      getGroup(groupId).constraints.set(handle, { type: "verticalDistance" });
      return handle;
    },

    // Solving - stub always returns success with original positions
    solve(_groupId: GroupHandle): SolveResult {
      return {
        ok: true,
        dof: 0,
        status: "ok",
      };
    },
  };
}
