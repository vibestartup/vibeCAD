/**
 * Drawing types - 2D technical drawings with views, dimensions, and annotations.
 *
 * A drawing references one or more .vibecad files and creates 2D projected views
 * that can be dimensioned and annotated for manufacturing documentation.
 */

import {
  DrawingId,
  DrawingViewId,
  DrawingDimId,
  DrawingAnnotationId,
  OpId,
  newId,
} from "./id";
import { Vec2, Vec3 } from "./math";
import { TopoRef } from "./op";
import { DimValue, dimLiteral } from "./constraint";

// ============================================================================
// Sheet Configuration
// ============================================================================

export type SheetSize = "A4" | "A3" | "A2" | "A1" | "A0" | "Letter" | "Tabloid" | "Custom";

export interface Sheet {
  size: SheetSize;
  width: number; // mm
  height: number; // mm
  orientation: "landscape" | "portrait";
  margins: { top: number; right: number; bottom: number; left: number };
}

/** Standard sheet dimensions in mm */
export const SHEET_SIZES: Record<Exclude<SheetSize, "Custom">, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
  A0: { width: 841, height: 1189 },
  Letter: { width: 216, height: 279 },
  Tabloid: { width: 279, height: 432 },
};

export function createSheet(size: SheetSize, orientation: "landscape" | "portrait" = "landscape"): Sheet {
  const dims = size === "Custom" ? { width: 297, height: 210 } : SHEET_SIZES[size];
  const isLandscape = orientation === "landscape";
  return {
    size,
    width: isLandscape ? Math.max(dims.width, dims.height) : Math.min(dims.width, dims.height),
    height: isLandscape ? Math.min(dims.width, dims.height) : Math.max(dims.width, dims.height),
    orientation,
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
  };
}

// ============================================================================
// View Projection
// ============================================================================

export type ViewProjection =
  | "front"
  | "back"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "isometric"
  | "dimetric"
  | "trimetric"
  | "section"
  | "detail";

/** Get the view direction vector for standard projections */
export function getProjectionDirection(projection: ViewProjection): Vec3 {
  switch (projection) {
    case "front":
      return [0, -1, 0]; // Looking from +Y towards origin
    case "back":
      return [0, 1, 0];
    case "top":
      return [0, 0, -1]; // Looking from +Z down
    case "bottom":
      return [0, 0, 1];
    case "left":
      return [1, 0, 0]; // Looking from -X
    case "right":
      return [-1, 0, 0];
    case "isometric":
      return [-0.577, -0.577, -0.577]; // Normalized (1,1,1)
    case "dimetric":
      return [-0.423, -0.906, 0]; // Typical dimetric
    case "trimetric":
      return [-0.5, -0.707, -0.5];
    default:
      return [0, -1, 0];
  }
}

/** Get the up vector for standard projections */
export function getProjectionUp(projection: ViewProjection): Vec3 {
  switch (projection) {
    case "front":
    case "back":
    case "left":
    case "right":
      return [0, 0, 1]; // Z-up for elevation views
    case "top":
      return [0, 1, 0]; // Y-up when looking down
    case "bottom":
      return [0, -1, 0];
    case "isometric":
    case "dimetric":
    case "trimetric":
      return [0, 0, 1];
    default:
      return [0, 0, 1];
  }
}

// ============================================================================
// Projected Geometry (computed at runtime)
// ============================================================================

export type ProjectedEdgeType = "visible" | "hidden" | "silhouette" | "section";

export interface ProjectedEdge {
  type: ProjectedEdgeType;
  points: Vec2[]; // Polyline in view coordinates (mm on sheet after scaling)
  sourceTopoRef?: TopoRef; // For dimension attachment
}

export interface ProjectedVertex {
  position: Vec2;
  worldPosition: Vec3;
  sourceTopoRef?: TopoRef;
}

export interface ViewProjectionResult {
  edges: ProjectedEdge[];
  vertices: ProjectedVertex[];
  boundingBox: { min: Vec2; max: Vec2 };
}

// ============================================================================
// Drawing View
// ============================================================================

export interface DrawingView {
  id: DrawingViewId;
  name: string;

  /** Source geometry reference */
  sourceRef: {
    /** Relative path to .vibecad file */
    path: string;
    /** Optional: specific operation to show (null = final result) */
    opId?: OpId;
  };

  /** View configuration */
  projection: ViewProjection;
  scale: number; // e.g., 0.5 for 1:2
  position: Vec2; // Center position on sheet (mm)
  rotation: number; // Rotation in degrees

  /** For section views */
  sectionPlane?: {
    origin: Vec3;
    normal: Vec3;
  };

  /** For detail views */
  detailConfig?: {
    parentViewId: DrawingViewId;
    center: Vec2; // In parent view coordinates
    radius: number;
    detailScale: number; // Additional magnification
  };

  /** Display options */
  showHiddenLines: boolean;
  showCenterLines: boolean;
  lineWeight: number; // mm

  /** Computed projection data (runtime only, not persisted) */
  projectionResult?: ViewProjectionResult;
}

export function createDrawingView(
  name: string,
  sourcePath: string,
  projection: ViewProjection = "front",
  position: Vec2 = [0, 0],
  scale: number = 1
): DrawingView {
  return {
    id: newId("DrawingView"),
    name,
    sourceRef: { path: sourcePath },
    projection,
    scale,
    position,
    rotation: 0,
    showHiddenLines: false,
    showCenterLines: true,
    lineWeight: 0.35,
  };
}

// ============================================================================
// View Point Reference (for dimensions)
// ============================================================================

export type ViewPointRefType =
  | "vertex" // A projected vertex
  | "edge-endpoint" // Start or end of an edge
  | "edge-midpoint" // Midpoint of an edge
  | "edge-point" // Arbitrary point along edge (parameter 0-1)
  | "center" // Center of circle/arc
  | "explicit"; // Explicit 2D point

export interface ViewPointRef {
  viewId: DrawingViewId;
  type: ViewPointRefType;
  /** For vertex/edge references */
  topoRef?: TopoRef;
  /** For edge-point (0-1 along edge) */
  parameter?: number;
  /** For explicit points (in view coordinates) */
  explicit?: Vec2;
  /** Which endpoint (0 = start, 1 = end) */
  endpointIndex?: 0 | 1;
}

// ============================================================================
// Drawing Dimensions
// ============================================================================

export interface DimensionStyleOverrides {
  textHeight?: number;
  arrowSize?: number;
  precision?: number;
  showUnits?: boolean;
  prefix?: string;
  suffix?: string;
}

interface DrawingDimBase {
  id: DrawingDimId;
  /** Dimension label position offset from default */
  labelOffset: Vec2;
  /** Style overrides for this dimension */
  style?: DimensionStyleOverrides;
  /** Tolerance (optional) */
  tolerance?: { upper: number; lower: number };
}

export interface LinearDimension extends DrawingDimBase {
  type: "linear";
  point1: ViewPointRef;
  point2: ViewPointRef;
  direction: "horizontal" | "vertical" | "aligned";
  /** Perpendicular offset from measured line (mm on sheet) */
  offset: number;
}

export interface DiameterDimension extends DrawingDimBase {
  type: "diameter";
  viewId: DrawingViewId;
  circleRef: TopoRef;
  /** Leader line end position */
  leaderPosition: Vec2;
}

export interface RadiusDimension extends DrawingDimBase {
  type: "radius";
  viewId: DrawingViewId;
  arcRef: TopoRef;
  leaderPosition: Vec2;
}

export interface AngleDimension extends DrawingDimBase {
  type: "angle";
  point1: ViewPointRef; // First line point 1
  vertex: ViewPointRef; // Angle vertex
  point2: ViewPointRef; // Second line point 2
  /** Arc position relative to vertex */
  arcRadius: number;
}

export type DrawingDimension =
  | LinearDimension
  | DiameterDimension
  | RadiusDimension
  | AngleDimension;

export function createLinearDimension(
  point1: ViewPointRef,
  point2: ViewPointRef,
  direction: "horizontal" | "vertical" | "aligned" = "aligned",
  offset: number = 10
): LinearDimension {
  return {
    id: newId("DrawingDim"),
    type: "linear",
    point1,
    point2,
    direction,
    offset,
    labelOffset: [0, 0],
  };
}

// ============================================================================
// Drawing Annotations
// ============================================================================

interface AnnotationBase {
  id: DrawingAnnotationId;
  position: Vec2; // On sheet (mm)
}

export interface TextAnnotation extends AnnotationBase {
  type: "text";
  text: string;
  fontSize: number; // mm
  fontFamily: string;
  alignment: "left" | "center" | "right";
  rotation: number; // degrees
}

export interface NoteAnnotation extends AnnotationBase {
  type: "note";
  text: string;
  fontSize: number;
  /** Leader line to attach point */
  leader?: {
    attachPoint: ViewPointRef;
    bendPoints: Vec2[]; // Intermediate points for multi-segment leader
    arrowStyle: "arrow" | "dot" | "none";
  };
}

export interface BalloonAnnotation extends AnnotationBase {
  type: "balloon";
  number: string;
  shape: "circle" | "triangle" | "hexagon" | "square";
  size: number; // Diameter or width (mm)
  leader: {
    attachPoint: ViewPointRef;
  };
}

export interface CentermarkAnnotation extends AnnotationBase {
  type: "centermark";
  viewId: DrawingViewId;
  circleRef: TopoRef;
  size: number; // Cross size (mm)
  showLines: boolean; // Extended centerlines
}

export type DrawingAnnotation =
  | TextAnnotation
  | NoteAnnotation
  | BalloonAnnotation
  | CentermarkAnnotation;

export function createTextAnnotation(
  text: string,
  position: Vec2,
  fontSize: number = 3.5
): TextAnnotation {
  return {
    id: newId("DrawingAnnotation"),
    type: "text",
    text,
    position,
    fontSize,
    fontFamily: "sans-serif",
    alignment: "left",
    rotation: 0,
  };
}

export function createNoteAnnotation(
  text: string,
  position: Vec2,
  attachPoint?: ViewPointRef
): NoteAnnotation {
  return {
    id: newId("DrawingAnnotation"),
    type: "note",
    text,
    position,
    fontSize: 3.5,
    leader: attachPoint
      ? {
          attachPoint,
          bendPoints: [],
          arrowStyle: "arrow",
        }
      : undefined,
  };
}

// ============================================================================
// Dimension Style
// ============================================================================

export interface DimensionStyle {
  arrowSize: number; // mm
  textHeight: number; // mm
  extensionLineGap: number; // Gap from geometry to extension line start
  extensionLineExtend: number; // How far extension line extends past dimension line
  dimLineGap: number; // Gap between text and dimension line
  precision: number; // Decimal places
  units: "mm" | "in";
  showUnits: boolean;
  font: string;
  color: string;
}

export const DEFAULT_DIM_STYLE: DimensionStyle = {
  arrowSize: 2.5,
  textHeight: 3.5,
  extensionLineGap: 1.5,
  extensionLineExtend: 2,
  dimLineGap: 1,
  precision: 2,
  units: "mm",
  showUnits: false,
  font: "sans-serif",
  color: "#000000",
};

// ============================================================================
// Main Drawing Type
// ============================================================================

export interface DrawingMeta {
  createdAt: number;
  modifiedAt: number;
  version: number;
}

export interface Drawing {
  id: DrawingId;
  name: string;

  /** Sheet configuration */
  sheet: Sheet;

  /** Title block fields (optional) */
  titleBlock?: {
    title: string;
    partNumber?: string;
    revision?: string;
    drawnBy?: string;
    date?: string;
    material?: string;
    scale?: string;
    [key: string]: string | undefined;
  };

  /** Views placed on this drawing */
  views: Map<DrawingViewId, DrawingView>;
  viewOrder: DrawingViewId[]; // Z-order for rendering

  /** Dimensions */
  dimensions: Map<DrawingDimId, DrawingDimension>;

  /** Annotations */
  annotations: Map<DrawingAnnotationId, DrawingAnnotation>;

  /** Dimension style settings */
  dimStyle: DimensionStyle;

  /** File metadata */
  meta: DrawingMeta;
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createDrawing(name: string, sheetSize: SheetSize = "A3"): Drawing {
  const now = Date.now();
  return {
    id: newId("Drawing"),
    name,
    sheet: createSheet(sheetSize, "landscape"),
    views: new Map(),
    viewOrder: [],
    dimensions: new Map(),
    annotations: new Map(),
    dimStyle: { ...DEFAULT_DIM_STYLE },
    meta: {
      createdAt: now,
      modifiedAt: now,
      version: 1,
    },
  };
}

export function touchDrawing(drawing: Drawing): Drawing {
  return {
    ...drawing,
    meta: {
      ...drawing.meta,
      modifiedAt: Date.now(),
      version: drawing.meta.version + 1,
    },
  };
}

// ============================================================================
// Immutable Update Helpers
// ============================================================================

export function addView(drawing: Drawing, view: DrawingView): Drawing {
  const newViews = new Map(drawing.views);
  newViews.set(view.id, view);
  return touchDrawing({
    ...drawing,
    views: newViews,
    viewOrder: [...drawing.viewOrder, view.id],
  });
}

export function updateView(
  drawing: Drawing,
  viewId: DrawingViewId,
  updates: Partial<DrawingView>
): Drawing {
  const view = drawing.views.get(viewId);
  if (!view) return drawing;

  const newViews = new Map(drawing.views);
  newViews.set(viewId, { ...view, ...updates });
  return touchDrawing({
    ...drawing,
    views: newViews,
  });
}

export function removeView(drawing: Drawing, viewId: DrawingViewId): Drawing {
  const newViews = new Map(drawing.views);
  newViews.delete(viewId);
  return touchDrawing({
    ...drawing,
    views: newViews,
    viewOrder: drawing.viewOrder.filter((id) => id !== viewId),
  });
}

export function addDimension(drawing: Drawing, dim: DrawingDimension): Drawing {
  const newDims = new Map(drawing.dimensions);
  newDims.set(dim.id, dim);
  return touchDrawing({
    ...drawing,
    dimensions: newDims,
  });
}

export function updateDimension(
  drawing: Drawing,
  dimId: DrawingDimId,
  updates: Partial<DrawingDimension>
): Drawing {
  const dim = drawing.dimensions.get(dimId);
  if (!dim) return drawing;

  const newDims = new Map(drawing.dimensions);
  newDims.set(dimId, { ...dim, ...updates } as DrawingDimension);
  return touchDrawing({
    ...drawing,
    dimensions: newDims,
  });
}

export function removeDimension(drawing: Drawing, dimId: DrawingDimId): Drawing {
  const newDims = new Map(drawing.dimensions);
  newDims.delete(dimId);
  return touchDrawing({
    ...drawing,
    dimensions: newDims,
  });
}

export function addAnnotation(drawing: Drawing, ann: DrawingAnnotation): Drawing {
  const newAnns = new Map(drawing.annotations);
  newAnns.set(ann.id, ann);
  return touchDrawing({
    ...drawing,
    annotations: newAnns,
  });
}

export function removeAnnotation(drawing: Drawing, annId: DrawingAnnotationId): Drawing {
  const newAnns = new Map(drawing.annotations);
  newAnns.delete(annId);
  return touchDrawing({
    ...drawing,
    annotations: newAnns,
  });
}
