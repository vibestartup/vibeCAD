/**
 * Sketch module - operations on 2D sketches.
 */

// Primitive operations
export {
  addPrimitive,
  addPoint,
  addLine,
  addCircle,
  addArc,
  addRectangle,
  removePrimitive,
  updatePrimitive,
  movePoint,
  toggleConstruction,
} from "./primitives";

// Constraint operations
export {
  addConstraint,
  addCoincident,
  addHorizontal,
  addVertical,
  addParallel,
  addPerpendicular,
  addEqual,
  addFixed,
  addDistance,
  addAngle,
  addRadius,
  removeConstraint,
  clearConstraints,
  setConstraintDimension,
  setConstraintEntities,
} from "./constraints";

// Loop finding
export { findClosedLoops, getLoopPoints, isPointInLoop } from "./loops";

// Coordinate transforms
export {
  sketchToWorld,
  worldToSketch,
  sketchDirToWorld,
  worldDirToSketch,
  getExtrudeDirection,
  getReverseExtrudeDirection,
  projectOntoPlane,
  distanceToPlane,
  isOnPlane,
  sketchPointsToWorld,
  worldPointsToSketch,
} from "./transform";

// Constraint solver
export { solveSketch, applysolvedPositions, type SketchSolveResult } from "./solver";
