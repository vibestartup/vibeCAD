/**
 * SolveSpace constraint solver API interface.
 */

export type GroupHandle = number;
export type EntityHandle = number;
export type ConstraintHandle = number;

export interface SolveResult {
  ok: boolean;
  dof: number;
  status: "ok" | "over" | "under" | "inconsistent";
}

export interface SlvsApi {
  // ============================================================================
  // Group Management
  // ============================================================================

  /** Create a new constraint group */
  createGroup(): GroupHandle;

  /** Free a constraint group */
  freeGroup(groupId: GroupHandle): void;

  // ============================================================================
  // Points
  // ============================================================================

  /** Add a 2D point */
  addPoint2d(groupId: GroupHandle, x: number, y: number): EntityHandle;

  /** Get the solved position of a 2D point */
  getPoint2d(pointId: EntityHandle): { x: number; y: number };

  // ============================================================================
  // Lines and Curves
  // ============================================================================

  /** Add a line segment */
  addLine2d(groupId: GroupHandle, p1: EntityHandle, p2: EntityHandle): EntityHandle;

  /** Add a circle */
  addCircle2d(
    groupId: GroupHandle,
    center: EntityHandle,
    radius: number
  ): EntityHandle;

  /** Add an arc */
  addArc2d(
    groupId: GroupHandle,
    center: EntityHandle,
    start: EntityHandle,
    end: EntityHandle
  ): EntityHandle;

  // ============================================================================
  // Geometric Constraints
  // ============================================================================

  /** Points are coincident */
  addCoincident(
    groupId: GroupHandle,
    p1: EntityHandle,
    p2: EntityHandle
  ): ConstraintHandle;

  /** Line is horizontal */
  addHorizontal(groupId: GroupHandle, line: EntityHandle): ConstraintHandle;

  /** Line is vertical */
  addVertical(groupId: GroupHandle, line: EntityHandle): ConstraintHandle;

  /** Lines are parallel */
  addParallel(
    groupId: GroupHandle,
    l1: EntityHandle,
    l2: EntityHandle
  ): ConstraintHandle;

  /** Lines are perpendicular */
  addPerpendicular(
    groupId: GroupHandle,
    l1: EntityHandle,
    l2: EntityHandle
  ): ConstraintHandle;

  /** Line/arc is tangent to arc/circle */
  addTangent(
    groupId: GroupHandle,
    e1: EntityHandle,
    e2: EntityHandle
  ): ConstraintHandle;

  /** Two entities have equal length/radius */
  addEqual(
    groupId: GroupHandle,
    e1: EntityHandle,
    e2: EntityHandle
  ): ConstraintHandle;

  /** Point is on line/curve */
  addPointOnLine(
    groupId: GroupHandle,
    pt: EntityHandle,
    line: EntityHandle
  ): ConstraintHandle;

  /** Point is at midpoint of line */
  addMidpoint(
    groupId: GroupHandle,
    pt: EntityHandle,
    line: EntityHandle
  ): ConstraintHandle;

  // ============================================================================
  // Dimensional Constraints
  // ============================================================================

  /** Distance between two points */
  addDistance(
    groupId: GroupHandle,
    p1: EntityHandle,
    p2: EntityHandle,
    distance: number
  ): ConstraintHandle;

  /** Angle between two lines */
  addAngle(
    groupId: GroupHandle,
    l1: EntityHandle,
    l2: EntityHandle,
    angleRad: number
  ): ConstraintHandle;

  /** Radius of circle or arc */
  addRadius(
    groupId: GroupHandle,
    circle: EntityHandle,
    radius: number
  ): ConstraintHandle;

  /** Horizontal distance between two points */
  addHorizontalDistance(
    groupId: GroupHandle,
    p1: EntityHandle,
    p2: EntityHandle,
    distance: number
  ): ConstraintHandle;

  /** Vertical distance between two points */
  addVerticalDistance(
    groupId: GroupHandle,
    p1: EntityHandle,
    p2: EntityHandle,
    distance: number
  ): ConstraintHandle;

  // ============================================================================
  // Solving
  // ============================================================================

  /** Solve all constraints in a group */
  solve(groupId: GroupHandle): SolveResult;
}
