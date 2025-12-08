/**
 * PCB Footprint Instances - placed footprints on a board.
 */

import {
  FootprintInstanceId,
  FootprintId,
  PadId,
  NetId,
  SymbolInstanceId,
  newId,
} from "../id";
import { Vec2 } from "../math";
import { Footprint, getFootprintBounds } from "./footprint";

// ============================================================================
// Footprint Instance
// ============================================================================

export type BoardSide = "top" | "bottom";

export interface FootprintInstance {
  id: FootprintInstanceId;
  footprintId: FootprintId;

  // Placement
  position: Vec2;
  rotation: number; // Degrees
  side: BoardSide;
  locked: boolean;

  // From schematic
  refDes: string;
  value: string;
  symbolInstanceId?: SymbolInstanceId; // Link back to schematic

  // Pad net assignments (padId -> netId)
  padNets: Map<PadId, NetId>;

  // Properties (manufacturer, part number, etc.)
  properties: Map<string, string>;

  // Visibility flags
  refDesVisible: boolean;
  valueVisible: boolean;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new footprint instance.
 */
export function createFootprintInstance(
  footprintId: FootprintId,
  position: Vec2,
  refDes: string,
  value: string = ""
): FootprintInstance {
  return {
    id: newId("FootprintInstance"),
    footprintId,
    position,
    rotation: 0,
    side: "top",
    locked: false,
    refDes,
    value,
    padNets: new Map(),
    properties: new Map(),
    refDesVisible: true,
    valueVisible: true,
  };
}

// ============================================================================
// Instance Operations (Immutable)
// ============================================================================

/**
 * Move instance to a new position.
 */
export function moveFootprintInstance(
  instance: FootprintInstance,
  position: Vec2
): FootprintInstance {
  return { ...instance, position };
}

/**
 * Rotate instance by angle (adds to current rotation).
 */
export function rotateFootprintInstance(
  instance: FootprintInstance,
  angleDeg: number
): FootprintInstance {
  const newRotation = (instance.rotation + angleDeg) % 360;
  return { ...instance, rotation: newRotation < 0 ? newRotation + 360 : newRotation };
}

/**
 * Set specific rotation.
 */
export function setFootprintInstanceRotation(
  instance: FootprintInstance,
  rotation: number
): FootprintInstance {
  return { ...instance, rotation: rotation % 360 };
}

/**
 * Flip instance to opposite side.
 */
export function flipFootprintInstance(instance: FootprintInstance): FootprintInstance {
  return {
    ...instance,
    side: instance.side === "top" ? "bottom" : "top",
  };
}

/**
 * Set instance side.
 */
export function setFootprintInstanceSide(
  instance: FootprintInstance,
  side: BoardSide
): FootprintInstance {
  return { ...instance, side };
}

/**
 * Lock/unlock instance.
 */
export function setFootprintInstanceLocked(
  instance: FootprintInstance,
  locked: boolean
): FootprintInstance {
  return { ...instance, locked };
}

/**
 * Set reference designator.
 */
export function setFootprintInstanceRefDes(
  instance: FootprintInstance,
  refDes: string
): FootprintInstance {
  return { ...instance, refDes };
}

/**
 * Set value.
 */
export function setFootprintInstanceValue(
  instance: FootprintInstance,
  value: string
): FootprintInstance {
  return { ...instance, value };
}

/**
 * Set pad net assignment.
 */
export function setFootprintInstancePadNet(
  instance: FootprintInstance,
  padId: PadId,
  netId: NetId | undefined
): FootprintInstance {
  const newPadNets = new Map(instance.padNets);
  if (netId === undefined) {
    newPadNets.delete(padId);
  } else {
    newPadNets.set(padId, netId);
  }
  return { ...instance, padNets: newPadNets };
}

/**
 * Set all pad nets at once.
 */
export function setFootprintInstancePadNets(
  instance: FootprintInstance,
  padNets: Map<PadId, NetId>
): FootprintInstance {
  return { ...instance, padNets: new Map(padNets) };
}

/**
 * Set a property.
 */
export function setFootprintInstanceProperty(
  instance: FootprintInstance,
  key: string,
  value: string
): FootprintInstance {
  const newProps = new Map(instance.properties);
  newProps.set(key, value);
  return { ...instance, properties: newProps };
}

/**
 * Remove a property.
 */
export function removeFootprintInstanceProperty(
  instance: FootprintInstance,
  key: string
): FootprintInstance {
  const newProps = new Map(instance.properties);
  newProps.delete(key);
  return { ...instance, properties: newProps };
}

/**
 * Link to schematic symbol instance.
 */
export function linkToSymbolInstance(
  instance: FootprintInstance,
  symbolInstanceId: SymbolInstanceId | undefined
): FootprintInstance {
  return { ...instance, symbolInstanceId };
}

// ============================================================================
// Transform Utilities
// ============================================================================

/**
 * Transform a point from footprint-local to world coordinates.
 */
export function localToWorld(instance: FootprintInstance, localPoint: Vec2): Vec2 {
  // Apply rotation
  const rad = (instance.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  let x = localPoint[0];
  let y = localPoint[1];

  // Mirror for bottom side
  if (instance.side === "bottom") {
    x = -x;
  }

  // Rotate
  const rotX = x * cos - y * sin;
  const rotY = x * sin + y * cos;

  // Translate
  return [rotX + instance.position[0], rotY + instance.position[1]];
}

/**
 * Transform a point from world to footprint-local coordinates.
 */
export function worldToLocal(instance: FootprintInstance, worldPoint: Vec2): Vec2 {
  // Remove translation
  let x = worldPoint[0] - instance.position[0];
  let y = worldPoint[1] - instance.position[1];

  // Remove rotation
  const rad = (-instance.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const localX = x * cos - y * sin;
  const localY = x * sin + y * cos;

  // Remove mirror for bottom side
  if (instance.side === "bottom") {
    return [-localX, localY];
  }

  return [localX, localY];
}

/**
 * Get the world-space bounding box of an instance.
 */
export function getInstanceBounds(
  instance: FootprintInstance,
  footprint: Footprint
): { minX: number; minY: number; maxX: number; maxY: number } {
  const fpBounds = getFootprintBounds(footprint);

  // Transform all four corners
  const corners = [
    [fpBounds.minX, fpBounds.minY] as Vec2,
    [fpBounds.maxX, fpBounds.minY] as Vec2,
    [fpBounds.maxX, fpBounds.maxY] as Vec2,
    [fpBounds.minX, fpBounds.maxY] as Vec2,
  ].map((c) => localToWorld(instance, c));

  return {
    minX: Math.min(...corners.map((c) => c[0])),
    minY: Math.min(...corners.map((c) => c[1])),
    maxX: Math.max(...corners.map((c) => c[0])),
    maxY: Math.max(...corners.map((c) => c[1])),
  };
}

/**
 * Check if a point is within an instance's bounds.
 */
export function isPointInInstance(
  point: Vec2,
  instance: FootprintInstance,
  footprint: Footprint,
  tolerance: number = 0
): boolean {
  const bounds = getInstanceBounds(instance, footprint);
  return (
    point[0] >= bounds.minX - tolerance &&
    point[0] <= bounds.maxX + tolerance &&
    point[1] >= bounds.minY - tolerance &&
    point[1] <= bounds.maxY + tolerance
  );
}

/**
 * Get the world position of a pad on an instance.
 */
export function getPadWorldPosition(
  instance: FootprintInstance,
  footprint: Footprint,
  padId: PadId
): Vec2 | null {
  const pad = footprint.pads.get(padId);
  if (!pad) return null;
  return localToWorld(instance, pad.position);
}

/**
 * Find the nearest pad to a world point.
 */
export function findNearestPad(
  worldPoint: Vec2,
  instance: FootprintInstance,
  footprint: Footprint,
  maxDistance: number = Infinity
): PadId | null {
  let nearestPad: PadId | null = null;
  let nearestDist = maxDistance;

  for (const [padId, pad] of footprint.pads) {
    const padWorld = localToWorld(instance, pad.position);
    const dist = Math.sqrt(
      (worldPoint[0] - padWorld[0]) ** 2 + (worldPoint[1] - padWorld[1]) ** 2
    );

    if (dist < nearestDist) {
      nearestDist = dist;
      nearestPad = padId;
    }
  }

  return nearestPad;
}

/**
 * Get all pads assigned to a specific net.
 */
export function getPadsForNet(
  instance: FootprintInstance,
  netId: NetId
): PadId[] {
  const result: PadId[] = [];
  for (const [padId, net] of instance.padNets) {
    if (net === netId) {
      result.push(padId);
    }
  }
  return result;
}
