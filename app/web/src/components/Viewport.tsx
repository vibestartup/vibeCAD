/**
 * Viewport - 3D viewport using Three.js for rendering CAD geometry.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useCadStore } from "../store";
import { useSettingsStore } from "../store/settings-store";
import { loadOcc, getOcc } from "@vibecad/kernel";
import type { MeshData, OccApi } from "@vibecad/kernel";
import type { ExportableMesh } from "../utils/stl-export";
import {
  sketch as sketchUtils,
  getDatumPlanes,
  DATUM_XY,
  DATUM_XZ,
  DATUM_YZ,
} from "@vibecad/core";
import type { Sketch, SketchPlane, SketchPlaneId, SketchOp, Vec2, Vec3 } from "@vibecad/core";
import {
  calculateGridSpacing as calcGridSpacing,
  formatTickLabel as formatTick,
  getLengthUnitLabel,
} from "../utils/units";
import type { LengthUnit } from "../store/settings-store";

const styles = {
  container: {
    width: "100%",
    height: "100%",
    position: "relative",
    backgroundColor: "#1a1a2e",
    overflow: "hidden",
  } as React.CSSProperties,

  canvas: {
    display: "block",
  } as React.CSSProperties,

  loading: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    color: "#666",
    fontSize: 14,
    textAlign: "center",
  } as React.CSSProperties,

  viewCube: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 80,
    height: 80,
    backgroundColor: "rgba(30, 30, 60, 0.8)",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#888",
    fontSize: 11,
    cursor: "pointer",
    border: "1px solid #333",
  } as React.CSSProperties,

  controls: {
    position: "absolute",
    bottom: 16,
    right: 16,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  } as React.CSSProperties,

  controlButton: {
    width: 32,
    height: 32,
    border: "1px solid #333",
    borderRadius: 4,
    backgroundColor: "rgba(30, 30, 60, 0.9)",
    color: "#aaa",
    cursor: "pointer",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,

  info: {
    position: "absolute",
    bottom: 16,
    left: 16,
    color: "#666",
    fontSize: 11,
    fontFamily: "monospace",
  } as React.CSSProperties,
};

// Calculate appropriate grid spacing based on camera distance
// Uses unit-aware calculation from utils/units.ts
function calculateGridSpacing(cameraDistance: number, unit: LengthUnit): { major: number; minor: number; label: string } {
  return calcGridSpacing(cameraDistance, unit);
}

// Format a numeric value as a label with appropriate units (value is in mm)
function formatTickLabel(value: number, unit: LengthUnit): string {
  return formatTick(value, unit);
}

// Create a text sprite for axis labels
function createTextSprite(text: string, color: number = 0x888888): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Clear canvas
  ctx.clearRect(0, 0, size, size);

  // Draw text - very light weight, small font
  ctx.font = "200 18px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Make color more transparent/lighter
  const hexColor = color.toString(16).padStart(6, "0");
  ctx.fillStyle = `#${hexColor}99`; // Add alpha for lighter appearance
  ctx.fillText(text, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  return sprite;
}

// Create dynamic grid with tick marks and labels
function createDynamicGrid(
  spacing: { major: number; minor: number; label: string },
  unit: LengthUnit,
  gridSize: number = 200
): THREE.Group {
  const group = new THREE.Group();

  // Minor grid lines
  const minorMaterial = new THREE.LineBasicMaterial({ color: 0x2a2a3a, transparent: true, opacity: 0.5 });
  const minorPoints: THREE.Vector3[] = [];

  const halfSize = gridSize / 2;
  const minorStep = spacing.minor;

  for (let i = -halfSize; i <= halfSize; i += minorStep) {
    // Skip if this is a major line
    if (Math.abs(i % spacing.major) < 0.001) continue;

    // X-aligned lines (along Z)
    minorPoints.push(new THREE.Vector3(i, 0, -halfSize));
    minorPoints.push(new THREE.Vector3(i, 0, halfSize));

    // Z-aligned lines (along X)
    minorPoints.push(new THREE.Vector3(-halfSize, 0, i));
    minorPoints.push(new THREE.Vector3(halfSize, 0, i));
  }

  if (minorPoints.length > 0) {
    const minorGeometry = new THREE.BufferGeometry().setFromPoints(minorPoints);
    const minorLines = new THREE.LineSegments(minorGeometry, minorMaterial);
    group.add(minorLines);
  }

  // Major grid lines
  const majorMaterial = new THREE.LineBasicMaterial({ color: 0x444466 });
  const majorPoints: THREE.Vector3[] = [];

  for (let i = -halfSize; i <= halfSize; i += spacing.major) {
    // X-aligned lines (along Z)
    majorPoints.push(new THREE.Vector3(i, 0, -halfSize));
    majorPoints.push(new THREE.Vector3(i, 0, halfSize));

    // Z-aligned lines (along X)
    majorPoints.push(new THREE.Vector3(-halfSize, 0, i));
    majorPoints.push(new THREE.Vector3(halfSize, 0, i));
  }

  const majorGeometry = new THREE.BufferGeometry().setFromPoints(majorPoints);
  const majorLines = new THREE.LineSegments(majorGeometry, majorMaterial);
  group.add(majorLines);

  // Axis lines (X = red, Z = blue)
  const xAxisMaterial = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 });
  const zAxisMaterial = new THREE.LineBasicMaterial({ color: 0x4444ff, linewidth: 2 });

  const xAxisGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-halfSize, 0.01, 0),
    new THREE.Vector3(halfSize, 0.01, 0),
  ]);
  const zAxisGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.01, -halfSize),
    new THREE.Vector3(0, 0.01, halfSize),
  ]);

  group.add(new THREE.Line(xAxisGeom, xAxisMaterial));
  group.add(new THREE.Line(zAxisGeom, zAxisMaterial));

  // Tick marks along axes
  const tickLength = spacing.major * 0.15;
  const tickMaterial = new THREE.LineBasicMaterial({ color: 0x666688 });
  const tickPoints: THREE.Vector3[] = [];

  // Label sprite size scales with grid spacing
  const labelSize = spacing.major * 0.22;
  const labelOffset = spacing.major * 0.18;

  for (let i = -halfSize; i <= halfSize; i += spacing.major) {
    if (Math.abs(i) < 0.001) continue; // Skip origin

    // Ticks on X axis (perpendicular to X, in Z direction)
    tickPoints.push(new THREE.Vector3(i, 0.01, -tickLength));
    tickPoints.push(new THREE.Vector3(i, 0.01, tickLength));

    // Ticks on Z axis (perpendicular to Z, in X direction)
    tickPoints.push(new THREE.Vector3(-tickLength, 0.01, i));
    tickPoints.push(new THREE.Vector3(tickLength, 0.01, i));

    // Add labels along positive X axis
    if (i > 0 && i <= halfSize * 0.8) {
      const xLabel = createTextSprite(formatTickLabel(i, unit), 0xcc6666);
      xLabel.position.set(i, 0.1, -labelOffset);
      xLabel.scale.set(labelSize, labelSize, 1);
      group.add(xLabel);
    }

    // Add labels along negative X axis
    if (i < 0 && i >= -halfSize * 0.8) {
      const xLabel = createTextSprite(formatTickLabel(i, unit), 0xcc6666);
      xLabel.position.set(i, 0.1, -labelOffset);
      xLabel.scale.set(labelSize, labelSize, 1);
      group.add(xLabel);
    }

    // Add labels along positive Z axis
    if (i > 0 && i <= halfSize * 0.8) {
      const zLabel = createTextSprite(formatTickLabel(i, unit), 0x6666cc);
      zLabel.position.set(-labelOffset, 0.1, i);
      zLabel.scale.set(labelSize, labelSize, 1);
      group.add(zLabel);
    }

    // Add labels along negative Z axis
    if (i < 0 && i >= -halfSize * 0.8) {
      const zLabel = createTextSprite(formatTickLabel(i, unit), 0x6666cc);
      zLabel.position.set(-labelOffset, 0.1, i);
      zLabel.scale.set(labelSize, labelSize, 1);
      group.add(zLabel);
    }
  }

  // Add axis name labels
  const xNameLabel = createTextSprite("X", 0xff4444);
  xNameLabel.position.set(halfSize * 0.95, 0.1, -labelOffset * 2);
  xNameLabel.scale.set(labelSize * 1.5, labelSize * 1.5, 1);
  group.add(xNameLabel);

  const zNameLabel = createTextSprite("Z", 0x4444ff);
  zNameLabel.position.set(-labelOffset * 2, 0.1, halfSize * 0.95);
  zNameLabel.scale.set(labelSize * 1.5, labelSize * 1.5, 1);
  group.add(zNameLabel);

  // Origin label
  const originLabel = createTextSprite("0", 0x888888);
  originLabel.position.set(-labelOffset, 0.1, -labelOffset);
  originLabel.scale.set(labelSize, labelSize, 1);
  group.add(originLabel);

  const tickGeometry = new THREE.BufferGeometry().setFromPoints(tickPoints);
  const tickLines = new THREE.LineSegments(tickGeometry, tickMaterial);
  group.add(tickLines);

  return group;
}

// Axes helper
function createAxes() {
  const axesHelper = new THREE.AxesHelper(50);
  return axesHelper;
}

// Create mesh from MeshData
// Converts from CAD coordinates (Z-up) to Three.js coordinates (Y-up)
function createMeshFromData(meshData: MeshData): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();

  // Swap Y and Z to convert from CAD (Z-up) to Three.js (Y-up)
  const swappedPositions = new Float32Array(meshData.positions.length);
  for (let i = 0; i < meshData.positions.length; i += 3) {
    swappedPositions[i] = meshData.positions[i];         // X stays X
    swappedPositions[i + 1] = meshData.positions[i + 2]; // Y becomes Z
    swappedPositions[i + 2] = meshData.positions[i + 1]; // Z becomes Y
  }

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(swappedPositions, 3)
  );

  if (meshData.normals.length > 0) {
    // Also swap normals Y/Z
    const swappedNormals = new Float32Array(meshData.normals.length);
    for (let i = 0; i < meshData.normals.length; i += 3) {
      swappedNormals[i] = meshData.normals[i];         // X stays X
      swappedNormals[i + 1] = meshData.normals[i + 2]; // Y becomes Z
      swappedNormals[i + 2] = meshData.normals[i + 1]; // Z becomes Y
    }
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(swappedNormals, 3)
    );
  }

  geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));

  // Compute normals if not provided
  if (meshData.normals.length === 0) {
    geometry.computeVertexNormals();
  }

  const material = new THREE.MeshStandardMaterial({
    color: 0x6c8ebf,
    metalness: 0.3,
    roughness: 0.6,
    flatShading: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

// Edge visualization
function createEdges(geometry: THREE.BufferGeometry): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(geometry, 30);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x333355, linewidth: 1 })
  );
  return line;
}

// Map a triangle index to an OCC face index using faceGroups
function triangleToFaceIndex(
  triangleIndex: number,
  faceGroups: { start: number; count: number }[] | undefined
): number {
  if (!faceGroups || faceGroups.length === 0) {
    return triangleIndex; // Fallback: treat each triangle as a face
  }

  for (let i = 0; i < faceGroups.length; i++) {
    const group = faceGroups[i];
    if (triangleIndex >= group.start && triangleIndex < group.start + group.count) {
      return i;
    }
  }

  return -1; // Not found
}

// Get plane by ID (datum planes or custom)
function getPlaneById(planeId: SketchPlaneId, customPlanes?: Map<SketchPlaneId, SketchPlane>): SketchPlane | undefined {
  // Check datum planes first
  const datumPlanes = getDatumPlanes();
  if (datumPlanes.has(planeId)) {
    return datumPlanes.get(planeId);
  }
  // Check custom planes
  if (customPlanes?.has(planeId)) {
    return customPlanes.get(planeId);
  }
  // Default to XY plane
  return DATUM_XY;
}

// Convert sketch 2D point to 3D world coordinates using plane
function sketchPointTo3D(point: Vec2, plane: SketchPlane): THREE.Vector3 {
  const world = sketchUtils.sketchToWorld(point, plane);
  return new THREE.Vector3(world[0], world[2], world[1]); // Swap Y/Z for Three.js (Y is up)
}

// Detect closed loops from line segments
function findClosedLoops(
  lines: Array<{ start: Vec2; end: Vec2 }>,
  tolerance: number = 0.1
): Vec2[][] {
  const loops: Vec2[][] = [];
  const used = new Set<number>();

  const dist = (a: Vec2, b: Vec2) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);

  for (let startIdx = 0; startIdx < lines.length; startIdx++) {
    if (used.has(startIdx)) continue;

    const loop: Vec2[] = [lines[startIdx].start, lines[startIdx].end];
    const usedInLoop = new Set<number>([startIdx]);
    let current = lines[startIdx].end;
    const loopStart = lines[startIdx].start;
    let foundNext = true;

    while (foundNext) {
      foundNext = false;
      for (let i = 0; i < lines.length; i++) {
        if (usedInLoop.has(i)) continue;
        const line = lines[i];

        if (dist(current, line.start) < tolerance) {
          // Check if we've closed the loop
          if (dist(line.end, loopStart) < tolerance && usedInLoop.size >= 2) {
            loop.push(line.end);
            usedInLoop.forEach(idx => used.add(idx));
            used.add(i);
            loops.push(loop);
            foundNext = false;
            break;
          }
          loop.push(line.end);
          current = line.end;
          usedInLoop.add(i);
          foundNext = true;
          break;
        } else if (dist(current, line.end) < tolerance) {
          // Check if we've closed the loop
          if (dist(line.start, loopStart) < tolerance && usedInLoop.size >= 2) {
            loop.push(line.start);
            usedInLoop.forEach(idx => used.add(idx));
            used.add(i);
            loops.push(loop);
            foundNext = false;
            break;
          }
          loop.push(line.start);
          current = line.start;
          usedInLoop.add(i);
          foundNext = true;
          break;
        }
      }
    }
  }

  return loops;
}

// Create 3D line geometry from sketch primitives
function createSketchLines(
  sketch: Sketch,
  plane: SketchPlane,
  color: number = 0x4dabf7,
  opacity: number = 0.5
): THREE.Group {
  const group = new THREE.Group();
  const lineMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    linewidth: 1,
  });

  // Fill material for closed shapes (more transparent)
  const fillMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: opacity * 0.3,
    side: THREE.DoubleSide,
  });

  // Get point position helper
  const getPointPos = (id: string): Vec2 | undefined => {
    const solved = sketch.solvedPositions?.get(id as any);
    if (solved) return solved;
    const prim = sketch.primitives.get(id as any);
    if (prim?.type === "point") return [prim.x, prim.y];
    return undefined;
  };

  // Collect lines for loop detection
  const lineSegments: Array<{ start: Vec2; end: Vec2 }> = [];

  // Draw each primitive
  for (const [, prim] of sketch.primitives) {
    if (prim.type === "line") {
      const startPos = getPointPos(prim.start);
      const endPos = getPointPos(prim.end);
      if (startPos && endPos) {
        // Add to line segments for loop detection
        lineSegments.push({ start: startPos, end: endPos });

        const geometry = new THREE.BufferGeometry().setFromPoints([
          sketchPointTo3D(startPos, plane),
          sketchPointTo3D(endPos, plane),
        ]);
        const line = new THREE.Line(geometry, lineMaterial);
        group.add(line);
      }
    } else if (prim.type === "circle") {
      const centerPos = getPointPos(prim.center);
      if (centerPos) {
        // Create circle as line segments
        const segments = 32;
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const x = centerPos[0] + Math.cos(angle) * prim.radius;
          const y = centerPos[1] + Math.sin(angle) * prim.radius;
          points.push(sketchPointTo3D([x, y], plane));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        group.add(line);

        // Add filled circle mesh using proper 3D transformation
        const fillSegments = 32;
        const centerPoint3D = sketchPointTo3D(centerPos, plane);
        const circlePoints3D: THREE.Vector3[] = [];

        for (let i = 0; i < fillSegments; i++) {
          const angle = (i / fillSegments) * Math.PI * 2;
          const x = centerPos[0] + Math.cos(angle) * prim.radius;
          const y = centerPos[1] + Math.sin(angle) * prim.radius;
          circlePoints3D.push(sketchPointTo3D([x, y], plane));
        }

        // Create triangulated geometry with center point
        const vertices: number[] = [];
        const indices: number[] = [];

        // Add center point first
        vertices.push(centerPoint3D.x, centerPoint3D.y, centerPoint3D.z);

        // Add circle perimeter points
        for (const p of circlePoints3D) {
          vertices.push(p.x, p.y, p.z);
        }

        // Create triangle fan from center
        for (let i = 0; i < fillSegments; i++) {
          indices.push(0, i + 1, ((i + 1) % fillSegments) + 1);
        }

        const fillGeometry = new THREE.BufferGeometry();
        fillGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        fillGeometry.setIndex(indices);
        fillGeometry.computeVertexNormals();

        const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
        group.add(fillMesh);
      }
    } else if (prim.type === "arc") {
      const centerPos = getPointPos(prim.center);
      const startPos = getPointPos(prim.start);
      const endPos = getPointPos(prim.end);
      if (centerPos && startPos && endPos) {
        const dx1 = startPos[0] - centerPos[0];
        const dy1 = startPos[1] - centerPos[1];
        const radius = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const startAngle = Math.atan2(dy1, dx1);
        const dx2 = endPos[0] - centerPos[0];
        const dy2 = endPos[1] - centerPos[1];
        const endAngle = Math.atan2(dy2, dx2);

        // Create arc as line segments
        const segments = 24;
        const points: THREE.Vector3[] = [];
        let sweep = endAngle - startAngle;
        if (prim.clockwise) {
          if (sweep > 0) sweep -= Math.PI * 2;
        } else {
          if (sweep < 0) sweep += Math.PI * 2;
        }
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const angle = startAngle + sweep * t;
          const x = centerPos[0] + Math.cos(angle) * radius;
          const y = centerPos[1] + Math.sin(angle) * radius;
          points.push(sketchPointTo3D([x, y], plane));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        group.add(line);
      }
    } else if (prim.type === "point") {
      // Draw points as small circles
      const pos: Vec2 = [prim.x, prim.y];
      const worldPos = sketchPointTo3D(pos, plane);
      const pointGeometry = new THREE.SphereGeometry(0.5, 8, 8);
      const pointMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
      });
      const sphere = new THREE.Mesh(pointGeometry, pointMaterial);
      sphere.position.copy(worldPos);
      group.add(sphere);
    }
  }

  // Find and fill closed loops from line segments
  if (lineSegments.length >= 3) {
    const loops = findClosedLoops(lineSegments);
    for (let loopIndex = 0; loopIndex < loops.length; loopIndex++) {
      const loop = loops[loopIndex];
      if (loop.length < 3) continue;

      // Transform all loop points to 3D using the same method as lines
      const points3D: THREE.Vector3[] = loop.map(p => sketchPointTo3D(p, plane));

      // Create triangulated geometry from the 3D polygon
      // Use earcut-style fan triangulation from first vertex
      const vertices: number[] = [];
      const indices: number[] = [];

      // Add all vertices
      for (const p of points3D) {
        vertices.push(p.x, p.y, p.z);
      }

      // Create triangle fan from first vertex
      for (let i = 1; i < points3D.length - 1; i++) {
        indices.push(0, i, i + 1);
      }

      const fillGeometry = new THREE.BufferGeometry();
      fillGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      fillGeometry.setIndex(indices);
      fillGeometry.computeVertexNormals();

      const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial.clone());

      // Tag mesh with loop index for hit detection
      fillMesh.userData.isSketchLoop = true;
      fillMesh.userData.loopIndex = loopIndex;

      group.add(fillMesh);
    }
  }

  return group;
}

export function Viewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const sketchGroupRef = useRef<THREE.Group | null>(null);
  const planeGroupRef = useRef<THREE.Group | null>(null);
  const gridGroupRef = useRef<THREE.Group | null>(null);
  const lastGridSpacingRef = useRef<number>(0);
  const lastUnitRef = useRef<LengthUnit>("mm");
  const previewGroupRef = useRef<THREE.Group | null>(null);
  const cursorPointRef = useRef<THREE.Mesh | null>(null);
  const faceHighlightRef = useRef<THREE.Mesh | null>(null);
  const extrudePreviewRef = useRef<THREE.Group | null>(null);

  const [isOccLoading, setIsOccLoading] = useState(true);
  const [occError, setOccError] = useState<string | null>(null);
  const [occApi, setOccApi] = useState<OccApi | null>(null);
  const [hoveredPlane, setHoveredPlane] = useState<string | null>(null);

  // Get length unit from settings
  const lengthUnit = useSettingsStore((s) => s.lengthUnit);

  const studio = useCadStore((s) =>
    s.activeStudioId ? s.document.partStudios.get(s.activeStudioId) : null
  );
  const timelinePosition = useCadStore((s) => s.timelinePosition);
  const editorMode = useCadStore((s) => s.editorMode);
  const createNewSketch = useCadStore((s) => s.createNewSketch);
  const activeSketchId = useCadStore((s) => s.activeSketchId);
  const setSketchMousePos = useCadStore((s) => s.setSketchMousePos);
  const handleSketchClick = useCadStore((s) => s.handleSketchClick);
  const sketchMousePos = useCadStore((s) => s.sketchMousePos);
  const sketchDrawingState = useCadStore((s) => s.sketchDrawingState);
  const gridSnappingEnabled = useCadStore((s) => s.gridSnappingEnabled);
  const faceSelectionTarget = useCadStore((s) => s.faceSelectionTarget);
  const setPendingExtrudeSketch = useCadStore((s) => s.setPendingExtrudeSketch);
  const setPendingExtrudeBodyFace = useCadStore((s) => s.setPendingExtrudeBodyFace);
  const setPendingRevolveSketch = useCadStore((s) => s.setPendingRevolveSketch);
  const pendingRevolve = useCadStore((s) => s.pendingRevolve);
  const pendingExtrude = useCadStore((s) => s.pendingExtrude);
  const hoveredFace = useCadStore((s) => s.hoveredFace);
  const setHoveredFace = useCadStore((s) => s.setHoveredFace);
  const selectedFace = useCadStore((s) => s.selectedFace);
  const setExportMeshes = useCadStore((s) => s.setExportMeshes);
  const setExportShapeHandles = useCadStore((s) => s.setExportShapeHandles);

  // Get the active sketch and its plane for raycasting
  const activeSketch = React.useMemo(() => {
    if (!studio || !activeSketchId) return null;
    return studio.sketches.get(activeSketchId) ?? null;
  }, [studio, activeSketchId]);

  const activeSketchPlane = React.useMemo(() => {
    if (!activeSketch) return null;
    return getPlaneById(activeSketch.planeId, studio?.planes);
  }, [activeSketch, studio?.planes]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50000);
    camera.position.set(50, 50, 50);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-50, 50, -50);
    scene.add(backLight);

    // Dynamic grid (will be updated based on camera distance)
    // Use 'mm' as default; will be updated by unit change effect
    const initialUnit = lastUnitRef.current;
    const initialSpacing = calculateGridSpacing(camera.position.length(), initialUnit);
    const grid = createDynamicGrid(initialSpacing, initialUnit);
    scene.add(grid);
    gridGroupRef.current = grid;
    lastGridSpacingRef.current = initialSpacing.major;

    // Axes helper
    scene.add(createAxes());

    // Mesh group for CAD geometry
    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    // Sketch group for 3D sketch visualization
    const sketchGroup = new THREE.Group();
    scene.add(sketchGroup);
    sketchGroupRef.current = sketchGroup;

    // Plane group for datum plane selection
    const planeGroup = new THREE.Group();
    scene.add(planeGroup);
    planeGroupRef.current = planeGroup;

    // Preview group for in-progress sketch drawing
    const previewGroup = new THREE.Group();
    scene.add(previewGroup);
    previewGroupRef.current = previewGroup;

    // Extrude preview group for pending extrude operations
    const extrudePreviewGroup = new THREE.Group();
    scene.add(extrudePreviewGroup);
    extrudePreviewRef.current = extrudePreviewGroup;

    // Cursor point (constant screen size)
    const cursorGeometry = new THREE.SphereGeometry(1, 16, 16);
    const cursorMaterial = new THREE.MeshBasicMaterial({ color: 0x69db7c });
    const cursorPoint = new THREE.Mesh(cursorGeometry, cursorMaterial);
    cursorPoint.visible = false;
    scene.add(cursorPoint);
    cursorPointRef.current = cursorPoint;

    // Animation loop
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();

      // Update grid based on camera distance and current unit
      const cameraDistance = camera.position.length();
      const currentUnit = lastUnitRef.current;
      const spacing = calculateGridSpacing(cameraDistance, currentUnit);

      // Only regenerate grid if spacing changed significantly
      if (Math.abs(spacing.major - lastGridSpacingRef.current) > 0.001) {
        lastGridSpacingRef.current = spacing.major;

        // Remove old grid
        if (gridGroupRef.current) {
          scene.remove(gridGroupRef.current);
          gridGroupRef.current.traverse((child) => {
            if (child instanceof THREE.Line || child instanceof THREE.LineSegments) {
              child.geometry.dispose();
              (child.material as THREE.Material).dispose();
            }
            if (child instanceof THREE.Sprite) {
              child.material.map?.dispose();
              child.material.dispose();
            }
          });
        }

        // Create new grid
        const newGrid = createDynamicGrid(spacing, currentUnit);
        scene.add(newGrid);
        gridGroupRef.current = newGrid;
      }

      // Update cursor point scale for constant screen size
      if (cursorPointRef.current && cursorPointRef.current.visible) {
        const distToCamera = cursorPointRef.current.position.distanceTo(camera.position);
        const scale = distToCamera * 0.006;
        cursorPointRef.current.scale.setScalar(scale);
      }

      // Update preview group marker scales for constant screen size
      if (previewGroupRef.current) {
        previewGroupRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.isMarker) {
            const distToCamera = child.position.distanceTo(camera.position);
            const scale = distToCamera * 0.005;
            child.scale.setScalar(scale);
          }
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // Load OpenCascade.js
  useEffect(() => {
    (async () => {
      try {
        const occ = await loadOcc();
        setOccApi(occ);
        setIsOccLoading(false);
      } catch (err) {
        setOccError(err instanceof Error ? err.message : String(err));
        setIsOccLoading(false);
      }
    })();
  }, []);

  // Update grid when unit changes
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;

    // Update ref so animation loop uses the new unit
    lastUnitRef.current = lengthUnit;

    // Force grid regeneration by setting spacing to 0
    // This will trigger a rebuild on the next animation frame
    if (scene && camera && gridGroupRef.current) {
      // Remove old grid immediately
      scene.remove(gridGroupRef.current);
      gridGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Line || child instanceof THREE.LineSegments) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
        if (child instanceof THREE.Sprite) {
          child.material.map?.dispose();
          child.material.dispose();
        }
      });

      // Create new grid with the new unit
      const cameraDistance = camera.position.length();
      const spacing = calculateGridSpacing(cameraDistance, lengthUnit);
      const newGrid = createDynamicGrid(spacing, lengthUnit);
      scene.add(newGrid);
      gridGroupRef.current = newGrid;
      lastGridSpacingRef.current = spacing.major;
    }
  }, [lengthUnit]);

  // Build and render geometry from the part studio operations
  useEffect(() => {
    if (!occApi || !meshGroupRef.current || !studio) {
      // Clear export data if no geometry available
      setExportMeshes([]);
      setExportShapeHandles([]);
      return;
    }

    // Clear existing meshes
    const meshGroup = meshGroupRef.current;
    while (meshGroup.children.length > 0) {
      const child = meshGroup.children[0];
      meshGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    // Collect mesh data and shape handles for export
    const exportableMeshes: ExportableMesh[] = [];
    const exportableShapeHandles: number[] = [];

    try {
      // Determine how many operations to process based on timeline position
      const maxIndex = timelinePosition ?? studio.opOrder.length - 1;

      // Process each operation in order, up to the timeline position
      for (let i = 0; i <= maxIndex && i < studio.opOrder.length; i++) {
        const opId = studio.opOrder[i];
        const opNode = studio.opGraph.get(opId);
        if (!opNode || opNode.op.suppressed) continue;

        const op = opNode.op;

        // Handle extrude operations
        if (op.type === "extrude") {
          // Only render extrusions from sketch profiles in the 3D view
          if (op.profile.type !== "sketch") continue;

          const extrudeSketchId = op.profile.sketchId;
          const sketch = studio.sketches.get(extrudeSketchId);
          if (!sketch) continue;

          // Check if the source sketch operation is suppressed
          const sketchOpNode = Array.from(studio.opGraph.values()).find(
            (node) => node.op.type === "sketch" && (node.op as SketchOp).sketchId === extrudeSketchId
          );
          if (sketchOpNode?.op.suppressed) continue;

          // Get the plane for this sketch
          const plane = getPlaneById(sketch.planeId, studio.planes);
          if (!plane) continue;

          // Build profile from sketch lines
          // Get all lines and build a polygon from them
          const lines: Array<{ start: string; end: string }> = [];
          const points2d: Map<string, [number, number]> = new Map();

          // Collect points and lines from sketch
          for (const [id, prim] of sketch.primitives) {
            if (prim.type === "point") {
              const solved = sketch.solvedPositions?.get(id);
              const pos: [number, number] = solved ? [solved[0], solved[1]] : [prim.x, prim.y];
              points2d.set(id, pos);
            } else if (prim.type === "line") {
              lines.push({ start: prim.start, end: prim.end });
            }
          }

          // Order the lines into a closed loop
          if (lines.length < 3) continue;

          const orderedPoints: [number, number, number][] = [];
          let currentEnd = lines[0].start;

          for (let i = 0; i < lines.length; i++) {
            const nextLine = lines.find(
              (l) => l.start === currentEnd || l.end === currentEnd
            );
            if (!nextLine) break;

            if (nextLine.start === currentEnd) {
              const pos2d = points2d.get(nextLine.start);
              if (pos2d) {
                // Transform 2D sketch point to 3D world using plane
                const world = sketchUtils.sketchToWorld(pos2d, plane);
                orderedPoints.push([world[0], world[1], world[2]]);
              }
              currentEnd = nextLine.end;
            } else {
              const pos2d = points2d.get(nextLine.end);
              if (pos2d) {
                // Transform 2D sketch point to 3D world using plane
                const world = sketchUtils.sketchToWorld(pos2d, plane);
                orderedPoints.push([world[0], world[1], world[2]]);
              }
              currentEnd = nextLine.start;
            }
            lines.splice(lines.indexOf(nextLine), 1);
            i = -1; // restart the search
          }

          if (orderedPoints.length < 3) continue;

          // Get extrude depth
          const depth = op.depth.value;

          // Calculate plane normal for extrude direction: cross(axisX, axisY)
          const nx = plane.axisX[1] * plane.axisY[2] - plane.axisX[2] * plane.axisY[1];
          const ny = plane.axisX[2] * plane.axisY[0] - plane.axisX[0] * plane.axisY[2];
          const nz = plane.axisX[0] * plane.axisY[1] - plane.axisX[1] * plane.axisY[0];
          const direction: [number, number, number] =
            op.direction === "reverse" ? [-nx, -ny, -nz] : [nx, ny, nz];

          // Create geometry using OCC
          const wire = occApi.makePolygon(orderedPoints);
          const face = occApi.makeFace(wire);
          const solid = occApi.extrude(face, direction, depth);

          // Mesh the shape
          const meshData = occApi.mesh(solid, 0.5);

          // Store mesh data for export
          exportableMeshes.push({
            positions: new Float32Array(meshData.positions),
            normals: new Float32Array(meshData.normals),
            indices: new Uint32Array(meshData.indices),
            name: op.name,
          });

          // Store shape handle for STEP export (don't free solid - kept for export)
          exportableShapeHandles.push(solid);

          // Create Three.js mesh
          const mesh = createMeshFromData(meshData);
          // Add userData to identify this mesh's operation
          mesh.userData.opId = opId;
          mesh.userData.opType = op.type;
          mesh.userData.isBody = true;
          // Store face groups for proper face selection (maps OCC face index to triangle range)
          mesh.userData.faceGroups = meshData.faceGroups;

          // Add edges
          const edges = createEdges(mesh.geometry);
          edges.userData.opId = opId;

          meshGroup.add(mesh);
          meshGroup.add(edges);

          // Free intermediate OCC shapes (keep solid for STEP export)
          occApi.freeShape(wire);
          occApi.freeShape(face);
          // Note: solid is NOT freed - kept in exportableShapeHandles for STEP export
        }
      }

      // Update export data in store
      setExportMeshes(exportableMeshes);
      setExportShapeHandles(exportableShapeHandles);
    } catch (err) {
      console.error("Failed to create geometry:", err);
      setExportMeshes([]);
      setExportShapeHandles([]);
    }
  }, [occApi, studio, timelinePosition, setExportMeshes, setExportShapeHandles]);

  // Render sketches in 3D space
  useEffect(() => {
    if (!sketchGroupRef.current || !studio) return;

    // Clear existing sketch lines
    const sketchGroup = sketchGroupRef.current;
    while (sketchGroup.children.length > 0) {
      const child = sketchGroup.children[0];
      sketchGroup.remove(child);
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    // Keep rendering 3D sketches even in sketch mode - they stay visible

    // Get the maximum operation index to show
    const maxIndex = timelinePosition ?? studio.opOrder.length - 1;

    // Build a map of sketchId -> { index, suppressed } for sketch operations
    const sketchOpInfo = new Map<string, { index: number; suppressed: boolean }>();
    for (let i = 0; i < studio.opOrder.length; i++) {
      const opId = studio.opOrder[i];
      const opNode = studio.opGraph.get(opId);
      if (opNode?.op.type === "sketch") {
        const sketchOp = opNode.op as SketchOp;
        sketchOpInfo.set(sketchOp.sketchId, {
          index: i,
          suppressed: opNode.op.suppressed ?? false,
        });
      }
    }

    // Render each sketch that's within the timeline position and not suppressed
    for (const [sketchId, sketch] of studio.sketches) {
      // Check if this sketch's operation is within the timeline position
      const info = sketchOpInfo.get(sketchId);
      if (!info || info.index > maxIndex || info.suppressed) {
        continue; // Skip sketches beyond the timeline position or suppressed
      }

      // Skip if sketch has no primitives
      if (sketch.primitives.size === 0) continue;

      // Get the plane for this sketch
      const plane = getPlaneById(sketch.planeId, studio.planes);
      if (!plane) continue;

      // Determine color and opacity based on hover/selection state
      const isHovered = hoveredFace?.type === "sketch" && hoveredFace.sketchId === sketchId;
      const isSelected = selectedFace?.type === "sketch-profile" && selectedFace.sketchId === sketchId;
      const color = (isHovered || isSelected) ? 0x69db7c : 0x4dabf7;
      const opacity = (isHovered || isSelected) ? 0.9 : 0.5;

      // Create 3D lines for the sketch with transparent style
      const sketchLines = createSketchLines(sketch, plane, color, opacity);
      // Add userData so we can identify this sketch on click
      sketchLines.userData.sketchId = sketchId;
      sketchLines.userData.isSketch = true;
      sketchGroup.add(sketchLines);
    }
  }, [studio, timelinePosition, hoveredFace, selectedFace]);

  // Update body face highlight
  useEffect(() => {
    const scene = sceneRef.current;
    const meshGroup = meshGroupRef.current;

    // Remove existing highlight
    if (faceHighlightRef.current) {
      scene?.remove(faceHighlightRef.current);
      faceHighlightRef.current.geometry.dispose();
      (faceHighlightRef.current.material as THREE.Material).dispose();
      faceHighlightRef.current = null;
    }

    // Only show highlight in face selection mode for body faces
    if (editorMode !== "select-face" || !hoveredFace || hoveredFace.type !== "body-face") {
      return;
    }

    if (!meshGroup || !scene) return;

    // Find the mesh with the matching opId
    const bodyMeshes: THREE.Mesh[] = [];
    meshGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.isBody) {
        bodyMeshes.push(obj);
      }
    });

    const targetMesh = bodyMeshes.find((m) => m.userData.opId === hoveredFace.opId);
    if (!targetMesh) return;

    const geometry = targetMesh.geometry as THREE.BufferGeometry;
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex();
    const faceGroups = targetMesh.userData.faceGroups as { start: number; count: number }[] | undefined;

    if (!position) return;

    // Get the OCC face index
    const faceIndex = hoveredFace.faceIndex;

    // Get the face group for this OCC face
    const faceGroup = faceGroups?.[faceIndex];

    // Create highlight geometry for all triangles in this face
    const highlightGeo = new THREE.BufferGeometry();
    const vertices: number[] = [];

    if (faceGroup && index) {
      // Highlight all triangles in the face group
      for (let t = 0; t < faceGroup.count; t++) {
        const triIndex = faceGroup.start + t;
        const i0 = index.getX(triIndex * 3);
        const i1 = index.getX(triIndex * 3 + 1);
        const i2 = index.getX(triIndex * 3 + 2);
        vertices.push(
          position.getX(i0), position.getY(i0), position.getZ(i0),
          position.getX(i1), position.getY(i1), position.getZ(i1),
          position.getX(i2), position.getY(i2), position.getZ(i2)
        );
      }
    } else {
      // Fallback: highlight single triangle (old behavior)
      let i0: number, i1: number, i2: number;
      if (index) {
        i0 = index.getX(faceIndex * 3);
        i1 = index.getX(faceIndex * 3 + 1);
        i2 = index.getX(faceIndex * 3 + 2);
      } else {
        i0 = faceIndex * 3;
        i1 = faceIndex * 3 + 1;
        i2 = faceIndex * 3 + 2;
      }
      vertices.push(
        position.getX(i0), position.getY(i0), position.getZ(i0),
        position.getX(i1), position.getY(i1), position.getZ(i1),
        position.getX(i2), position.getY(i2), position.getZ(i2)
      );
    }

    highlightGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));

    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0x69db7c,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
    });

    const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    // Copy transform from target mesh
    highlightMesh.position.copy(targetMesh.position);
    highlightMesh.rotation.copy(targetMesh.rotation);
    highlightMesh.scale.copy(targetMesh.scale);
    highlightMesh.renderOrder = 999;

    scene.add(highlightMesh);
    faceHighlightRef.current = highlightMesh;
  }, [editorMode, hoveredFace]);

  // Render extrude preview when pending extrude has a sketch selected
  useEffect(() => {
    const extrudePreviewGroup = extrudePreviewRef.current;
    if (!extrudePreviewGroup) return;

    // Clear existing preview
    while (extrudePreviewGroup.children.length > 0) {
      const child = extrudePreviewGroup.children[0];
      extrudePreviewGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    // Only show preview if we have a pending extrude with a sketch selected
    if (!pendingExtrude?.sketchId || !occApi || !studio) return;

    const sketch = studio.sketches.get(pendingExtrude.sketchId as any);
    if (!sketch) return;

    // Get the plane for this sketch
    const plane = getPlaneById(sketch.planeId, studio.planes);
    if (!plane) return;

    try {
      // Build profile from sketch lines (same logic as in the main geometry builder)
      const lines: Array<{ start: string; end: string }> = [];
      const points2d: Map<string, [number, number]> = new Map();

      for (const [id, prim] of sketch.primitives) {
        if (prim.type === "point") {
          const solved = sketch.solvedPositions?.get(id);
          const pos: [number, number] = solved ? [solved[0], solved[1]] : [prim.x, prim.y];
          points2d.set(id, pos);
        } else if (prim.type === "line") {
          lines.push({ start: prim.start, end: prim.end });
        }
      }

      if (lines.length < 3) return;

      // Order lines into closed loop
      const orderedPoints: [number, number, number][] = [];
      let currentEnd = lines[0].start;

      for (let i = 0; i < lines.length; i++) {
        const nextLine = lines.find(
          (l) => l.start === currentEnd || l.end === currentEnd
        );
        if (!nextLine) break;

        if (nextLine.start === currentEnd) {
          const pos2d = points2d.get(nextLine.start);
          if (pos2d) {
            // Transform 2D sketch point to 3D world using plane
            const world = sketchUtils.sketchToWorld(pos2d, plane);
            orderedPoints.push([world[0], world[1], world[2]]);
          }
          currentEnd = nextLine.end;
        } else {
          const pos2d = points2d.get(nextLine.end);
          if (pos2d) {
            // Transform 2D sketch point to 3D world using plane
            const world = sketchUtils.sketchToWorld(pos2d, plane);
            orderedPoints.push([world[0], world[1], world[2]]);
          }
          currentEnd = nextLine.start;
        }
        lines.splice(lines.indexOf(nextLine), 1);
        i = -1;
      }

      if (orderedPoints.length < 3) return;

      // Get depth from pending extrude
      const depth = pendingExtrude.depth || 10;

      // Calculate plane normal for extrude direction: cross(axisX, axisY)
      const nx = plane.axisX[1] * plane.axisY[2] - plane.axisX[2] * plane.axisY[1];
      const ny = plane.axisX[2] * plane.axisY[0] - plane.axisX[0] * plane.axisY[2];
      const nz = plane.axisX[0] * plane.axisY[1] - plane.axisX[1] * plane.axisY[0];
      const direction: [number, number, number] =
        pendingExtrude.direction === "reverse" ? [-nx, -ny, -nz] : [nx, ny, nz];

      // Create preview geometry using OCC
      const wire = occApi.makePolygon(orderedPoints);
      const face = occApi.makeFace(wire);
      const solid = occApi.extrude(face, direction, depth);
      const meshData = occApi.mesh(solid, 0.5);

      // Clean up OCC shapes
      occApi.freeShape(wire);
      occApi.freeShape(face);
      occApi.freeShape(solid);

      // Create Three.js preview mesh with transparent green material
      // Swap Y/Z to convert from CAD (Z-up) to Three.js (Y-up)
      const geometry = new THREE.BufferGeometry();

      const swappedPositions = new Float32Array(meshData.positions.length);
      for (let i = 0; i < meshData.positions.length; i += 3) {
        swappedPositions[i] = meshData.positions[i];         // X stays X
        swappedPositions[i + 1] = meshData.positions[i + 2]; // Y becomes Z
        swappedPositions[i + 2] = meshData.positions[i + 1]; // Z becomes Y
      }
      geometry.setAttribute("position", new THREE.BufferAttribute(swappedPositions, 3));

      if (meshData.normals.length > 0) {
        const swappedNormals = new Float32Array(meshData.normals.length);
        for (let i = 0; i < meshData.normals.length; i += 3) {
          swappedNormals[i] = meshData.normals[i];         // X stays X
          swappedNormals[i + 1] = meshData.normals[i + 2]; // Y becomes Z
          swappedNormals[i + 2] = meshData.normals[i + 1]; // Z becomes Y
        }
        geometry.setAttribute("normal", new THREE.BufferAttribute(swappedNormals, 3));
      }
      geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
      if (meshData.normals.length === 0) {
        geometry.computeVertexNormals();
      }

      const previewMaterial = new THREE.MeshStandardMaterial({
        color: 0x69db7c,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });

      const previewMesh = new THREE.Mesh(geometry, previewMaterial);
      extrudePreviewGroup.add(previewMesh);

      // Add edges for better visibility
      const edgesGeometry = new THREE.EdgesGeometry(geometry, 30);
      const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x40c057, linewidth: 2 });
      const edgeLines = new THREE.LineSegments(edgesGeometry, edgesMaterial);
      extrudePreviewGroup.add(edgeLines);
    } catch (err) {
      console.error("Failed to create extrude preview:", err);
    }
  }, [pendingExtrude, occApi, studio]);

  // Update sketch preview and cursor point
  useEffect(() => {
    const previewGroup = previewGroupRef.current;
    const cursorPoint = cursorPointRef.current;
    const camera = cameraRef.current;
    if (!previewGroup || !cursorPoint || !camera) return;

    // Clear previous preview geometry
    while (previewGroup.children.length > 0) {
      const child = previewGroup.children[0];
      previewGroup.remove(child);
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    // Hide cursor if not in sketch mode or no mouse position
    if (editorMode !== "sketch" || !sketchMousePos || !activeSketchPlane) {
      cursorPoint.visible = false;
      return;
    }

    // Convert sketch 2D to 3D world position (swap Y/Z for Three.js)
    const sketchTo3D = (x: number, y: number): THREE.Vector3 => {
      const plane = activeSketchPlane;
      // Calculate world position: origin + x*axisX + y*axisY
      const worldX = plane.origin[0] + x * plane.axisX[0] + y * plane.axisY[0];
      const worldY = plane.origin[1] + x * plane.axisX[1] + y * plane.axisY[1];
      const worldZ = plane.origin[2] + x * plane.axisX[2] + y * plane.axisY[2];
      // Swap Y/Z for Three.js coordinate system
      return new THREE.Vector3(worldX, worldZ, worldY);
    };

    // Update cursor position
    const cursorPos = sketchTo3D(sketchMousePos.x, sketchMousePos.y);
    cursorPoint.position.copy(cursorPos);
    cursorPoint.visible = true;

    // Scale cursor for constant screen size (target ~6 pixels)
    const distToCamera = cursorPoint.position.distanceTo(camera.position);
    const scale = distToCamera * 0.006;
    cursorPoint.scale.setScalar(scale);

    // Draw preview based on drawing state
    const previewMaterial = new THREE.LineBasicMaterial({
      color: 0x69db7c,
      linewidth: 2,
    });

    if (sketchDrawingState.type === "line" && sketchDrawingState.start) {
      const startPos = sketchTo3D(sketchDrawingState.start.x, sketchDrawingState.start.y);
      const endPos = cursorPos;
      const geometry = new THREE.BufferGeometry().setFromPoints([startPos, endPos]);
      const line = new THREE.Line(geometry, previewMaterial);
      previewGroup.add(line);
    } else if (sketchDrawingState.type === "rect" && sketchDrawingState.start) {
      const s = sketchDrawingState.start;
      const e = sketchMousePos;
      // Draw rectangle as 4 lines
      const p1 = sketchTo3D(s.x, s.y);
      const p2 = sketchTo3D(e.x, s.y);
      const p3 = sketchTo3D(e.x, e.y);
      const p4 = sketchTo3D(s.x, e.y);
      const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2, p3, p4, p1]);
      const line = new THREE.Line(geometry, previewMaterial);
      previewGroup.add(line);
    } else if (sketchDrawingState.type === "circle" && sketchDrawingState.center) {
      const center = sketchDrawingState.center;
      const dx = sketchMousePos.x - center.x;
      const dy = sketchMousePos.y - center.y;
      const radius = Math.sqrt(dx * dx + dy * dy);
      if (radius > 0) {
        // Draw circle as line segments
        const segments = 48;
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const x = center.x + Math.cos(angle) * radius;
          const y = center.y + Math.sin(angle) * radius;
          points.push(sketchTo3D(x, y));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, previewMaterial);
        previewGroup.add(line);
      }
    } else if (sketchDrawingState.type === "arc") {
      if (sketchDrawingState.center && sketchDrawingState.start) {
        // Draw arc preview
        const center = sketchDrawingState.center;
        const start = sketchDrawingState.start;
        const dx1 = start.x - center.x;
        const dy1 = start.y - center.y;
        const radius = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const startAngle = Math.atan2(dy1, dx1);
        const dx2 = sketchMousePos.x - center.x;
        const dy2 = sketchMousePos.y - center.y;
        const endAngle = Math.atan2(dy2, dx2);

        if (radius > 0) {
          let sweep = endAngle - startAngle;
          if (sweep < 0) sweep += Math.PI * 2;

          const segments = 32;
          const points: THREE.Vector3[] = [];
          for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const angle = startAngle + sweep * t;
            const x = center.x + Math.cos(angle) * radius;
            const y = center.y + Math.sin(angle) * radius;
            points.push(sketchTo3D(x, y));
          }
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(geometry, previewMaterial);
          previewGroup.add(line);
        }
      } else if (sketchDrawingState.center) {
        // Draw radius line from center to cursor
        const centerPos = sketchTo3D(sketchDrawingState.center.x, sketchDrawingState.center.y);
        const geometry = new THREE.BufferGeometry().setFromPoints([centerPos, cursorPos]);
        const line = new THREE.Line(geometry, previewMaterial);
        previewGroup.add(line);
      }
    }

    // Also draw start point markers for multi-click tools
    if (sketchDrawingState.type !== "idle") {
      const startMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0x69db7c });
      const startMarkerGeometry = new THREE.SphereGeometry(1, 12, 12);

      if (sketchDrawingState.type === "line" || sketchDrawingState.type === "rect") {
        const startPos = sketchTo3D(sketchDrawingState.start.x, sketchDrawingState.start.y);
        const startMarker = new THREE.Mesh(startMarkerGeometry, startMarkerMaterial);
        startMarker.position.copy(startPos);
        startMarker.userData.isMarker = true;
        const markerScale = startPos.distanceTo(camera.position) * 0.005;
        startMarker.scale.setScalar(markerScale);
        previewGroup.add(startMarker);
      } else if (sketchDrawingState.type === "circle") {
        const centerPos = sketchTo3D(sketchDrawingState.center.x, sketchDrawingState.center.y);
        const centerMarker = new THREE.Mesh(startMarkerGeometry, startMarkerMaterial);
        centerMarker.position.copy(centerPos);
        centerMarker.userData.isMarker = true;
        const markerScale = centerPos.distanceTo(camera.position) * 0.005;
        centerMarker.scale.setScalar(markerScale);
        previewGroup.add(centerMarker);
      } else if (sketchDrawingState.type === "arc" && sketchDrawingState.center) {
        const centerPos = sketchTo3D(sketchDrawingState.center.x, sketchDrawingState.center.y);
        const centerMarker = new THREE.Mesh(startMarkerGeometry, startMarkerMaterial);
        centerMarker.position.copy(centerPos);
        centerMarker.userData.isMarker = true;
        const markerScale = centerPos.distanceTo(camera.position) * 0.005;
        centerMarker.scale.setScalar(markerScale);
        previewGroup.add(centerMarker);

        if (sketchDrawingState.type === "arc" && sketchDrawingState.start) {
          const startPos = sketchTo3D(sketchDrawingState.start.x, sketchDrawingState.start.y);
          const startMarker = new THREE.Mesh(startMarkerGeometry.clone(), startMarkerMaterial);
          startMarker.position.copy(startPos);
          startMarker.userData.isMarker = true;
          const sMarkerScale = startPos.distanceTo(camera.position) * 0.005;
          startMarker.scale.setScalar(sMarkerScale);
          previewGroup.add(startMarker);
        }
      }
    }
  }, [editorMode, sketchMousePos, sketchDrawingState, activeSketchPlane]);

  // Show/hide datum planes based on editor mode
  useEffect(() => {
    if (!planeGroupRef.current) return;

    const planeGroup = planeGroupRef.current;

    // Clear existing planes
    while (planeGroup.children.length > 0) {
      const child = planeGroup.children[0];
      planeGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    // Only show planes in select-plane mode
    if (editorMode !== "select-plane") return;

    const planeSize = 60;

    // XY Plane (Blue) - at Z=0, normal is +Z
    const xyGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const xyMaterial = new THREE.MeshBasicMaterial({
      color: hoveredPlane === "datum_xy" ? 0x6699ff : 0x4477cc,
      transparent: true,
      opacity: hoveredPlane === "datum_xy" ? 0.5 : 0.3,
      side: THREE.DoubleSide,
    });
    const xyMesh = new THREE.Mesh(xyGeometry, xyMaterial);
    xyMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat on XY
    xyMesh.position.y = 0.01; // Slight offset to avoid z-fighting with grid
    xyMesh.userData = { planeId: "datum_xy", planeName: "XY Plane" };
    planeGroup.add(xyMesh);

    // XZ Plane (Green) - at Y=0, normal is +Y
    const xzGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const xzMaterial = new THREE.MeshBasicMaterial({
      color: hoveredPlane === "datum_xz" ? 0x66ff66 : 0x44aa44,
      transparent: true,
      opacity: hoveredPlane === "datum_xz" ? 0.5 : 0.3,
      side: THREE.DoubleSide,
    });
    const xzMesh = new THREE.Mesh(xzGeometry, xzMaterial);
    // XZ plane is vertical, facing +Y (rotated to stand up)
    xzMesh.position.z = 0.01;
    xzMesh.userData = { planeId: "datum_xz", planeName: "XZ Plane" };
    planeGroup.add(xzMesh);

    // YZ Plane (Red) - at X=0, normal is +X
    const yzGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const yzMaterial = new THREE.MeshBasicMaterial({
      color: hoveredPlane === "datum_yz" ? 0xff6666 : 0xcc4444,
      transparent: true,
      opacity: hoveredPlane === "datum_yz" ? 0.5 : 0.3,
      side: THREE.DoubleSide,
    });
    const yzMesh = new THREE.Mesh(yzGeometry, yzMaterial);
    yzMesh.rotation.y = Math.PI / 2; // Rotate to face +X
    yzMesh.position.x = 0.01;
    yzMesh.userData = { planeId: "datum_yz", planeName: "YZ Plane" };
    planeGroup.add(yzMesh);
  }, [editorMode, hoveredPlane]);

  // Handle mouse events for plane selection and sketch mode raycasting
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return;

    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Handle sketch mode - raycast onto sketch plane
    if (editorMode === "sketch" && activeSketchPlane) {
      // Create a Three.js plane from the sketch plane
      // Note: In our coordinate system, Y and Z are swapped for Three.js
      const planeOrigin = new THREE.Vector3(
        activeSketchPlane.origin[0],
        activeSketchPlane.origin[2], // Swap Y/Z
        activeSketchPlane.origin[1]
      );

      // Calculate plane normal from cross product of axes
      const axisX = new THREE.Vector3(
        activeSketchPlane.axisX[0],
        activeSketchPlane.axisX[2],
        activeSketchPlane.axisX[1]
      );
      const axisY = new THREE.Vector3(
        activeSketchPlane.axisY[0],
        activeSketchPlane.axisY[2],
        activeSketchPlane.axisY[1]
      );
      const normal = new THREE.Vector3().crossVectors(axisX, axisY).normalize();

      // Create Three.js Plane
      const plane = new THREE.Plane();
      plane.setFromNormalAndCoplanarPoint(normal, planeOrigin);

      // Find intersection point
      const intersectPoint = new THREE.Vector3();
      const intersected = raycaster.ray.intersectPlane(plane, intersectPoint);

      if (intersected) {
        // Convert 3D intersection to 2D sketch coordinates
        // sketchX = dot(worldPoint - origin, axisX)
        // sketchY = dot(worldPoint - origin, axisY)
        const relativePoint = intersectPoint.clone().sub(planeOrigin);
        const sketchX = relativePoint.dot(axisX);
        const sketchY = relativePoint.dot(axisY);

        // Conditionally snap to grid (10mm)
        if (gridSnappingEnabled) {
          const gridSize = 10;
          const snappedX = Math.round(sketchX / gridSize) * gridSize;
          const snappedY = Math.round(sketchY / gridSize) * gridSize;
          setSketchMousePos({ x: snappedX, y: snappedY });
        } else {
          setSketchMousePos({ x: sketchX, y: sketchY });
        }
      }
      return;
    }

    // Handle plane selection mode
    if (editorMode === "select-plane") {
      const planeGroup = planeGroupRef.current;
      if (!planeGroup) return;

      const intersects = raycaster.intersectObjects(planeGroup.children);
      if (intersects.length > 0) {
        const planeId = intersects[0].object.userData.planeId;
        if (planeId && planeId !== hoveredPlane) {
          setHoveredPlane(planeId);
        }
      } else {
        if (hoveredPlane !== null) setHoveredPlane(null);
      }
      return;
    }

    // Handle face/sketch selection mode - detect hover over sketches and body faces
    if (editorMode === "select-face") {
      const sketchGroup = sketchGroupRef.current;
      const meshGroup = meshGroupRef.current;

      // First, check for body face intersections (they're in front of sketches)
      if (meshGroup) {
        const bodyMeshes: THREE.Mesh[] = [];
        meshGroup.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.userData.isBody) {
            bodyMeshes.push(obj);
          }
        });

        const bodyIntersects = raycaster.intersectObjects(bodyMeshes, false);
        if (bodyIntersects.length > 0) {
          const hit = bodyIntersects[0];
          const opId = hit.object.userData.opId;
          const triangleIndex = hit.faceIndex ?? -1;
          const faceGroups = hit.object.userData.faceGroups;

          // Map triangle index to OCC face index
          const faceIndex = triangleToFaceIndex(triangleIndex, faceGroups);

          if (opId && faceIndex >= 0) {
            const newHover = { type: "body-face" as const, opId, faceIndex };
            if (hoveredFace?.type !== "body-face" ||
                hoveredFace.opId !== opId ||
                hoveredFace.faceIndex !== faceIndex) {
              setHoveredFace(newHover);
            }
            return;
          }
        }
      }

      // Then check for sketch intersections
      if (sketchGroup && faceSelectionTarget?.type === "extrude-profile") {
        const allSketchObjects: THREE.Object3D[] = [];
        sketchGroup.traverse((obj) => {
          if (obj.userData.isSketch || obj.parent?.userData.isSketch || obj.userData.isSketchLoop) {
            allSketchObjects.push(obj);
          }
        });

        const intersects = raycaster.intersectObjects(allSketchObjects, true);
        if (intersects.length > 0) {
          let sketchId: string | null = null;
          let loopIndex: number | undefined = undefined;
          let obj: THREE.Object3D | null = intersects[0].object;

          // Check if we hit a sketch loop mesh directly
          if (obj.userData.isSketchLoop && obj.userData.loopIndex !== undefined) {
            loopIndex = obj.userData.loopIndex;
          }

          // Walk up to find the sketch ID
          while (obj && !sketchId) {
            if (obj.userData.sketchId) {
              sketchId = obj.userData.sketchId;
            }
            obj = obj.parent;
          }

          if (sketchId) {
            const newHover = { type: "sketch" as const, sketchId, loopIndex };
            if (hoveredFace?.type !== "sketch" ||
                hoveredFace.sketchId !== sketchId ||
                hoveredFace.loopIndex !== loopIndex) {
              setHoveredFace(newHover);
            }
            return;
          }
        }
      }

      // No intersection - clear hover
      if (hoveredFace !== null) {
        setHoveredFace(null);
      }
      return;
    }

    // Clear sketch mouse pos and hovered plane/face in other modes
    if (hoveredPlane !== null) setHoveredPlane(null);
    if (hoveredFace !== null) setHoveredFace(null);
  }, [editorMode, hoveredPlane, hoveredFace, activeSketchPlane, setSketchMousePos, faceSelectionTarget, setHoveredFace]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Handle sketch mode clicks
    if (editorMode === "sketch") {
      handleSketchClick();
      return;
    }

    // Handle plane selection mode
    if (editorMode === "select-plane") {
      const container = containerRef.current;
      const camera = cameraRef.current;
      const planeGroup = planeGroupRef.current;
      if (!container || !camera || !planeGroup) return;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(planeGroup.children);
      if (intersects.length > 0) {
        const planeId = intersects[0].object.userData.planeId;
        if (planeId) {
          console.log("[Viewport] Clicked plane:", planeId);
          // Create sketch on the selected plane
          createNewSketch(planeId);
        }
      }
    }

    // Handle face/sketch selection mode - use hoveredFace for click
    if (editorMode === "select-face" && faceSelectionTarget && hoveredFace) {
      // For extrude-profile, we want to select sketch faces or body faces
      if (faceSelectionTarget.type === "extrude-profile") {
        if (hoveredFace.type === "sketch") {
          // Check if we're in revolve mode or extrude mode
          if (pendingRevolve) {
            console.log("[Viewport] Selected sketch for revolve:", hoveredFace.sketchId, "loop:", hoveredFace.loopIndex);
            setPendingRevolveSketch(hoveredFace.sketchId);
          } else {
            console.log("[Viewport] Selected sketch for extrude:", hoveredFace.sketchId, "loop:", hoveredFace.loopIndex);
            setPendingExtrudeSketch(hoveredFace.sketchId, hoveredFace.loopIndex);
          }
        } else if (hoveredFace.type === "body-face") {
          console.log("[Viewport] Selected body face for extrude:", hoveredFace.opId, "face", hoveredFace.faceIndex);
          setPendingExtrudeBodyFace({ opId: hoveredFace.opId, faceIndex: hoveredFace.faceIndex });
        }
      }
    }
  }, [editorMode, createNewSketch, handleSketchClick, faceSelectionTarget, setPendingExtrudeSketch, setPendingExtrudeBodyFace, setPendingRevolveSketch, pendingRevolve, hoveredFace]);

  // View controls
  const handleResetView = useCallback(() => {
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.set(50, 50, 50);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.position.multiplyScalar(0.8);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.position.multiplyScalar(1.25);
    }
  }, []);

  const handleViewTop = useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 80, 0);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, []);

  const handleViewFront = useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 20, 80);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, []);

  const handleViewRight = useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(80, 20, 0);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, []);

  // Determine cursor style based on mode
  const cursorStyle = React.useMemo(() => {
    if (editorMode === "select-plane") {
      return hoveredPlane ? "pointer" : "crosshair";
    }
    if (editorMode === "select-face") {
      return hoveredFace ? "pointer" : "crosshair";
    }
    return undefined;
  }, [editorMode, hoveredPlane, hoveredFace]);

  return (
    <div
      ref={containerRef}
      style={{
        ...styles.container,
        cursor: cursorStyle,
      }}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
    >
      {isOccLoading && (
        <div style={styles.loading}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>⟳</div>
          Loading OpenCascade.js...
        </div>
      )}

      {occError && (
        <div style={{ ...styles.loading, color: "#ff6b6b" }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>⚠</div>
          Failed to load kernel
          <div style={{ fontSize: 11, marginTop: 8, color: "#888" }}>
            {occError}
          </div>
        </div>
      )}

      {/* View cube */}
      <div style={styles.viewCube} onClick={handleResetView}>
        <span>ISO</span>
      </div>

      {/* View controls */}
      <div style={styles.controls}>
        <button style={styles.controlButton} onClick={handleZoomIn} title="Zoom In">
          +
        </button>
        <button style={styles.controlButton} onClick={handleZoomOut} title="Zoom Out">
          −
        </button>
        <button style={styles.controlButton} onClick={handleResetView} title="Reset View">
          ⌂
        </button>
        <div style={{ height: 8 }} />
        <button style={styles.controlButton} onClick={handleViewTop} title="Top View">
          T
        </button>
        <button style={styles.controlButton} onClick={handleViewFront} title="Front View">
          F
        </button>
        <button style={styles.controlButton} onClick={handleViewRight} title="Right View">
          R
        </button>
      </div>

      {/* Info */}
      <div style={styles.info}>
        {!isOccLoading && !occError && editorMode !== "select-plane" && (
          <>
            <div>Orbit: Left Mouse</div>
            <div>Pan: Right Mouse</div>
            <div>Zoom: Scroll</div>
          </>
        )}
      </div>


      {/* Plane selection hint */}
      {editorMode === "select-plane" && (
        <div style={{
          position: "absolute",
          bottom: 60,
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(30, 30, 60, 0.9)",
          color: "#fff",
          padding: "8px 16px",
          borderRadius: 4,
          fontSize: 12,
          pointerEvents: "none",
        }}>
          {hoveredPlane
            ? `Click to create sketch on ${hoveredPlane === "datum_xy" ? "XY" : hoveredPlane === "datum_xz" ? "XZ" : "YZ"} Plane`
            : "Click on a plane to create a new sketch"}
        </div>
      )}
    </div>
  );
}

export default Viewport;
