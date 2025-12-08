/**
 * PCB Copper Pours / Zones.
 */

import { CopperPourId, LayerId, NetId, newId } from "../id";
import { Vec2 } from "../math";

// ============================================================================
// Fill Type
// ============================================================================

export type ZoneFillType = "solid" | "hatched" | "none";

export type ZoneConnectType = "thermal_relief" | "solid" | "none";

// ============================================================================
// Copper Pour / Zone
// ============================================================================

export interface CopperPour {
  id: CopperPourId;
  layerId: LayerId;
  netId?: NetId; // undefined = keepout zone

  // Boundary polygon (closed)
  outline: Vec2[];

  // Fill settings
  fillType: ZoneFillType;
  hatchAngle?: number; // Degrees
  hatchGap?: number; // mm
  hatchWidth?: number; // mm
  hatchSmoothingLevel?: number; // 0-3

  // Clearance
  clearance: number; // mm
  minWidth: number; // Minimum copper width

  // Thermal relief settings
  thermalReliefGap: number;
  thermalReliefSpokeWidth: number;
  thermalReliefSpokeCount?: number;

  // Connection type
  padConnection: ZoneConnectType;

  // Priority (higher = filled first, wins overlaps)
  priority: number;

  // Computed fill polygons (after zone fill calculation)
  fillPolygons?: Vec2[][];

  // Keepout settings (when netId is undefined)
  keepoutTracks?: boolean;
  keepoutVias?: boolean;
  keepoutPads?: boolean;
  keepoutFootprints?: boolean;
  keepoutPours?: boolean;

  // Locked
  locked: boolean;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a copper pour zone.
 */
export function createCopperPour(
  outline: Vec2[],
  layerId: LayerId,
  netId?: NetId
): CopperPour {
  return {
    id: newId("CopperPour"),
    layerId,
    netId,
    outline,
    fillType: "solid",
    clearance: 0.2, // 0.2mm default
    minWidth: 0.2, // 0.2mm default
    thermalReliefGap: 0.25,
    thermalReliefSpokeWidth: 0.4,
    padConnection: netId ? "thermal_relief" : "none",
    priority: 0,
    locked: false,
  };
}

/**
 * Create a keepout zone.
 */
export function createKeepoutZone(
  outline: Vec2[],
  layerId: LayerId,
  options?: {
    keepoutTracks?: boolean;
    keepoutVias?: boolean;
    keepoutPads?: boolean;
    keepoutFootprints?: boolean;
    keepoutPours?: boolean;
  }
): CopperPour {
  return {
    id: newId("CopperPour"),
    layerId,
    outline,
    fillType: "none",
    clearance: 0,
    minWidth: 0,
    thermalReliefGap: 0,
    thermalReliefSpokeWidth: 0,
    padConnection: "none",
    priority: 0,
    keepoutTracks: options?.keepoutTracks ?? true,
    keepoutVias: options?.keepoutVias ?? true,
    keepoutPads: options?.keepoutPads ?? false,
    keepoutFootprints: options?.keepoutFootprints ?? false,
    keepoutPours: options?.keepoutPours ?? true,
    locked: false,
  };
}

/**
 * Create a hatched copper pour.
 */
export function createHatchedPour(
  outline: Vec2[],
  layerId: LayerId,
  netId: NetId,
  hatchGap: number = 0.5,
  hatchWidth: number = 0.25,
  hatchAngle: number = 0
): CopperPour {
  const pour = createCopperPour(outline, layerId, netId);
  return {
    ...pour,
    fillType: "hatched",
    hatchGap,
    hatchWidth,
    hatchAngle,
  };
}

// ============================================================================
// Zone Operations
// ============================================================================

/**
 * Set the fill type.
 */
export function setZoneFillType(zone: CopperPour, fillType: ZoneFillType): CopperPour {
  return { ...zone, fillType };
}

/**
 * Set clearance.
 */
export function setZoneClearance(zone: CopperPour, clearance: number): CopperPour {
  return { ...zone, clearance };
}

/**
 * Set minimum width.
 */
export function setZoneMinWidth(zone: CopperPour, minWidth: number): CopperPour {
  return { ...zone, minWidth };
}

/**
 * Set priority.
 */
export function setZonePriority(zone: CopperPour, priority: number): CopperPour {
  return { ...zone, priority };
}

/**
 * Set thermal relief settings.
 */
export function setZoneThermalRelief(
  zone: CopperPour,
  gap: number,
  spokeWidth: number,
  spokeCount?: number
): CopperPour {
  return {
    ...zone,
    thermalReliefGap: gap,
    thermalReliefSpokeWidth: spokeWidth,
    thermalReliefSpokeCount: spokeCount,
  };
}

/**
 * Set pad connection type.
 */
export function setZonePadConnection(
  zone: CopperPour,
  connection: ZoneConnectType
): CopperPour {
  return { ...zone, padConnection: connection };
}

/**
 * Update zone outline.
 */
export function setZoneOutline(zone: CopperPour, outline: Vec2[]): CopperPour {
  return { ...zone, outline, fillPolygons: undefined };
}

/**
 * Add a point to zone outline.
 */
export function addPointToZoneOutline(zone: CopperPour, point: Vec2): CopperPour {
  return {
    ...zone,
    outline: [...zone.outline, point],
    fillPolygons: undefined,
  };
}

/**
 * Move entire zone by offset.
 */
export function moveZone(zone: CopperPour, offset: Vec2): CopperPour {
  return {
    ...zone,
    outline: zone.outline.map((p) => [p[0] + offset[0], p[1] + offset[1]] as Vec2),
    fillPolygons: zone.fillPolygons?.map((poly) =>
      poly.map((p) => [p[0] + offset[0], p[1] + offset[1]] as Vec2)
    ),
  };
}

/**
 * Set the computed fill polygons.
 */
export function setZoneFillPolygons(
  zone: CopperPour,
  polygons: Vec2[][] | undefined
): CopperPour {
  return { ...zone, fillPolygons: polygons };
}

/**
 * Check if zone is a keepout.
 */
export function isKeepoutZone(zone: CopperPour): boolean {
  return zone.netId === undefined;
}

/**
 * Get zone area (approximate, based on outline).
 */
export function getZoneOutlineArea(zone: CopperPour): number {
  // Shoelace formula
  let area = 0;
  const n = zone.outline.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += zone.outline[i][0] * zone.outline[j][1];
    area -= zone.outline[j][0] * zone.outline[i][1];
  }

  return Math.abs(area) / 2;
}

/**
 * Check if a point is inside the zone outline.
 */
export function isPointInZone(point: Vec2, zone: CopperPour): boolean {
  return isPointInPolygon(point, zone.outline);
}

/**
 * Point-in-polygon test using ray casting.
 */
function isPointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}
