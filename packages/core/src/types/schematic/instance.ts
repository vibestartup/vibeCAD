/**
 * Symbol instances - placed symbols on a schematic.
 */

import {
  SymbolInstanceId,
  SymbolId,
  SheetId,
  newId,
} from "../id";
import { SchematicPoint, rotatePoint, mirrorPointX } from "./primitives";
import { Symbol, SymbolPin } from "./symbol";

// ============================================================================
// Symbol Instance
// ============================================================================

export type InstanceRotation = 0 | 90 | 180 | 270;

export interface SymbolInstance {
  id: SymbolInstanceId;
  symbolId: SymbolId;

  // Placement
  position: SchematicPoint;
  rotation: InstanceRotation;
  mirror: boolean;

  // Annotation
  refDes: string; // e.g., "R1", "U3"
  value: string; // e.g., "10k", "LM7805"

  // Properties (component-specific: manufacturer, part number, etc.)
  properties: Map<string, string>;

  // Which sheet this instance is on
  sheetId: SheetId;

  // For multi-unit symbols, which unit this is (1-based)
  unit: number;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new symbol instance.
 */
export function createSymbolInstance(
  symbolId: SymbolId,
  position: SchematicPoint,
  sheetId: SheetId,
  refDes: string,
  value: string = ""
): SymbolInstance {
  return {
    id: newId("SymbolInstance"),
    symbolId,
    position,
    rotation: 0,
    mirror: false,
    refDes,
    value,
    properties: new Map(),
    sheetId,
    unit: 1,
  };
}

// ============================================================================
// Instance Operations (Immutable)
// ============================================================================

/**
 * Move an instance to a new position.
 */
export function moveInstance(
  instance: SymbolInstance,
  position: SchematicPoint
): SymbolInstance {
  return { ...instance, position };
}

/**
 * Rotate an instance by 90 degrees clockwise.
 */
export function rotateInstance(instance: SymbolInstance): SymbolInstance {
  const newRotation = ((instance.rotation + 90) % 360) as InstanceRotation;
  return { ...instance, rotation: newRotation };
}

/**
 * Set specific rotation.
 */
export function setInstanceRotation(
  instance: SymbolInstance,
  rotation: InstanceRotation
): SymbolInstance {
  return { ...instance, rotation };
}

/**
 * Toggle mirror state.
 */
export function mirrorInstance(instance: SymbolInstance): SymbolInstance {
  return { ...instance, mirror: !instance.mirror };
}

/**
 * Set the reference designator.
 */
export function setInstanceRefDes(
  instance: SymbolInstance,
  refDes: string
): SymbolInstance {
  return { ...instance, refDes };
}

/**
 * Set the value.
 */
export function setInstanceValue(
  instance: SymbolInstance,
  value: string
): SymbolInstance {
  return { ...instance, value };
}

/**
 * Set a property.
 */
export function setInstanceProperty(
  instance: SymbolInstance,
  key: string,
  value: string
): SymbolInstance {
  const newProps = new Map(instance.properties);
  newProps.set(key, value);
  return { ...instance, properties: newProps };
}

/**
 * Remove a property.
 */
export function removeInstanceProperty(
  instance: SymbolInstance,
  key: string
): SymbolInstance {
  const newProps = new Map(instance.properties);
  newProps.delete(key);
  return { ...instance, properties: newProps };
}

/**
 * Set the unit (for multi-unit symbols).
 */
export function setInstanceUnit(
  instance: SymbolInstance,
  unit: number
): SymbolInstance {
  return { ...instance, unit };
}

// ============================================================================
// Transform Utilities
// ============================================================================

/**
 * Transform a point from symbol-local coordinates to world coordinates.
 */
export function localToWorld(
  instance: SymbolInstance,
  localPoint: SchematicPoint
): SchematicPoint {
  let point = { ...localPoint };

  // Apply mirror
  if (instance.mirror) {
    point = mirrorPointX(point, 0);
  }

  // Apply rotation
  if (instance.rotation !== 0) {
    point = rotatePoint(point, { x: 0, y: 0 }, instance.rotation);
  }

  // Apply translation
  return {
    x: point.x + instance.position.x,
    y: point.y + instance.position.y,
  };
}

/**
 * Transform a point from world coordinates to symbol-local coordinates.
 */
export function worldToLocal(
  instance: SymbolInstance,
  worldPoint: SchematicPoint
): SchematicPoint {
  // Remove translation
  let point = {
    x: worldPoint.x - instance.position.x,
    y: worldPoint.y - instance.position.y,
  };

  // Remove rotation
  if (instance.rotation !== 0) {
    point = rotatePoint(point, { x: 0, y: 0 }, -instance.rotation);
  }

  // Remove mirror
  if (instance.mirror) {
    point = mirrorPointX(point, 0);
  }

  return point;
}

/**
 * Get the world position of a pin on an instance.
 */
export function getPinWorldPosition(
  instance: SymbolInstance,
  pin: SymbolPin
): SchematicPoint {
  return localToWorld(instance, pin.position);
}

/**
 * Get the transformed orientation of a pin.
 */
export function getPinWorldOrientation(
  instance: SymbolInstance,
  pin: SymbolPin
): "left" | "right" | "up" | "down" {
  const orientations: Array<"left" | "right" | "up" | "down"> = ["right", "down", "left", "up"];
  const baseIndex = orientations.indexOf(pin.orientation);

  // Apply rotation
  let index = (baseIndex + instance.rotation / 90) % 4;

  // Apply mirror (flips left/right)
  if (instance.mirror) {
    if (orientations[index] === "left") {
      index = 0; // right
    } else if (orientations[index] === "right") {
      index = 2; // left
    }
  }

  return orientations[index];
}

/**
 * Get the bounding box of an instance in world coordinates.
 */
export function getInstanceBounds(
  instance: SymbolInstance,
  symbol: Symbol
): { minX: number; minY: number; maxX: number; maxY: number } {
  // Transform all four corners of symbol bounds
  const corners = [
    { x: symbol.bounds.minX, y: symbol.bounds.minY },
    { x: symbol.bounds.maxX, y: symbol.bounds.minY },
    { x: symbol.bounds.maxX, y: symbol.bounds.maxY },
    { x: symbol.bounds.minX, y: symbol.bounds.maxY },
  ].map((c) => localToWorld(instance, c));

  return {
    minX: Math.min(...corners.map((c) => c.x)),
    minY: Math.min(...corners.map((c) => c.y)),
    maxX: Math.max(...corners.map((c) => c.x)),
    maxY: Math.max(...corners.map((c) => c.y)),
  };
}

/**
 * Check if a point is within an instance's bounds.
 */
export function isPointInInstance(
  point: SchematicPoint,
  instance: SymbolInstance,
  symbol: Symbol,
  tolerance: number = 0
): boolean {
  const bounds = getInstanceBounds(instance, symbol);
  return (
    point.x >= bounds.minX - tolerance &&
    point.x <= bounds.maxX + tolerance &&
    point.y >= bounds.minY - tolerance &&
    point.y <= bounds.maxY + tolerance
  );
}

/**
 * Find the pin nearest to a world point on an instance.
 */
export function findNearestPin(
  worldPoint: SchematicPoint,
  instance: SymbolInstance,
  symbol: Symbol,
  maxDistance: number = Infinity
): SymbolPin | null {
  let nearestPin: SymbolPin | null = null;
  let nearestDist = maxDistance;

  for (const pin of symbol.pins.values()) {
    const pinWorld = getPinWorldPosition(instance, pin);
    const dist = Math.sqrt(
      (worldPoint.x - pinWorld.x) ** 2 + (worldPoint.y - pinWorld.y) ** 2
    );

    if (dist < nearestDist) {
      nearestDist = dist;
      nearestPin = pin;
    }
  }

  return nearestPin;
}
