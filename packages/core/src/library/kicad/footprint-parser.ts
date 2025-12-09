/**
 * KiCad Footprint Parser (.kicad_mod)
 *
 * Parses KiCad 6/7/8 footprint module files and converts them to vibeCAD Footprint format.
 *
 * KiCad footprint structure:
 * (footprint "name"
 *   (layer "F.Cu")
 *   (descr "description")
 *   (tags "tag1 tag2")
 *   (attr smd)
 *   (fp_text reference "REF**" ...)
 *   (fp_text value "VAL**" ...)
 *   (fp_line ...)
 *   (fp_rect ...)
 *   (fp_circle ...)
 *   (fp_arc ...)
 *   (fp_poly ...)
 *   (pad "1" smd rect ...)
 *   (model "path.step" ...)
 * )
 */

import {
  parseSExpr,
  SExprList,
  findChild,
  findChildren,
  getAtomValue,
  getAtomValues,
  getStringValue,
  getNumberValue,
  getXY,
  getXYAngle,
  getNamedString,
  getNamedNumber,
  hasFlag,
  isList,
} from "./sexpr";
import {
  Footprint,
  Pad,
  PadType,
  PadShape,
  PadShapeType,
  PadDrill,
  DrillShape,
  FootprintGraphic,
  FootprintLine,
  FootprintRect,
  FootprintCircle,
  FootprintArc,
  FootprintPolygon,
  FootprintText,
  Model3dRef,
  createFootprint,
  createSmdPad,
  createThroughHolePad,
} from "../../types/pcb/footprint";
import { TextJustify } from "../../types/schematic/primitives";
import { Vec2, Vec3 } from "../../types/math";
import { newId, FootprintId, PadId, LayerId } from "../../types/id";

// ============================================================================
// KiCad Layer Mapping
// ============================================================================

/**
 * Standard KiCad layer names mapped to generic layer types.
 */
export const KICAD_LAYER_MAP: Record<string, string> = {
  "F.Cu": "top_copper",
  "B.Cu": "bottom_copper",
  "F.SilkS": "top_silk",
  "B.SilkS": "bottom_silk",
  "F.Mask": "top_mask",
  "B.Mask": "bottom_mask",
  "F.Paste": "top_paste",
  "B.Paste": "bottom_paste",
  "F.CrtYd": "top_courtyard",
  "B.CrtYd": "bottom_courtyard",
  "F.Fab": "top_fab",
  "B.Fab": "bottom_fab",
  "Edge.Cuts": "edge_cuts",
  "Dwgs.User": "drawings",
  "Cmts.User": "comments",
  "*.Cu": "all_copper",
  "*.Mask": "all_mask",
  "*.Paste": "all_paste",
};

// ============================================================================
// Types
// ============================================================================

export interface KicadFootprint {
  name: string;
  layer: string;
  description?: string;
  tags?: string[];
  attributes: KicadFootprintAttributes;
  properties: Map<string, KicadFootprintProperty>;
  graphics: KicadFootprintGraphic[];
  pads: KicadPad[];
  model3d?: KicadModel3d;
  zones?: KicadZone[];
}

export interface KicadFootprintAttributes {
  type: "smd" | "through_hole" | "virtual";
  boardOnly?: boolean;
  excludeFromBom?: boolean;
  excludeFromPosFiles?: boolean;
}

export interface KicadFootprintProperty {
  name: string;
  value: string;
  position?: { x: number; y: number; angle?: number };
  layer?: string;
  hide?: boolean;
}

export type KicadFootprintGraphic =
  | KicadFpLine
  | KicadFpRect
  | KicadFpCircle
  | KicadFpArc
  | KicadFpPoly
  | KicadFpText;

export interface KicadFpLine {
  type: "line";
  start: { x: number; y: number };
  end: { x: number; y: number };
  layer: string;
  width: number;
}

export interface KicadFpRect {
  type: "rect";
  start: { x: number; y: number };
  end: { x: number; y: number };
  layer: string;
  width: number;
  fill: boolean;
}

export interface KicadFpCircle {
  type: "circle";
  center: { x: number; y: number };
  end: { x: number; y: number }; // Point on circle
  layer: string;
  width: number;
  fill: boolean;
}

export interface KicadFpArc {
  type: "arc";
  start: { x: number; y: number };
  mid: { x: number; y: number };
  end: { x: number; y: number };
  layer: string;
  width: number;
}

export interface KicadFpPoly {
  type: "poly";
  points: Array<{ x: number; y: number }>;
  layer: string;
  width: number;
  fill: boolean;
}

export interface KicadFpText {
  type: "text";
  textType: "reference" | "value" | "user";
  text: string;
  position: { x: number; y: number; angle?: number };
  layer: string;
  hide?: boolean;
  fontSize?: { width: number; height: number };
  thickness?: number;
  justify?: string;
}

export interface KicadPad {
  number: string;
  padType: "smd" | "thru_hole" | "np_thru_hole" | "connect";
  shape: "circle" | "rect" | "oval" | "roundrect" | "trapezoid" | "custom";
  position: { x: number; y: number; angle?: number };
  size: { width: number; height: number };
  drill?: {
    diameter: number;
    shape: "circular" | "oval";
    offset?: { x: number; y: number };
    width?: number; // For oval drills
  };
  layers: string[];
  roundrectRatio?: number;
  chamferRatio?: number;
  chamferCorners?: string[];
  solderMaskMargin?: number;
  solderPasteMargin?: number;
  solderPasteRatio?: number;
  clearance?: number;
  thermalGap?: number;
  thermalBridgeWidth?: number;
  zoneConnect?: number;
  customPadOptions?: unknown;
  primitives?: unknown[];
}

export interface KicadModel3d {
  path: string;
  offset: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

export interface KicadZone {
  // Simplified zone representation
  netName?: string;
  layer: string;
  polygon: Array<{ x: number; y: number }>;
}

// ============================================================================
// Parser
// ============================================================================

/**
 * Parse a KiCad footprint file.
 */
export function parseKicadFootprint(content: string): KicadFootprint {
  const sexpr = parseSExpr(content);

  // Handle both "footprint" and legacy "module" tags
  if (sexpr.tag !== "footprint" && sexpr.tag !== "module") {
    throw new Error(`Expected footprint or module, got ${sexpr.tag}`);
  }

  const name = String(getAtomValue(sexpr) || "");

  // Layer
  const layerExpr = findChild(sexpr, "layer");
  const layer = layerExpr ? String(getAtomValue(layerExpr) || "F.Cu") : "F.Cu";

  // Description
  const descrExpr = findChild(sexpr, "descr");
  const description = descrExpr ? getStringValue(descrExpr) : undefined;

  // Tags
  const tagsExpr = findChild(sexpr, "tags");
  const tagsStr = tagsExpr ? getStringValue(tagsExpr) : undefined;
  const tags = tagsStr ? tagsStr.split(/\s+/).filter(t => t) : undefined;

  // Attributes
  const attributes = parseAttributes(sexpr);

  // Properties (KiCad 7+)
  const properties = new Map<string, KicadFootprintProperty>();
  for (const propExpr of findChildren(sexpr, "property")) {
    const prop = parseProperty(propExpr);
    properties.set(prop.name, prop);
  }

  // Graphics
  const graphics: KicadFootprintGraphic[] = [];
  for (const child of sexpr.children) {
    if (!isList(child)) continue;
    switch (child.tag) {
      case "fp_line":
        graphics.push(parseFpLine(child));
        break;
      case "fp_rect":
        graphics.push(parseFpRect(child));
        break;
      case "fp_circle":
        graphics.push(parseFpCircle(child));
        break;
      case "fp_arc":
        graphics.push(parseFpArc(child));
        break;
      case "fp_poly":
        graphics.push(parseFpPoly(child));
        break;
      case "fp_text":
        graphics.push(parseFpText(child));
        break;
    }
  }

  // Pads
  const pads: KicadPad[] = [];
  for (const padExpr of findChildren(sexpr, "pad")) {
    pads.push(parsePad(padExpr));
  }

  // 3D Model
  const modelExpr = findChild(sexpr, "model");
  const model3d = modelExpr ? parseModel3d(modelExpr) : undefined;

  return {
    name,
    layer,
    description,
    tags,
    attributes,
    properties,
    graphics,
    pads,
    model3d,
  };
}

function parseAttributes(sexpr: SExprList): KicadFootprintAttributes {
  const attrExpr = findChild(sexpr, "attr");
  const result: KicadFootprintAttributes = {
    type: "through_hole",
  };

  if (attrExpr) {
    const values = getAtomValues(attrExpr);
    for (const val of values) {
      switch (val) {
        case "smd":
          result.type = "smd";
          break;
        case "through_hole":
          result.type = "through_hole";
          break;
        case "virtual":
          result.type = "virtual";
          break;
        case "board_only":
          result.boardOnly = true;
          break;
        case "exclude_from_bom":
          result.excludeFromBom = true;
          break;
        case "exclude_from_pos_files":
          result.excludeFromPosFiles = true;
          break;
      }
    }
  }

  return result;
}

function parseProperty(expr: SExprList): KicadFootprintProperty {
  const values = getAtomValues(expr);
  const name = String(values[0] || "");
  const value = String(values[1] || "");

  const atExpr = findChild(expr, "at");
  const position = atExpr ? getXYAngle(atExpr) : undefined;

  const layerExpr = findChild(expr, "layer");
  const layer = layerExpr ? getStringValue(layerExpr) : undefined;

  const effectsExpr = findChild(expr, "effects");
  const hide = effectsExpr ? hasFlag(effectsExpr, "hide") : false;

  return { name, value, position, layer, hide };
}

function parseFpLine(expr: SExprList): KicadFpLine {
  const startExpr = findChild(expr, "start");
  const endExpr = findChild(expr, "end");
  const layerExpr = findChild(expr, "layer");
  const strokeExpr = findChild(expr, "stroke");

  const start = startExpr ? getXY(startExpr) : { x: 0, y: 0 };
  const end = endExpr ? getXY(endExpr) : { x: 0, y: 0 };
  const layer = layerExpr ? String(getAtomValue(layerExpr) || "F.SilkS") : "F.SilkS";

  let width = 0.12;
  if (strokeExpr) {
    width = getNamedNumber(strokeExpr, "width") || width;
  } else {
    width = getNamedNumber(expr, "width") || width;
  }

  return {
    type: "line",
    start: start || { x: 0, y: 0 },
    end: end || { x: 0, y: 0 },
    layer,
    width,
  };
}

function parseFpRect(expr: SExprList): KicadFpRect {
  const startExpr = findChild(expr, "start");
  const endExpr = findChild(expr, "end");
  const layerExpr = findChild(expr, "layer");
  const strokeExpr = findChild(expr, "stroke");
  const fillExpr = findChild(expr, "fill");

  const start = startExpr ? getXY(startExpr) : { x: 0, y: 0 };
  const end = endExpr ? getXY(endExpr) : { x: 0, y: 0 };
  const layer = layerExpr ? String(getAtomValue(layerExpr) || "F.SilkS") : "F.SilkS";

  let width = 0.12;
  if (strokeExpr) {
    width = getNamedNumber(strokeExpr, "width") || width;
  } else {
    width = getNamedNumber(expr, "width") || width;
  }

  const fill = fillExpr ? getStringValue(fillExpr) === "solid" : false;

  return {
    type: "rect",
    start: start || { x: 0, y: 0 },
    end: end || { x: 0, y: 0 },
    layer,
    width,
    fill,
  };
}

function parseFpCircle(expr: SExprList): KicadFpCircle {
  const centerExpr = findChild(expr, "center");
  const endExpr = findChild(expr, "end");
  const layerExpr = findChild(expr, "layer");
  const strokeExpr = findChild(expr, "stroke");
  const fillExpr = findChild(expr, "fill");

  const center = centerExpr ? getXY(centerExpr) : { x: 0, y: 0 };
  const end = endExpr ? getXY(endExpr) : { x: 0, y: 0 };
  const layer = layerExpr ? String(getAtomValue(layerExpr) || "F.SilkS") : "F.SilkS";

  let width = 0.12;
  if (strokeExpr) {
    width = getNamedNumber(strokeExpr, "width") || width;
  } else {
    width = getNamedNumber(expr, "width") || width;
  }

  const fill = fillExpr ? getStringValue(fillExpr) === "solid" : false;

  return {
    type: "circle",
    center: center || { x: 0, y: 0 },
    end: end || { x: 0, y: 0 },
    layer,
    width,
    fill,
  };
}

function parseFpArc(expr: SExprList): KicadFpArc {
  const startExpr = findChild(expr, "start");
  const midExpr = findChild(expr, "mid");
  const endExpr = findChild(expr, "end");
  const layerExpr = findChild(expr, "layer");
  const strokeExpr = findChild(expr, "stroke");

  const start = startExpr ? getXY(startExpr) : { x: 0, y: 0 };
  const mid = midExpr ? getXY(midExpr) : { x: 0, y: 0 };
  const end = endExpr ? getXY(endExpr) : { x: 0, y: 0 };
  const layer = layerExpr ? String(getAtomValue(layerExpr) || "F.SilkS") : "F.SilkS";

  let width = 0.12;
  if (strokeExpr) {
    width = getNamedNumber(strokeExpr, "width") || width;
  } else {
    width = getNamedNumber(expr, "width") || width;
  }

  return {
    type: "arc",
    start: start || { x: 0, y: 0 },
    mid: mid || { x: 0, y: 0 },
    end: end || { x: 0, y: 0 },
    layer,
    width,
  };
}

function parseFpPoly(expr: SExprList): KicadFpPoly {
  const ptsExpr = findChild(expr, "pts");
  const layerExpr = findChild(expr, "layer");
  const strokeExpr = findChild(expr, "stroke");
  const fillExpr = findChild(expr, "fill");

  const points: Array<{ x: number; y: number }> = [];
  if (ptsExpr) {
    for (const xyExpr of findChildren(ptsExpr, "xy")) {
      const xy = getXY(xyExpr);
      if (xy) points.push(xy);
    }
  }

  const layer = layerExpr ? String(getAtomValue(layerExpr) || "F.SilkS") : "F.SilkS";

  let width = 0.12;
  if (strokeExpr) {
    width = getNamedNumber(strokeExpr, "width") || width;
  } else {
    width = getNamedNumber(expr, "width") || width;
  }

  const fill = fillExpr ? getStringValue(fillExpr) === "solid" : false;

  return {
    type: "poly",
    points,
    layer,
    width,
    fill,
  };
}

function parseFpText(expr: SExprList): KicadFpText {
  const values = getAtomValues(expr);
  const textType = values[0] as "reference" | "value" | "user";
  const text = String(values[1] || "");

  const atExpr = findChild(expr, "at");
  const position = atExpr ? getXYAngle(atExpr) : { x: 0, y: 0 };

  const layerExpr = findChild(expr, "layer");
  const layer = layerExpr ? String(getAtomValue(layerExpr) || "F.SilkS") : "F.SilkS";

  const effectsExpr = findChild(expr, "effects");
  let hide = false;
  let fontSize: { width: number; height: number } | undefined;
  let thickness: number | undefined;
  let justify: string | undefined;

  if (effectsExpr) {
    hide = hasFlag(effectsExpr, "hide");

    const fontExpr = findChild(effectsExpr, "font");
    if (fontExpr) {
      const sizeExpr = findChild(fontExpr, "size");
      if (sizeExpr) {
        const sizeVals = getAtomValues(sizeExpr);
        if (sizeVals.length >= 2) {
          fontSize = {
            width: typeof sizeVals[0] === "number" ? sizeVals[0] : 1,
            height: typeof sizeVals[1] === "number" ? sizeVals[1] : 1,
          };
        }
      }
      thickness = getNamedNumber(fontExpr, "thickness");
    }

    const justifyExpr = findChild(effectsExpr, "justify");
    if (justifyExpr) {
      justify = getAtomValues(justifyExpr).join(" ");
    }
  }

  return {
    type: "text",
    textType,
    text,
    position: position || { x: 0, y: 0 },
    layer,
    hide,
    fontSize,
    thickness,
    justify,
  };
}

function parsePad(expr: SExprList): KicadPad {
  const values = getAtomValues(expr);
  const number = String(values[0] || "");
  const padTypeStr = String(values[1] || "smd");
  const shapeStr = String(values[2] || "rect");

  const atExpr = findChild(expr, "at");
  const position = atExpr ? getXYAngle(atExpr) : { x: 0, y: 0 };

  const sizeExpr = findChild(expr, "size");
  const sizeVals = sizeExpr ? getAtomValues(sizeExpr) : [];
  const size = {
    width: typeof sizeVals[0] === "number" ? sizeVals[0] : 1,
    height: typeof sizeVals[1] === "number" ? sizeVals[1] : 1,
  };

  const layersExpr = findChild(expr, "layers");
  const layers = layersExpr ? getAtomValues(layersExpr).map(String) : ["F.Cu"];

  // Drill
  let drill: KicadPad["drill"];
  const drillExpr = findChild(expr, "drill");
  if (drillExpr) {
    const drillVals = getAtomValues(drillExpr);
    let diameter = 0;
    let shape: "circular" | "oval" = "circular";
    let width: number | undefined;

    if (drillVals[0] === "oval") {
      shape = "oval";
      diameter = typeof drillVals[1] === "number" ? drillVals[1] : 0;
      width = typeof drillVals[2] === "number" ? drillVals[2] : diameter;
    } else {
      diameter = typeof drillVals[0] === "number" ? drillVals[0] : 0;
    }

    const offsetExpr = findChild(drillExpr, "offset");
    const offset = offsetExpr ? getXY(offsetExpr) : undefined;

    drill = { diameter, shape, offset, width };
  }

  // Roundrect ratio
  const roundrectRatio = getNamedNumber(expr, "roundrect_rratio");

  // Solder mask/paste
  const solderMaskMargin = getNamedNumber(expr, "solder_mask_margin");
  const solderPasteMargin = getNamedNumber(expr, "solder_paste_margin");
  const solderPasteRatio = getNamedNumber(expr, "solder_paste_margin_ratio");
  const clearance = getNamedNumber(expr, "clearance");
  const thermalGap = getNamedNumber(expr, "thermal_gap");
  const thermalBridgeWidth = getNamedNumber(expr, "thermal_bridge_width");
  const zoneConnect = getNamedNumber(expr, "zone_connect");

  return {
    number,
    padType: padTypeStr as KicadPad["padType"],
    shape: shapeStr as KicadPad["shape"],
    position: position || { x: 0, y: 0 },
    size,
    drill,
    layers,
    roundrectRatio,
    solderMaskMargin,
    solderPasteMargin,
    solderPasteRatio,
    clearance,
    thermalGap,
    thermalBridgeWidth,
    zoneConnect,
  };
}

function parseModel3d(expr: SExprList): KicadModel3d {
  const path = String(getAtomValue(expr) || "");

  const offsetExpr = findChild(expr, "offset");
  const offset = { x: 0, y: 0, z: 0 };
  if (offsetExpr) {
    const xyzExpr = findChild(offsetExpr, "xyz");
    if (xyzExpr) {
      const vals = getAtomValues(xyzExpr);
      offset.x = typeof vals[0] === "number" ? vals[0] : 0;
      offset.y = typeof vals[1] === "number" ? vals[1] : 0;
      offset.z = typeof vals[2] === "number" ? vals[2] : 0;
    }
  }

  const scaleExpr = findChild(expr, "scale");
  const scale = { x: 1, y: 1, z: 1 };
  if (scaleExpr) {
    const xyzExpr = findChild(scaleExpr, "xyz");
    if (xyzExpr) {
      const vals = getAtomValues(xyzExpr);
      scale.x = typeof vals[0] === "number" ? vals[0] : 1;
      scale.y = typeof vals[1] === "number" ? vals[1] : 1;
      scale.z = typeof vals[2] === "number" ? vals[2] : 1;
    }
  }

  const rotateExpr = findChild(expr, "rotate");
  const rotation = { x: 0, y: 0, z: 0 };
  if (rotateExpr) {
    const xyzExpr = findChild(rotateExpr, "xyz");
    if (xyzExpr) {
      const vals = getAtomValues(xyzExpr);
      rotation.x = typeof vals[0] === "number" ? vals[0] : 0;
      rotation.y = typeof vals[1] === "number" ? vals[1] : 0;
      rotation.z = typeof vals[2] === "number" ? vals[2] : 0;
    }
  }

  return { path, offset, scale, rotation };
}

// ============================================================================
// Conversion to vibeCAD Format
// ============================================================================

/**
 * Layer ID resolver function type.
 * Maps KiCad layer names to vibeCAD layer IDs.
 */
export type LayerResolver = (kicadLayer: string) => LayerId;

/**
 * Convert a KiCad footprint to vibeCAD format.
 */
export function convertKicadFootprintToVibecad(
  kicadFp: KicadFootprint,
  resolveLayer: LayerResolver
): Footprint {
  const footprint = createFootprint(kicadFp.name);
  footprint.description = kicadFp.description || "";
  footprint.keywords = kicadFp.tags;
  footprint.smdOnly = kicadFp.attributes.type === "smd";
  footprint.excludeFromBom = kicadFp.attributes.excludeFromBom;
  footprint.excludeFromPositionFile = kicadFp.attributes.excludeFromPosFiles;

  // Convert pads
  for (const kicadPad of kicadFp.pads) {
    const pad = convertPad(kicadPad, resolveLayer);
    footprint.pads.set(pad.id, pad);
  }

  // Convert graphics, grouped by layer
  const graphicsByLayer = new Map<LayerId, FootprintGraphic[]>();

  for (const kicadGraphic of kicadFp.graphics) {
    const layerId = resolveLayer(kicadGraphic.layer);
    const graphic = convertGraphic(kicadGraphic);
    if (graphic) {
      const existing = graphicsByLayer.get(layerId) || [];
      existing.push(graphic);
      graphicsByLayer.set(layerId, existing);
    }
  }

  footprint.graphics = graphicsByLayer;

  // Extract courtyard from graphics
  const courtyardLayer = resolveLayer("F.CrtYd");
  const courtyardGraphics = graphicsByLayer.get(courtyardLayer) || [];
  footprint.courtyard = extractCourtyardPolygon(courtyardGraphics);

  // Extract reference and value positions
  for (const kicadGraphic of kicadFp.graphics) {
    if (kicadGraphic.type === "text") {
      if (kicadGraphic.textType === "reference") {
        footprint.referencePosition = [kicadGraphic.position.x, kicadGraphic.position.y];
      } else if (kicadGraphic.textType === "value") {
        footprint.valuePosition = [kicadGraphic.position.x, kicadGraphic.position.y];
      }
    }
  }

  // Convert 3D model reference
  if (kicadFp.model3d) {
    footprint.model3d = {
      path: kicadFp.model3d.path,
      offset: [kicadFp.model3d.offset.x, kicadFp.model3d.offset.y, kicadFp.model3d.offset.z],
      rotation: [kicadFp.model3d.rotation.x, kicadFp.model3d.rotation.y, kicadFp.model3d.rotation.z],
      scale: [kicadFp.model3d.scale.x, kicadFp.model3d.scale.y, kicadFp.model3d.scale.z],
    };
  }

  return footprint;
}

function convertPad(kicadPad: KicadPad, resolveLayer: LayerResolver): Pad {
  const layers = kicadPad.layers.map(resolveLayer);

  // Convert pad type
  let padType: PadType;
  switch (kicadPad.padType) {
    case "smd":
      padType = "smd";
      break;
    case "thru_hole":
      padType = "thru_hole";
      break;
    case "np_thru_hole":
      padType = "np_thru_hole";
      break;
    case "connect":
      padType = "connect";
      break;
    default:
      padType = "smd";
  }

  // Convert shape
  let shape: PadShape;
  switch (kicadPad.shape) {
    case "circle":
      shape = { type: "circle", diameter: kicadPad.size.width };
      break;
    case "rect":
      shape = { type: "rect", width: kicadPad.size.width, height: kicadPad.size.height };
      break;
    case "oval":
      shape = { type: "oval", width: kicadPad.size.width, height: kicadPad.size.height };
      break;
    case "roundrect":
      shape = {
        type: "roundrect",
        width: kicadPad.size.width,
        height: kicadPad.size.height,
        cornerRadius: (kicadPad.roundrectRatio || 0.25) * Math.min(kicadPad.size.width, kicadPad.size.height),
      };
      break;
    case "trapezoid":
      shape = { type: "trapezoid", width: kicadPad.size.width, height: kicadPad.size.height };
      break;
    case "custom":
      // Fall back to rect for custom shapes
      shape = { type: "rect", width: kicadPad.size.width, height: kicadPad.size.height };
      break;
    default:
      shape = { type: "rect", width: kicadPad.size.width, height: kicadPad.size.height };
  }

  // Convert drill
  let drill: PadDrill | undefined;
  if (kicadPad.drill) {
    drill = {
      diameter: kicadPad.drill.diameter,
      shape: kicadPad.drill.shape,
      offset: kicadPad.drill.offset ? [kicadPad.drill.offset.x, kicadPad.drill.offset.y] : undefined,
      ovalWidth: kicadPad.drill.width,
    };
  }

  const pad: Pad = {
    id: newId("Pad"),
    number: kicadPad.number,
    position: [kicadPad.position.x, kicadPad.position.y],
    rotation: kicadPad.position.angle || 0,
    padType,
    shape,
    drill,
    layers,
    solderMaskMargin: kicadPad.solderMaskMargin,
    solderPasteMargin: kicadPad.solderPasteMargin,
    solderPasteRatio: kicadPad.solderPasteRatio,
    thermalRelief: kicadPad.thermalGap
      ? {
          gap: kicadPad.thermalGap,
          spokeWidth: kicadPad.thermalBridgeWidth || 0.5,
          spokeCount: 4,
        }
      : undefined,
    zoneConnect: kicadPad.zoneConnect !== undefined
      ? (["inherit", "solid", "thermal_relief", "none"] as const)[kicadPad.zoneConnect] || "inherit"
      : undefined,
  };

  return pad;
}

function convertGraphic(kicadGraphic: KicadFootprintGraphic): FootprintGraphic | null {
  switch (kicadGraphic.type) {
    case "line":
      return {
        type: "line",
        start: [kicadGraphic.start.x, kicadGraphic.start.y],
        end: [kicadGraphic.end.x, kicadGraphic.end.y],
        width: kicadGraphic.width,
      };

    case "rect":
      return {
        type: "rect",
        corner1: [kicadGraphic.start.x, kicadGraphic.start.y],
        corner2: [kicadGraphic.end.x, kicadGraphic.end.y],
        fill: kicadGraphic.fill,
        width: kicadGraphic.width,
      };

    case "circle": {
      const dx = kicadGraphic.end.x - kicadGraphic.center.x;
      const dy = kicadGraphic.end.y - kicadGraphic.center.y;
      const radius = Math.sqrt(dx * dx + dy * dy);
      return {
        type: "circle",
        center: [kicadGraphic.center.x, kicadGraphic.center.y],
        radius,
        fill: kicadGraphic.fill,
        width: kicadGraphic.width,
      };
    }

    case "arc": {
      // Convert three-point arc to center/angles
      const arc = calculateArcFromThreePoints(kicadGraphic.start, kicadGraphic.mid, kicadGraphic.end);
      if (!arc) return null;
      return {
        type: "arc",
        center: [arc.center.x, arc.center.y],
        radius: arc.radius,
        startAngle: arc.startAngle,
        endAngle: arc.endAngle,
        width: kicadGraphic.width,
      };
    }

    case "poly":
      return {
        type: "polygon",
        points: kicadGraphic.points.map(p => [p.x, p.y] as Vec2),
        fill: kicadGraphic.fill,
        width: kicadGraphic.width,
      };

    case "text": {
      const justify: TextJustify = kicadGraphic.justify?.includes("left")
        ? "left"
        : kicadGraphic.justify?.includes("right")
        ? "right"
        : "center";
      return {
        type: "text",
        position: [kicadGraphic.position.x, kicadGraphic.position.y],
        text: kicadGraphic.text,
        fontSize: kicadGraphic.fontSize?.height || 1,
        thickness: kicadGraphic.thickness || 0.15,
        justify,
        rotation: kicadGraphic.position.angle,
        mirror: false,
      };
    }

    default:
      return null;
  }
}

function calculateArcFromThreePoints(
  start: { x: number; y: number },
  mid: { x: number; y: number },
  end: { x: number; y: number }
): { center: { x: number; y: number }; radius: number; startAngle: number; endAngle: number } | null {
  const ax = start.x, ay = start.y;
  const bx = mid.x, by = mid.y;
  const cx = end.x, cy = end.y;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-10) return null;

  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

  const radius = Math.sqrt((ax - ux) * (ax - ux) + (ay - uy) * (ay - uy));
  const startAngle = Math.atan2(ay - uy, ax - ux) * 180 / Math.PI;
  const endAngle = Math.atan2(cy - uy, cx - ux) * 180 / Math.PI;

  return { center: { x: ux, y: uy }, radius, startAngle, endAngle };
}

function extractCourtyardPolygon(graphics: FootprintGraphic[]): Vec2[] {
  // Try to find a closed polygon from the courtyard graphics
  // This is a simplified approach - real implementation might need to trace connected lines

  // Look for a polygon first
  for (const g of graphics) {
    if (g.type === "polygon" && g.points.length >= 3) {
      return g.points;
    }
  }

  // Look for a rectangle
  for (const g of graphics) {
    if (g.type === "rect") {
      return [
        g.corner1,
        [g.corner2[0], g.corner1[1]],
        g.corner2,
        [g.corner1[0], g.corner2[1]],
      ];
    }
  }

  // Default: compute bounding box from all graphics
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const g of graphics) {
    switch (g.type) {
      case "line":
        minX = Math.min(minX, g.start[0], g.end[0]);
        minY = Math.min(minY, g.start[1], g.end[1]);
        maxX = Math.max(maxX, g.start[0], g.end[0]);
        maxY = Math.max(maxY, g.start[1], g.end[1]);
        break;
      case "rect":
        minX = Math.min(minX, g.corner1[0], g.corner2[0]);
        minY = Math.min(minY, g.corner1[1], g.corner2[1]);
        maxX = Math.max(maxX, g.corner1[0], g.corner2[0]);
        maxY = Math.max(maxY, g.corner1[1], g.corner2[1]);
        break;
      case "circle":
        minX = Math.min(minX, g.center[0] - g.radius);
        minY = Math.min(minY, g.center[1] - g.radius);
        maxX = Math.max(maxX, g.center[0] + g.radius);
        maxY = Math.max(maxY, g.center[1] + g.radius);
        break;
    }
  }

  if (!isFinite(minX)) {
    return [];
  }

  return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
}
