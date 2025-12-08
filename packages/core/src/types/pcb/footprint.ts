/**
 * PCB Footprints - physical component representations.
 */

import {
  FootprintId,
  PadId,
  LayerId,
  NetId,
  ComponentId,
  ComponentLibraryId,
  newId,
} from "../id";
import { Vec2, Vec3 } from "../math";
import { TextJustify } from "../schematic/primitives";

// ============================================================================
// Pad Types
// ============================================================================

export type PadShapeType = "circle" | "rect" | "oval" | "roundrect" | "trapezoid" | "custom";
export type PadType = "thru_hole" | "smd" | "connect" | "np_thru_hole"; // np = non-plated
export type DrillShape = "circular" | "oval";

export interface PadShape {
  type: PadShapeType;
  // For rect, oval, roundrect, trapezoid
  width?: number;
  height?: number;
  // For circle
  diameter?: number;
  // For roundrect
  cornerRadius?: number;
  // For trapezoid
  trapDeltaX?: number; // Width difference top vs bottom
  // For custom
  polygon?: Vec2[];
}

export interface PadDrill {
  diameter: number;
  shape: DrillShape;
  offset?: Vec2; // Offset from pad center
  // For oval
  ovalWidth?: number;
}

export interface PadThermalRelief {
  gap: number;
  spokeWidth: number;
  spokeCount: number;
  spokeAngle?: number; // Starting angle in degrees
}

// ============================================================================
// Pad
// ============================================================================

export interface Pad {
  id: PadId;
  number: string; // Pad number (matches schematic pin)
  name?: string; // Optional pad name

  // Geometry
  position: Vec2; // Relative to footprint origin
  rotation: number; // Degrees

  // Type
  padType: PadType;

  // Shape
  shape: PadShape;

  // Drill (for through-hole pads)
  drill?: PadDrill;

  // Layers this pad appears on
  layers: LayerId[];

  // Soldermask/paste expansion
  solderMaskMargin?: number;
  solderPasteMargin?: number;
  solderPasteRatio?: number; // Percentage

  // Thermal relief settings
  thermalRelief?: PadThermalRelief;

  // Zone connection type
  zoneConnect?: "inherit" | "solid" | "thermal_relief" | "none";
}

// ============================================================================
// Footprint Graphics
// ============================================================================

export type FootprintGraphicType = "line" | "rect" | "circle" | "arc" | "polygon" | "text";

export interface FootprintLine {
  type: "line";
  start: Vec2;
  end: Vec2;
  width: number;
}

export interface FootprintRect {
  type: "rect";
  corner1: Vec2;
  corner2: Vec2;
  fill: boolean;
  width: number;
}

export interface FootprintCircle {
  type: "circle";
  center: Vec2;
  radius: number;
  fill: boolean;
  width: number;
}

export interface FootprintArc {
  type: "arc";
  center: Vec2;
  radius: number;
  startAngle: number; // Degrees
  endAngle: number; // Degrees
  width: number;
}

export interface FootprintPolygon {
  type: "polygon";
  points: Vec2[];
  fill: boolean;
  width: number;
}

export interface FootprintText {
  type: "text";
  position: Vec2;
  text: string;
  fontSize: number;
  thickness: number;
  justify: TextJustify;
  rotation?: number;
  mirror?: boolean;
}

export type FootprintGraphic =
  | FootprintLine
  | FootprintRect
  | FootprintCircle
  | FootprintArc
  | FootprintPolygon
  | FootprintText;

// ============================================================================
// 3D Model Reference
// ============================================================================

export interface Model3dRef {
  path: string; // Relative path to .vibecad or .step file
  offset: Vec3;
  rotation: Vec3; // Euler angles in degrees
  scale: Vec3;
}

// ============================================================================
// Footprint
// ============================================================================

export interface Footprint {
  id: FootprintId;
  name: string;
  description: string;
  keywords?: string[];

  // Pads
  pads: Map<PadId, Pad>;

  // Graphics per layer
  graphics: Map<LayerId, FootprintGraphic[]>;

  // Courtyard (placement boundary polygon)
  courtyard: Vec2[];

  // Text fields (reference, value positions)
  referencePosition?: Vec2;
  valuePosition?: Vec2;

  // 3D model reference
  model3d?: Model3dRef;

  // Attributes
  smdOnly?: boolean; // Only SMD pads (no through-hole)
  excludeFromBom?: boolean;
  excludeFromPositionFile?: boolean;

  // Library reference
  libraryId?: ComponentLibraryId;
  componentId?: ComponentId;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an SMD pad.
 */
export function createSmdPad(
  number: string,
  position: Vec2,
  width: number,
  height: number,
  layers: LayerId[]
): Pad {
  return {
    id: newId("Pad"),
    number,
    position,
    rotation: 0,
    padType: "smd",
    shape: { type: "rect", width, height },
    layers,
  };
}

/**
 * Create a through-hole pad.
 */
export function createThroughHolePad(
  number: string,
  position: Vec2,
  padDiameter: number,
  drillDiameter: number,
  layers: LayerId[]
): Pad {
  return {
    id: newId("Pad"),
    number,
    position,
    rotation: 0,
    padType: "thru_hole",
    shape: { type: "circle", diameter: padDiameter },
    drill: { diameter: drillDiameter, shape: "circular" },
    layers,
  };
}

/**
 * Create an empty footprint.
 */
export function createFootprint(name: string): Footprint {
  return {
    id: newId("Footprint"),
    name,
    description: "",
    pads: new Map(),
    graphics: new Map(),
    courtyard: [],
  };
}

// ============================================================================
// Common Footprint Generators
// ============================================================================

/**
 * Create a standard 2-pad SMD resistor/capacitor footprint.
 */
export function create0805Footprint(
  topCopperLayer: LayerId,
  topSilkLayer: LayerId,
  topFabLayer: LayerId,
  topCrtYdLayer: LayerId
): Footprint {
  const fp = createFootprint("R_0805_2012Metric");
  fp.description = "Resistor SMD 0805 (2012 Metric)";
  fp.keywords = ["resistor", "0805", "2012", "smd"];

  // Pads (0.95mm x 1.4mm, 1.025mm apart)
  const pad1 = createSmdPad("1", [-0.9375, 0], 0.95, 1.4, [topCopperLayer]);
  const pad2 = createSmdPad("2", [0.9375, 0], 0.95, 1.4, [topCopperLayer]);
  fp.pads.set(pad1.id, pad1);
  fp.pads.set(pad2.id, pad2);

  // Silkscreen outline
  const silkGraphics: FootprintGraphic[] = [
    { type: "line", start: [-0.227064, -0.735], end: [0.227064, -0.735], width: 0.12 },
    { type: "line", start: [-0.227064, 0.735], end: [0.227064, 0.735], width: 0.12 },
  ];
  fp.graphics.set(topSilkLayer, silkGraphics);

  // Fab layer (actual component outline)
  const fabGraphics: FootprintGraphic[] = [
    { type: "rect", corner1: [-1, -0.625], corner2: [1, 0.625], fill: false, width: 0.1 },
  ];
  fp.graphics.set(topFabLayer, fabGraphics);

  // Courtyard
  fp.courtyard = [
    [-1.68, -0.98],
    [1.68, -0.98],
    [1.68, 0.98],
    [-1.68, 0.98],
  ];

  return fp;
}

/**
 * Create a standard QFP footprint.
 */
export function createTqfp44Footprint(
  topCopperLayer: LayerId,
  topSilkLayer: LayerId,
  topFabLayer: LayerId,
  topCrtYdLayer: LayerId
): Footprint {
  const fp = createFootprint("TQFP-44_10x10mm_P0.8mm");
  fp.description = "TQFP-44, 10x10mm, 0.8mm pitch";
  fp.keywords = ["tqfp", "qfp", "44", "0.8mm"];

  // 44 pins, 11 per side, 0.8mm pitch
  // Package body is 10x10mm, pins extend beyond

  const pinCount = 44;
  const pinsPerSide = 11;
  const pitch = 0.8;
  const padWidth = 0.5;
  const padLength = 1.2;
  const bodySize = 10;
  const padCenterOffset = bodySize / 2 + padLength / 2 - 0.2;

  let pinNum = 1;

  // Bottom side (pins 1-11, left to right)
  for (let i = 0; i < pinsPerSide; i++) {
    const x = -((pinsPerSide - 1) / 2) * pitch + i * pitch;
    const pad = createSmdPad(String(pinNum), [x, -padCenterOffset], padWidth, padLength, [topCopperLayer]);
    fp.pads.set(pad.id, pad);
    pinNum++;
  }

  // Right side (pins 12-22, bottom to top)
  for (let i = 0; i < pinsPerSide; i++) {
    const y = -((pinsPerSide - 1) / 2) * pitch + i * pitch;
    const pad = createSmdPad(String(pinNum), [padCenterOffset, y], padLength, padWidth, [topCopperLayer]);
    fp.pads.set(pad.id, pad);
    pinNum++;
  }

  // Top side (pins 23-33, right to left)
  for (let i = 0; i < pinsPerSide; i++) {
    const x = ((pinsPerSide - 1) / 2) * pitch - i * pitch;
    const pad = createSmdPad(String(pinNum), [x, padCenterOffset], padWidth, padLength, [topCopperLayer]);
    fp.pads.set(pad.id, pad);
    pinNum++;
  }

  // Left side (pins 34-44, top to bottom)
  for (let i = 0; i < pinsPerSide; i++) {
    const y = ((pinsPerSide - 1) / 2) * pitch - i * pitch;
    const pad = createSmdPad(String(pinNum), [-padCenterOffset, y], padLength, padWidth, [topCopperLayer]);
    fp.pads.set(pad.id, pad);
    pinNum++;
  }

  // Silkscreen
  const silkSize = 5.2;
  const silkGraphics: FootprintGraphic[] = [
    { type: "rect", corner1: [-silkSize, -silkSize], corner2: [silkSize, silkSize], fill: false, width: 0.12 },
    // Pin 1 marker
    { type: "circle", center: [-silkSize - 0.5, -silkSize - 0.5], radius: 0.2, fill: true, width: 0 },
  ];
  fp.graphics.set(topSilkLayer, silkGraphics);

  // Courtyard
  const courtyard = 7;
  fp.courtyard = [
    [-courtyard, -courtyard],
    [courtyard, -courtyard],
    [courtyard, courtyard],
    [-courtyard, courtyard],
  ];

  return fp;
}

// ============================================================================
// Footprint Operations
// ============================================================================

/**
 * Add a pad to a footprint.
 */
export function addPadToFootprint(footprint: Footprint, pad: Pad): Footprint {
  const newPads = new Map(footprint.pads);
  newPads.set(pad.id, pad);
  return { ...footprint, pads: newPads };
}

/**
 * Add graphics to a layer.
 */
export function addGraphicsToFootprint(
  footprint: Footprint,
  layerId: LayerId,
  graphics: FootprintGraphic[]
): Footprint {
  const newGraphics = new Map(footprint.graphics);
  const existing = newGraphics.get(layerId) || [];
  newGraphics.set(layerId, [...existing, ...graphics]);
  return { ...footprint, graphics: newGraphics };
}

/**
 * Set the 3D model.
 */
export function setFootprintModel3d(
  footprint: Footprint,
  model: Model3dRef | undefined
): Footprint {
  return { ...footprint, model3d: model };
}

/**
 * Calculate the bounding box of a footprint.
 */
export function getFootprintBounds(footprint: Footprint): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Include pads
  for (const pad of footprint.pads.values()) {
    const halfW = (pad.shape.width || pad.shape.diameter || 0) / 2;
    const halfH = (pad.shape.height || pad.shape.diameter || 0) / 2;
    minX = Math.min(minX, pad.position[0] - halfW);
    minY = Math.min(minY, pad.position[1] - halfH);
    maxX = Math.max(maxX, pad.position[0] + halfW);
    maxY = Math.max(maxY, pad.position[1] + halfH);
  }

  // Include courtyard
  for (const pt of footprint.courtyard) {
    minX = Math.min(minX, pt[0]);
    minY = Math.min(minY, pt[1]);
    maxX = Math.max(maxX, pt[0]);
    maxY = Math.max(maxY, pt[1]);
  }

  if (!isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  return { minX, minY, maxX, maxY };
}
