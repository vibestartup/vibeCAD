/**
 * Schematic nets, wires, and connectivity.
 */

import {
  NetId,
  WireId,
  NetLabelId,
  NetClassId,
  PortId,
  SymbolInstanceId,
  PinId,
  JunctionId,
  newId,
} from "../id";
import { SchematicPoint } from "./primitives";

// ============================================================================
// Wire
// ============================================================================

/**
 * A wire is a series of connected orthogonal segments.
 */
export interface Wire {
  id: WireId;
  points: SchematicPoint[]; // Orthogonal segments
  netId: NetId;
}

// ============================================================================
// Junction
// ============================================================================

/**
 * A junction marks where wires connect (more than 2 wires at a point).
 */
export interface Junction {
  id: JunctionId;
  position: SchematicPoint;
  netId: NetId;
}

// ============================================================================
// Net Label
// ============================================================================

export type NetLabelStyle = "local" | "global" | "hierarchical";

/**
 * A net label names a net at a specific point.
 */
export interface NetLabel {
  id: NetLabelId;
  position: SchematicPoint;
  netName: string;
  style: NetLabelStyle;
  rotation: 0 | 90 | 180 | 270;
}

// ============================================================================
// Port (Hierarchical)
// ============================================================================

export type PortDirection = "input" | "output" | "bidirectional";

/**
 * A port connects nets across schematic files (for hierarchical designs).
 */
export interface Port {
  id: PortId;
  name: string;
  direction: PortDirection;
  position: SchematicPoint;
  rotation: 0 | 90 | 180 | 270;
  netId: NetId;
}

// ============================================================================
// Net Class
// ============================================================================

/**
 * Net class defines routing rules for a group of nets.
 */
export interface NetClass {
  id: NetClassId;
  name: string;

  // Default routing rules (passed to PCB)
  traceWidth: number; // mm
  clearance: number; // mm
  viaSize: number; // mm
  viaDrill: number; // mm

  // Advanced rules
  maxLength?: number; // mm, for length matching
  diffPair?: boolean;
  diffPairGap?: number; // mm
}

// ============================================================================
// Pin Connection
// ============================================================================

export interface PinConnection {
  instanceId: SymbolInstanceId;
  pinId: PinId;
}

// ============================================================================
// Net
// ============================================================================

/**
 * A net represents all electrically connected points.
 */
export interface Net {
  id: NetId;
  name: string;
  classId?: NetClassId;

  // Connected elements
  wires: WireId[];
  pinConnections: PinConnection[];
  labels: NetLabelId[];
  ports: PortId[];
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new wire.
 */
export function createWire(
  points: SchematicPoint[],
  netId: NetId
): Wire {
  return {
    id: newId("Wire"),
    points,
    netId,
  };
}

/**
 * Create a new junction.
 */
export function createJunction(
  position: SchematicPoint,
  netId: NetId
): Junction {
  return {
    id: newId("Junction"),
    position,
    netId,
  };
}

/**
 * Create a new net label.
 */
export function createNetLabel(
  position: SchematicPoint,
  netName: string,
  style: NetLabelStyle
): NetLabel {
  return {
    id: newId("NetLabel"),
    position,
    netName,
    style,
    rotation: 0,
  };
}

/**
 * Create a new port.
 */
export function createPort(
  name: string,
  direction: PortDirection,
  position: SchematicPoint,
  netId: NetId
): Port {
  return {
    id: newId("Port"),
    name,
    direction,
    position,
    rotation: 0,
    netId,
  };
}

/**
 * Create a new net class with default values.
 */
export function createNetClass(name: string): NetClass {
  return {
    id: newId("NetClass"),
    name,
    traceWidth: 0.25, // 0.25mm default
    clearance: 0.2, // 0.2mm default
    viaSize: 0.8, // 0.8mm default
    viaDrill: 0.4, // 0.4mm default
  };
}

/**
 * Create a new empty net.
 */
export function createNet(name: string): Net {
  return {
    id: newId("Net"),
    name,
    wires: [],
    pinConnections: [],
    labels: [],
    ports: [],
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if a point is on a wire segment.
 */
export function isPointOnWire(
  point: SchematicPoint,
  wire: Wire,
  tolerance: number = 5
): boolean {
  for (let i = 0; i < wire.points.length - 1; i++) {
    const p1 = wire.points[i];
    const p2 = wire.points[i + 1];

    // Check if point is on segment
    if (isPointOnSegment(point, p1, p2, tolerance)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a point is on a line segment.
 */
function isPointOnSegment(
  point: SchematicPoint,
  p1: SchematicPoint,
  p2: SchematicPoint,
  tolerance: number
): boolean {
  // Check bounding box first
  const minX = Math.min(p1.x, p2.x) - tolerance;
  const maxX = Math.max(p1.x, p2.x) + tolerance;
  const minY = Math.min(p1.y, p2.y) - tolerance;
  const maxY = Math.max(p1.y, p2.y) + tolerance;

  if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
    return false;
  }

  // Calculate distance from point to line
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    // Degenerate segment
    const dist = Math.sqrt((point.x - p1.x) ** 2 + (point.y - p1.y) ** 2);
    return dist <= tolerance;
  }

  // Perpendicular distance
  const dist = Math.abs(dy * point.x - dx * point.y + p2.x * p1.y - p2.y * p1.x) / length;
  return dist <= tolerance;
}

/**
 * Find all wires connected at a point.
 */
export function findWiresAtPoint(
  point: SchematicPoint,
  wires: Map<WireId, Wire>,
  tolerance: number = 5
): WireId[] {
  const result: WireId[] = [];

  for (const [id, wire] of wires) {
    // Check endpoints
    const first = wire.points[0];
    const last = wire.points[wire.points.length - 1];

    const distFirst = Math.sqrt((point.x - first.x) ** 2 + (point.y - first.y) ** 2);
    const distLast = Math.sqrt((point.x - last.x) ** 2 + (point.y - last.y) ** 2);

    if (distFirst <= tolerance || distLast <= tolerance) {
      result.push(id);
    }
  }

  return result;
}

/**
 * Merge two nets (when they become connected).
 */
export function mergeNets(target: Net, source: Net): Net {
  return {
    ...target,
    wires: [...target.wires, ...source.wires],
    pinConnections: [...target.pinConnections, ...source.pinConnections],
    labels: [...target.labels, ...source.labels],
    ports: [...target.ports, ...source.ports],
  };
}
