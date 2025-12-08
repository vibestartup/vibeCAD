/**
 * PCB Design Rules and DRC (Design Rule Check).
 */

import { LayerId, NetId, NetClassId, newId } from "../id";
import { Vec2 } from "../math";

// ============================================================================
// Design Rules
// ============================================================================

export interface DesignRules {
  // Global minimums
  minTraceWidth: number; // mm
  minTraceClearance: number; // mm
  minViaDiameter: number; // mm
  minViaDrill: number; // mm
  minHoleDiameter: number; // mm
  minAnnularRing: number; // mm
  minSilkscreenWidth: number; // mm
  minSilkscreenClearance: number; // mm

  // Via rules
  minViaToPadClearance: number;
  minViaToTrackClearance: number;
  minViaToViaClearance: number;

  // Copper rules
  minCopperToEdge: number; // mm from board edge
  minCopperToHole: number; // mm from unplated hole

  // Layer-specific rules
  layerRules: Map<
    LayerId,
    {
      minTraceWidth?: number;
      minClearance?: number;
    }
  >;

  // Net class rules (override defaults)
  netClassRules: Map<
    NetClassId,
    {
      traceWidth: number;
      clearance: number;
      viaSize: number;
      viaDrill: number;
      diffPair?: boolean;
      diffPairGap?: number;
    }
  >;

  // Net-specific rules (highest priority override)
  netRules: Map<
    NetId,
    {
      traceWidth?: number;
      clearance?: number;
    }
  >;
}

// ============================================================================
// DRC Violation Types
// ============================================================================

export type DrcViolationType =
  | "clearance" // Two items too close
  | "short" // Direct short circuit
  | "unconnected" // Unrouted connection
  | "trace_width" // Trace too narrow
  | "annular_ring" // Via/pad annular ring too small
  | "drill_size" // Drill too small
  | "hole_size" // Hole too small
  | "copper_pour" // Zone fill error
  | "silkscreen" // Silkscreen over pads
  | "silkscreen_width" // Silkscreen too thin
  | "courtyard_overlap" // Component courtyards overlap
  | "edge_clearance" // Too close to board edge
  | "differential_pair" // Diff pair mismatch
  | "track_angle" // Non-45-degree angle
  | "solder_mask" // Solder mask issue
  | "net_class" // Net class violation
  | "custom"; // User-defined rule

export type DrcSeverity = "error" | "warning" | "info";

// ============================================================================
// DRC Violation
// ============================================================================

export interface DrcViolationElement {
  type: "trace" | "via" | "pad" | "pour" | "footprint" | "zone" | "text" | "graphic";
  id: string;
  layer?: LayerId;
}

export interface DrcViolation {
  id: string;
  type: DrcViolationType;
  severity: DrcSeverity;
  message: string;
  location: Vec2;

  // Affected elements
  elements: DrcViolationElement[];

  // Rule details
  rule?: string; // Name of violated rule
  expected?: number; // Expected value (e.g., min clearance)
  actual?: number; // Actual measured value

  // Excluded from report
  excluded?: boolean;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create default design rules.
 */
export function createDefaultDesignRules(): DesignRules {
  return {
    // Standard PCB minimums (suitable for most fab houses)
    minTraceWidth: 0.15, // 6 mil
    minTraceClearance: 0.15, // 6 mil
    minViaDiameter: 0.6, // 24 mil
    minViaDrill: 0.3, // 12 mil
    minHoleDiameter: 0.3, // 12 mil
    minAnnularRing: 0.15, // 6 mil
    minSilkscreenWidth: 0.15, // 6 mil
    minSilkscreenClearance: 0.1,

    minViaToPadClearance: 0.15,
    minViaToTrackClearance: 0.15,
    minViaToViaClearance: 0.15,

    minCopperToEdge: 0.25,
    minCopperToHole: 0.25,

    layerRules: new Map(),
    netClassRules: new Map(),
    netRules: new Map(),
  };
}

/**
 * Create design rules for JLCPCB.
 */
export function createJlcpcbDesignRules(): DesignRules {
  return {
    minTraceWidth: 0.127, // 5 mil
    minTraceClearance: 0.127, // 5 mil
    minViaDiameter: 0.45, // Minimum via pad size
    minViaDrill: 0.2, // 0.2mm minimum drill
    minHoleDiameter: 0.2,
    minAnnularRing: 0.125, // Minimum annular ring
    minSilkscreenWidth: 0.15,
    minSilkscreenClearance: 0.1,

    minViaToPadClearance: 0.127,
    minViaToTrackClearance: 0.127,
    minViaToViaClearance: 0.127,

    minCopperToEdge: 0.2,
    minCopperToHole: 0.25,

    layerRules: new Map(),
    netClassRules: new Map(),
    netRules: new Map(),
  };
}

/**
 * Create design rules for OSH Park.
 */
export function createOshParkDesignRules(): DesignRules {
  return {
    minTraceWidth: 0.152, // 6 mil
    minTraceClearance: 0.152, // 6 mil
    minViaDiameter: 0.61, // 24 mil
    minViaDrill: 0.254, // 10 mil
    minHoleDiameter: 0.254,
    minAnnularRing: 0.152, // 6 mil
    minSilkscreenWidth: 0.15,
    minSilkscreenClearance: 0.15,

    minViaToPadClearance: 0.152,
    minViaToTrackClearance: 0.152,
    minViaToViaClearance: 0.152,

    minCopperToEdge: 0.381, // 15 mil
    minCopperToHole: 0.254,

    layerRules: new Map(),
    netClassRules: new Map(),
    netRules: new Map(),
  };
}

/**
 * Create a DRC violation.
 */
export function createDrcViolation(
  type: DrcViolationType,
  severity: DrcSeverity,
  message: string,
  location: Vec2,
  elements: DrcViolationElement[]
): DrcViolation {
  return {
    id: newId("DrcViolation") as string,
    type,
    severity,
    message,
    location,
    elements,
  };
}

// ============================================================================
// Design Rule Operations
// ============================================================================

/**
 * Set a layer-specific rule.
 */
export function setLayerRule(
  rules: DesignRules,
  layerId: LayerId,
  layerRules: { minTraceWidth?: number; minClearance?: number }
): DesignRules {
  const newLayerRules = new Map(rules.layerRules);
  newLayerRules.set(layerId, layerRules);
  return { ...rules, layerRules: newLayerRules };
}

/**
 * Set a net class rule.
 */
export function setNetClassRule(
  rules: DesignRules,
  classId: NetClassId,
  classRules: {
    traceWidth: number;
    clearance: number;
    viaSize: number;
    viaDrill: number;
    diffPair?: boolean;
    diffPairGap?: number;
  }
): DesignRules {
  const newClassRules = new Map(rules.netClassRules);
  newClassRules.set(classId, classRules);
  return { ...rules, netClassRules: newClassRules };
}

/**
 * Set a net-specific rule.
 */
export function setNetRule(
  rules: DesignRules,
  netId: NetId,
  netRules: { traceWidth?: number; clearance?: number }
): DesignRules {
  const newNetRules = new Map(rules.netRules);
  newNetRules.set(netId, netRules);
  return { ...rules, netRules: newNetRules };
}

/**
 * Get effective trace width for a net.
 */
export function getEffectiveTraceWidth(
  rules: DesignRules,
  netId?: NetId,
  classId?: NetClassId,
  layerId?: LayerId
): number {
  // Net-specific rules have highest priority
  if (netId && rules.netRules.has(netId)) {
    const netRule = rules.netRules.get(netId)!;
    if (netRule.traceWidth !== undefined) {
      return netRule.traceWidth;
    }
  }

  // Net class rules next
  if (classId && rules.netClassRules.has(classId)) {
    return rules.netClassRules.get(classId)!.traceWidth;
  }

  // Layer-specific rules
  if (layerId && rules.layerRules.has(layerId)) {
    const layerRule = rules.layerRules.get(layerId)!;
    if (layerRule.minTraceWidth !== undefined) {
      return layerRule.minTraceWidth;
    }
  }

  // Global default
  return rules.minTraceWidth;
}

/**
 * Get effective clearance between two nets.
 */
export function getEffectiveClearance(
  rules: DesignRules,
  netId1?: NetId,
  netId2?: NetId,
  classId1?: NetClassId,
  classId2?: NetClassId
): number {
  // Check net-specific rules for both nets
  let clearance = rules.minTraceClearance;

  if (netId1 && rules.netRules.has(netId1)) {
    const rule = rules.netRules.get(netId1)!;
    if (rule.clearance !== undefined) {
      clearance = Math.max(clearance, rule.clearance);
    }
  }

  if (netId2 && rules.netRules.has(netId2)) {
    const rule = rules.netRules.get(netId2)!;
    if (rule.clearance !== undefined) {
      clearance = Math.max(clearance, rule.clearance);
    }
  }

  // Check net class rules
  if (classId1 && rules.netClassRules.has(classId1)) {
    clearance = Math.max(clearance, rules.netClassRules.get(classId1)!.clearance);
  }

  if (classId2 && rules.netClassRules.has(classId2)) {
    clearance = Math.max(clearance, rules.netClassRules.get(classId2)!.clearance);
  }

  return clearance;
}

// ============================================================================
// DRC Result Utilities
// ============================================================================

/**
 * Filter violations by severity.
 */
export function filterViolationsBySeverity(
  violations: DrcViolation[],
  severity: DrcSeverity
): DrcViolation[] {
  return violations.filter((v) => v.severity === severity);
}

/**
 * Filter violations by type.
 */
export function filterViolationsByType(
  violations: DrcViolation[],
  type: DrcViolationType
): DrcViolation[] {
  return violations.filter((v) => v.type === type);
}

/**
 * Get error count.
 */
export function getErrorCount(violations: DrcViolation[]): number {
  return violations.filter((v) => v.severity === "error" && !v.excluded).length;
}

/**
 * Get warning count.
 */
export function getWarningCount(violations: DrcViolation[]): number {
  return violations.filter((v) => v.severity === "warning" && !v.excluded).length;
}

/**
 * Exclude a violation.
 */
export function excludeViolation(violation: DrcViolation): DrcViolation {
  return { ...violation, excluded: true };
}

/**
 * Include a violation.
 */
export function includeViolation(violation: DrcViolation): DrcViolation {
  return { ...violation, excluded: false };
}
