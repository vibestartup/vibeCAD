/**
 * PCB Traces, Vias, and Routing.
 */

import { TraceId, ViaId, LayerId, NetId, newId } from "../id";
import { Vec2 } from "../math";

// ============================================================================
// Trace Segment
// ============================================================================

export interface TraceSegment {
  start: Vec2;
  end: Vec2;
  width: number;
}

export interface TraceArc {
  center: Vec2;
  radius: number;
  startAngle: number; // Degrees
  endAngle: number; // Degrees
  width: number;
}

// ============================================================================
// Trace
// ============================================================================

export interface Trace {
  id: TraceId;
  netId: NetId;
  layerId: LayerId;

  // Straight segments
  segments: TraceSegment[];

  // Arc segments (optional, for curved traces)
  arcs?: TraceArc[];

  // Locked against auto-routing modifications
  locked: boolean;
}

// ============================================================================
// Via
// ============================================================================

export type ViaType = "through" | "blind" | "buried" | "microvia";

export interface Via {
  id: ViaId;
  position: Vec2;
  netId: NetId;

  // Size
  diameter: number;
  drillDiameter: number;

  // Layer span
  startLayer: LayerId;
  endLayer: LayerId;

  // Type
  type: ViaType;

  // Additional properties
  locked: boolean;
  free?: boolean; // Free via (not connected to trace endpoints)
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a trace with a single segment.
 */
export function createTrace(
  start: Vec2,
  end: Vec2,
  width: number,
  layerId: LayerId,
  netId: NetId
): Trace {
  return {
    id: newId("Trace"),
    netId,
    layerId,
    segments: [{ start, end, width }],
    locked: false,
  };
}

/**
 * Create a trace from multiple points.
 */
export function createTraceFromPoints(
  points: Vec2[],
  width: number,
  layerId: LayerId,
  netId: NetId
): Trace {
  const segments: TraceSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push({
      start: points[i],
      end: points[i + 1],
      width,
    });
  }

  return {
    id: newId("Trace"),
    netId,
    layerId,
    segments,
    locked: false,
  };
}

/**
 * Create a through-hole via.
 */
export function createThroughVia(
  position: Vec2,
  netId: NetId,
  diameter: number,
  drillDiameter: number,
  topLayer: LayerId,
  bottomLayer: LayerId
): Via {
  return {
    id: newId("Via"),
    position,
    netId,
    diameter,
    drillDiameter,
    startLayer: topLayer,
    endLayer: bottomLayer,
    type: "through",
    locked: false,
  };
}

/**
 * Create a blind via (connects outer to inner layer).
 */
export function createBlindVia(
  position: Vec2,
  netId: NetId,
  diameter: number,
  drillDiameter: number,
  outerLayer: LayerId,
  innerLayer: LayerId
): Via {
  return {
    id: newId("Via"),
    position,
    netId,
    diameter,
    drillDiameter,
    startLayer: outerLayer,
    endLayer: innerLayer,
    type: "blind",
    locked: false,
  };
}

/**
 * Create a buried via (connects two inner layers).
 */
export function createBuriedVia(
  position: Vec2,
  netId: NetId,
  diameter: number,
  drillDiameter: number,
  layer1: LayerId,
  layer2: LayerId
): Via {
  return {
    id: newId("Via"),
    position,
    netId,
    diameter,
    drillDiameter,
    startLayer: layer1,
    endLayer: layer2,
    type: "buried",
    locked: false,
  };
}

// ============================================================================
// Trace Operations
// ============================================================================

/**
 * Add a segment to a trace.
 */
export function addSegmentToTrace(trace: Trace, segment: TraceSegment): Trace {
  return {
    ...trace,
    segments: [...trace.segments, segment],
  };
}

/**
 * Extend a trace to a new point.
 */
export function extendTrace(trace: Trace, point: Vec2, width?: number): Trace {
  if (trace.segments.length === 0) {
    return trace;
  }

  const lastSegment = trace.segments[trace.segments.length - 1];
  const newSegment: TraceSegment = {
    start: lastSegment.end,
    end: point,
    width: width ?? lastSegment.width,
  };

  return addSegmentToTrace(trace, newSegment);
}

/**
 * Set trace width for all segments.
 */
export function setTraceWidth(trace: Trace, width: number): Trace {
  return {
    ...trace,
    segments: trace.segments.map((s) => ({ ...s, width })),
    arcs: trace.arcs?.map((a) => ({ ...a, width })),
  };
}

/**
 * Move entire trace by offset.
 */
export function moveTrace(trace: Trace, offset: Vec2): Trace {
  return {
    ...trace,
    segments: trace.segments.map((s) => ({
      ...s,
      start: [s.start[0] + offset[0], s.start[1] + offset[1]] as Vec2,
      end: [s.end[0] + offset[0], s.end[1] + offset[1]] as Vec2,
    })),
    arcs: trace.arcs?.map((a) => ({
      ...a,
      center: [a.center[0] + offset[0], a.center[1] + offset[1]] as Vec2,
    })),
  };
}

/**
 * Get total length of a trace.
 */
export function getTraceLength(trace: Trace): number {
  let length = 0;

  for (const seg of trace.segments) {
    const dx = seg.end[0] - seg.start[0];
    const dy = seg.end[1] - seg.start[1];
    length += Math.sqrt(dx * dx + dy * dy);
  }

  if (trace.arcs) {
    for (const arc of trace.arcs) {
      const angleDiff = Math.abs(arc.endAngle - arc.startAngle);
      const arcLength = (angleDiff * Math.PI * arc.radius) / 180;
      length += arcLength;
    }
  }

  return length;
}

/**
 * Get start point of trace.
 */
export function getTraceStart(trace: Trace): Vec2 | null {
  if (trace.segments.length === 0) return null;
  return trace.segments[0].start;
}

/**
 * Get end point of trace.
 */
export function getTraceEnd(trace: Trace): Vec2 | null {
  if (trace.segments.length === 0) return null;
  return trace.segments[trace.segments.length - 1].end;
}

/**
 * Check if a point is on a trace segment.
 */
export function isPointOnTrace(
  point: Vec2,
  trace: Trace,
  tolerance: number = 0.1
): boolean {
  for (const seg of trace.segments) {
    if (isPointOnSegment(point, seg.start, seg.end, tolerance + seg.width / 2)) {
      return true;
    }
  }
  return false;
}

function isPointOnSegment(
  point: Vec2,
  start: Vec2,
  end: Vec2,
  tolerance: number
): boolean {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    const dist = Math.sqrt(
      (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2
    );
    return dist <= tolerance;
  }

  // Calculate distance from point to line
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (length * length)
    )
  );

  const nearestX = start[0] + t * dx;
  const nearestY = start[1] + t * dy;
  const dist = Math.sqrt((point[0] - nearestX) ** 2 + (point[1] - nearestY) ** 2);

  return dist <= tolerance;
}

// ============================================================================
// Via Operations
// ============================================================================

/**
 * Move a via to a new position.
 */
export function moveVia(via: Via, position: Vec2): Via {
  return { ...via, position };
}

/**
 * Resize a via.
 */
export function resizeVia(via: Via, diameter: number, drillDiameter: number): Via {
  return { ...via, diameter, drillDiameter };
}

/**
 * Check if via is through-hole (spans all layers).
 */
export function isThroughHoleVia(via: Via): boolean {
  return via.type === "through";
}

/**
 * Get the annular ring size of a via.
 */
export function getViaAnnularRing(via: Via): number {
  return (via.diameter - via.drillDiameter) / 2;
}
