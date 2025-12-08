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
import { ViewCube, type RenderMode } from "./ViewCube";
import {
  sketch as sketchUtils,
  getDatumPlanes,
  DATUM_XY,
  DATUM_XZ,
  DATUM_YZ,
  getPointPosition,
  getReferencedPoints,
} from "@vibecad/core";
import type { Sketch, SketchPlane, SketchPlaneId, SketchOp, Vec2, Vec3, PrimitiveId } from "@vibecad/core";
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

  // Axis lines (X = red, Y = green) - CAD convention: Z-up, XY ground plane
  const xAxisMaterial = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 });
  const yAxisMaterial = new THREE.LineBasicMaterial({ color: 0x44ff44, linewidth: 2 });

  const xAxisGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-halfSize, 0.01, 0),
    new THREE.Vector3(halfSize, 0.01, 0),
  ]);
  const yAxisGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.01, -halfSize),
    new THREE.Vector3(0, 0.01, halfSize),
  ]);

  group.add(new THREE.Line(xAxisGeom, xAxisMaterial));
  group.add(new THREE.Line(yAxisGeom, yAxisMaterial));

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

    // Ticks on Y axis (perpendicular to Y, in X direction) - CAD Y is Three.js Z
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

    // Add labels along positive Y axis (CAD Y is Three.js Z)
    if (i > 0 && i <= halfSize * 0.8) {
      const yLabel = createTextSprite(formatTickLabel(i, unit), 0x66cc66);
      yLabel.position.set(-labelOffset, 0.1, i);
      yLabel.scale.set(labelSize, labelSize, 1);
      group.add(yLabel);
    }

    // Add labels along negative Y axis (CAD Y is Three.js Z)
    if (i < 0 && i >= -halfSize * 0.8) {
      const yLabel = createTextSprite(formatTickLabel(i, unit), 0x66cc66);
      yLabel.position.set(-labelOffset, 0.1, i);
      yLabel.scale.set(labelSize, labelSize, 1);
      group.add(yLabel);
    }
  }

  // Add axis name labels
  const xNameLabel = createTextSprite("X", 0xff4444);
  xNameLabel.position.set(halfSize * 0.95, 0.1, -labelOffset * 2);
  xNameLabel.scale.set(labelSize * 1.5, labelSize * 1.5, 1);
  group.add(xNameLabel);

  const yNameLabel = createTextSprite("Y", 0x44ff44);
  yNameLabel.position.set(-labelOffset * 2, 0.1, halfSize * 0.95);
  yNameLabel.scale.set(labelSize * 1.5, labelSize * 1.5, 1);
  group.add(yNameLabel);

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

// Axes helper - CAD convention: X(red), Y(green), Z(blue) with Z-up
// Three.js uses Y-up internally, so we swap: CAD Y -> Three.js Z, CAD Z -> Three.js Y
function createAxes() {
  const group = new THREE.Group();
  const axisLength = 50;

  // X axis (red) - same in both conventions
  const xGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(axisLength, 0, 0),
  ]);
  const xMat = new THREE.LineBasicMaterial({ color: 0xff4444 });
  group.add(new THREE.Line(xGeom, xMat));

  // Y axis (green) - CAD Y is Three.js Z (horizontal)
  const yGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, axisLength),
  ]);
  const yMat = new THREE.LineBasicMaterial({ color: 0x44ff44 });
  group.add(new THREE.Line(yGeom, yMat));

  // Z axis (blue) - CAD Z is Three.js Y (vertical/up)
  const zGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, axisLength, 0),
  ]);
  const zMat = new THREE.LineBasicMaterial({ color: 0x4444ff });
  group.add(new THREE.Line(zGeom, zMat));

  return group;
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

interface ViewportProps {
  /** Offset for ViewCube from top */
  viewCubeTopOffset?: number;
  /** Offset for ViewCube from right */
  viewCubeRightOffset?: number;
}

export function Viewport({ viewCubeTopOffset = 16, viewCubeRightOffset = 16 }: ViewportProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const perspCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const sketchGroupRef = useRef<THREE.Group | null>(null);
  const planeGroupRef = useRef<THREE.Group | null>(null);
  const gridGroupRef = useRef<THREE.Group | null>(null);
  const axesHelperRef = useRef<THREE.Group | null>(null);
  const lastGridSpacingRef = useRef<number>(0);
  const lastUnitRef = useRef<LengthUnit>("mm");
  const previewGroupRef = useRef<THREE.Group | null>(null);
  const cursorPointRef = useRef<THREE.Mesh | null>(null);
  const faceHighlightRef = useRef<THREE.Mesh | null>(null);
  const selectionHighlightGroupRef = useRef<THREE.Group | null>(null);
  const extrudePreviewRef = useRef<THREE.Group | null>(null);
  const sketchGizmoGroupRef = useRef<THREE.Group | null>(null);
  const sketchEntityGroupRef = useRef<THREE.Group | null>(null); // Separate group for selectable sketch entities

  const [isOccLoading, setIsOccLoading] = useState(true);
  const [occError, setOccError] = useState<string | null>(null);
  const [occApi, setOccApi] = useState<OccApi | null>(null);
  const [hoveredPlane, setHoveredPlane] = useState<string | null>(null);
  const [isOrthographic, setIsOrthographic] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [renderMode, setRenderMode] = useState<RenderMode>("solid");

  // Get settings
  const lengthUnit = useSettingsStore((s) => s.lengthUnit);
  const showSketchCursor = useSettingsStore((s) => s.showSketchCursor);

  const studio = useCadStore((s) => s.studio);
  const timelinePosition = useCadStore((s) => s.timelinePosition);
  const editorMode = useCadStore((s) => s.editorMode);
  const objectSelection = useCadStore((s) => s.objectSelection);
  const setObjectSelection = useCadStore((s) => s.setObjectSelection);
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
  const selectFace = useCadStore((s) => s.selectFace);
  const setExportMeshes = useCadStore((s) => s.setExportMeshes);
  const setExportShapeHandles = useCadStore((s) => s.setExportShapeHandles);

  // Sketch selection state
  const sketchSelection = useCadStore((s) => s.sketchSelection);
  const hoveredSketchEntity = useCadStore((s) => s.hoveredSketchEntity);
  const setHoveredSketchEntity = useCadStore((s) => s.setHoveredSketchEntity);
  const toggleSketchEntitySelected = useCadStore((s) => s.toggleSketchEntitySelected);
  const setSketchSelection = useCadStore((s) => s.setSketchSelection);
  const clearSketchSelection = useCadStore((s) => s.clearSketchSelection);
  const sketchGizmoState = useCadStore((s) => s.sketchGizmoState);
  const startSketchGizmoDrag = useCadStore((s) => s.startSketchGizmoDrag);
  const updateSketchGizmoDrag = useCadStore((s) => s.updateSketchGizmoDrag);
  const endSketchGizmoDrag = useCadStore((s) => s.endSketchGizmoDrag);
  const getMaterializedSelectionPoints = useCadStore((s) => s.getMaterializedSelectionPoints);
  const activeTool = useCadStore((s) => s.activeTool);

  // Clipboard actions
  const deleteSketchSelection = useCadStore((s) => s.deleteSketchSelection);
  const copySketchSelection = useCadStore((s) => s.copySketchSelection);
  const cutSketchSelection = useCadStore((s) => s.cutSketchSelection);
  const pasteSketchClipboard = useCadStore((s) => s.pasteSketchClipboard);
  const duplicateSketchSelection = useCadStore((s) => s.duplicateSketchSelection);
  const selectAllSketchEntities = useCadStore((s) => s.selectAllSketchEntities);
  const cancelSketchDrawing = useCadStore((s) => s.cancelSketchDrawing);

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

    // Cameras - create both perspective and orthographic
    const perspCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50000);
    perspCamera.position.set(200, 200, 200);
    perspCamera.lookAt(0, 0, 0);
    perspCameraRef.current = perspCamera;

    // Orthographic camera with frustum based on initial view
    const frustumSize = 400;
    const aspect = width / height;
    const orthoCamera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      50000
    );
    orthoCamera.position.set(200, 200, 200);
    orthoCamera.lookAt(0, 0, 0);
    orthoCameraRef.current = orthoCamera;

    // Start with perspective camera
    cameraRef.current = perspCamera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true, // Required for canvas capture/toDataURL
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(perspCamera, renderer.domElement);
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
    const initialSpacing = calculateGridSpacing(perspCamera.position.length(), initialUnit);
    const grid = createDynamicGrid(initialSpacing, initialUnit);
    scene.add(grid);
    gridGroupRef.current = grid;
    lastGridSpacingRef.current = initialSpacing.major;

    // Axes helper
    const axesHelper = createAxes();
    scene.add(axesHelper);
    axesHelperRef.current = axesHelper;

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

    // Sketch entity group for selectable sketch primitives (separate from sketchGroup for hit testing)
    const sketchEntityGroup = new THREE.Group();
    scene.add(sketchEntityGroup);
    sketchEntityGroupRef.current = sketchEntityGroup;

    // Sketch gizmo group for transform gizmo
    const sketchGizmoGroup = new THREE.Group();
    scene.add(sketchGizmoGroup);
    sketchGizmoGroupRef.current = sketchGizmoGroup;

    // Cursor point (constant screen size, semi-transparent)
    const cursorGeometry = new THREE.SphereGeometry(1, 16, 16);
    const cursorMaterial = new THREE.MeshBasicMaterial({
      color: 0x69db7c,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    });
    const cursorPoint = new THREE.Mesh(cursorGeometry, cursorMaterial);
    cursorPoint.visible = false;
    cursorPoint.renderOrder = 999;
    scene.add(cursorPoint);
    cursorPointRef.current = cursorPoint;

    // Animation loop
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();

      const activeCamera = cameraRef.current;
      if (!activeCamera) return;

      // Update grid based on camera distance and current unit
      const cameraDistance = activeCamera.position.length();
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
        const distToCamera = cursorPointRef.current.position.distanceTo(activeCamera.position);
        const scale = distToCamera * 0.006;
        cursorPointRef.current.scale.setScalar(scale);
      }

      // Update preview group marker scales for constant screen size
      if (previewGroupRef.current) {
        previewGroupRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.isMarker) {
            const distToCamera = child.position.distanceTo(activeCamera.position);
            const scale = distToCamera * 0.005;
            child.scale.setScalar(scale);
          }
        });
      }

      renderer.render(scene, activeCamera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const aspect = width / height;

      // Update perspective camera
      if (perspCameraRef.current) {
        perspCameraRef.current.aspect = aspect;
        perspCameraRef.current.updateProjectionMatrix();
      }

      // Update orthographic camera - maintain frustum height, adjust width
      if (orthoCameraRef.current) {
        const frustumHeight = orthoCameraRef.current.top - orthoCameraRef.current.bottom;
        orthoCameraRef.current.left = -frustumHeight * aspect / 2;
        orthoCameraRef.current.right = frustumHeight * aspect / 2;
        orthoCameraRef.current.updateProjectionMatrix();
      }

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

  // Handle keyboard shortcuts for sketch mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts in sketch mode
      if (editorMode !== "sketch") return;

      // Escape to cancel drawing or clear selection
      if (e.key === "Escape") {
        if (sketchDrawingState.type !== "idle") {
          cancelSketchDrawing();
        } else if (sketchSelection.size > 0) {
          clearSketchSelection();
        }
        return;
      }

      // Delete or Backspace to delete selection
      if ((e.key === "Delete" || e.key === "Backspace") && sketchSelection.size > 0) {
        e.preventDefault();
        deleteSketchSelection();
        return;
      }

      // Command/Ctrl key shortcuts
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      switch (e.key.toLowerCase()) {
        case "c":
          // Copy
          if (sketchSelection.size > 0) {
            e.preventDefault();
            copySketchSelection();
          }
          break;
        case "x":
          // Cut
          if (sketchSelection.size > 0) {
            e.preventDefault();
            cutSketchSelection();
          }
          break;
        case "v":
          // Paste
          e.preventDefault();
          pasteSketchClipboard();
          break;
        case "d":
          // Duplicate
          if (sketchSelection.size > 0) {
            e.preventDefault();
            duplicateSketchSelection();
          }
          break;
        case "a":
          // Select all
          e.preventDefault();
          selectAllSketchEntities();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    editorMode,
    sketchDrawingState,
    sketchSelection,
    cancelSketchDrawing,
    clearSketchSelection,
    deleteSketchSelection,
    copySketchSelection,
    cutSketchSelection,
    pasteSketchClipboard,
    duplicateSketchSelection,
    selectAllSketchEntities,
  ]);

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
          console.log("[Extrude] Processing extrude op:", op.name, op);

          // Only render extrusions from sketch profiles in the 3D view
          if (op.profile.type !== "sketch") {
            console.log("[Extrude] Skipping - profile type is not sketch:", op.profile.type);
            continue;
          }

          const extrudeSketchId = op.profile.sketchId;
          const sketch = studio.sketches.get(extrudeSketchId);
          if (!sketch) {
            console.log("[Extrude] Skipping - sketch not found:", extrudeSketchId);
            continue;
          }
          console.log("[Extrude] Found sketch:", sketch.name, "primitives:", sketch.primitives.size);

          // Check if the source sketch operation is suppressed
          const sketchOpNode = Array.from(studio.opGraph.values()).find(
            (node) => node.op.type === "sketch" && (node.op as SketchOp).sketchId === extrudeSketchId
          );
          if (sketchOpNode?.op.suppressed) continue;

          // Get the plane for this sketch
          const plane = getPlaneById(sketch.planeId, studio.planes);
          if (!plane) continue;

          // Calculate plane normal for extrude direction: cross(axisX, axisY)
          const nx = plane.axisX[1] * plane.axisY[2] - plane.axisX[2] * plane.axisY[1];
          const ny = plane.axisX[2] * plane.axisY[0] - plane.axisX[0] * plane.axisY[2];
          const nz = plane.axisX[0] * plane.axisY[1] - plane.axisX[1] * plane.axisY[0];
          const planeNormal: [number, number, number] = [nx, ny, nz];

          // Get extrude depth and direction
          const depth = op.depth.value;
          const direction: [number, number, number] =
            op.direction === "reverse" ? [-nx, -ny, -nz] : [nx, ny, nz];

          // Helper to get point position in 2D
          const getPos2D = (pointId: PrimitiveId): Vec2 | null => {
            const pos = getPointPosition(sketch, pointId);
            return pos || null;
          };

          // Helper to transform 2D to 3D world coordinates
          const toWorld = (pos2d: Vec2): Vec3 => {
            return sketchUtils.sketchToWorld(pos2d, plane);
          };

          // Build wires for each extrudable shape
          const wires: number[] = [];
          const wiresCreated: number[] = [];

          // Log all primitives
          console.log("[Extrude] Primitives in sketch:");
          for (const [primId, prim] of sketch.primitives) {
            console.log(`  - ${primId}: ${prim.type}`, prim);
          }

          // First, handle rect primitives directly (they're not detected by loop detection)
          for (const [primId, prim] of sketch.primitives) {
            if (prim.type === "rect" && !prim.construction) {
              console.log("[Extrude] Found rect primitive:", primId);
              const c1 = getPos2D(prim.corner1);
              const c2 = getPos2D(prim.corner2);
              console.log("[Extrude] Rect corners:", c1, c2);
              if (!c1 || !c2) continue;

              // Create 4 corners of the rectangle
              const corners: Vec3[] = [
                toWorld([c1[0], c1[1]]),
                toWorld([c2[0], c1[1]]),
                toWorld([c2[0], c2[1]]),
                toWorld([c1[0], c2[1]]),
              ];
              console.log("[Extrude] Rect world corners:", corners);

              try {
                const wire = occApi.makePolygon(corners);
                console.log("[Extrude] Created rect wire:", wire);
                wires.push(wire);
                wiresCreated.push(wire);
              } catch (err) {
                console.error("[Extrude] Failed to create rect wire:", err);
              }
            }
          }

          // Next, handle circles directly
          for (const [primId, prim] of sketch.primitives) {
            if (prim.type === "circle" && !prim.construction) {
              console.log("[Extrude] Found circle primitive:", primId);
              const centerPos = getPos2D(prim.center);
              console.log("[Extrude] Circle center:", centerPos);
              if (!centerPos) continue;

              const centerWorld = toWorld(centerPos);
              console.log("[Extrude] Circle world center:", centerWorld, "radius:", prim.radius);
              try {
                const wire = occApi.makeCircleWire(centerWorld, planeNormal, prim.radius);
                console.log("[Extrude] Created circle wire:", wire);
                wires.push(wire);
                wiresCreated.push(wire);
              } catch (err) {
                console.error("[Extrude] Failed to create circle wire:", err);
              }
            }
          }

          // Use loop detection for edges (lines, arcs)
          const loops = sketchUtils.findClosedLoops(sketch);
          console.log("[Extrude] Found loops:", loops.length, loops);

          // Filter to only loops that are made of edges (not circles, which we already handled)
          for (const loop of loops) {
            // Skip if this is a circle loop (already handled above)
            if (loop.primitiveIds.length === 1) {
              const prim = sketch.primitives.get(loop.primitiveIds[0]);
              if (prim?.type === "circle") continue;
            }

            // For loops made of multiple edges (lines, arcs)
            const edges: number[] = [];

            for (const primId of loop.primitiveIds) {
              const prim = sketch.primitives.get(primId);
              if (!prim) continue;

              if (prim.type === "line") {
                const startPos = getPos2D(prim.start);
                const endPos = getPos2D(prim.end);
                if (!startPos || !endPos) continue;

                const startWorld = toWorld(startPos);
                const endWorld = toWorld(endPos);
                const edge = occApi.makeLineEdge(startWorld, endWorld);
                edges.push(edge);
              } else if (prim.type === "arc") {
                const centerPos = getPos2D(prim.center);
                const startPos = getPos2D(prim.start);
                const endPos = getPos2D(prim.end);
                if (!centerPos || !startPos || !endPos) continue;

                const centerWorld = toWorld(centerPos);
                const startWorld = toWorld(startPos);
                const endWorld = toWorld(endPos);
                const edge = occApi.makeArcEdge(centerWorld, startWorld, endWorld, planeNormal);
                edges.push(edge);
              }
            }

            if (edges.length === 0) {
              // Fallback: if we have point IDs, create polygon from points
              if (loop.pointIds.length >= 3) {
                const worldPoints: Vec3[] = [];
                for (const pointId of loop.pointIds) {
                  const pos2d = getPos2D(pointId);
                  if (pos2d) {
                    worldPoints.push(toWorld(pos2d));
                  }
                }
                if (worldPoints.length >= 3) {
                  const wire = occApi.makePolygon(worldPoints);
                  wires.push(wire);
                  wiresCreated.push(wire);
                }
              }
            } else {
              // Create wire from edges
              const wire = occApi.makeWire(edges);
              wires.push(wire);
              wiresCreated.push(wire);
              // Free individual edges
              for (const edge of edges) {
                occApi.freeShape(edge);
              }
            }
          }

          console.log("[Extrude] Total wires created:", wires.length);
          if (wires.length === 0) {
            console.log("[Extrude] No wires - skipping extrude");
            continue;
          }

          // Create faces from wires and extrude
          // For now, extrude each loop separately and fuse them
          let resultSolid: number | null = null;
          const shapesToFree: number[] = [];

          for (const wire of wires) {
            try {
              const face = occApi.makeFace(wire);
              shapesToFree.push(face);

              const solid = occApi.extrude(face, direction, depth);

              if (resultSolid === null) {
                resultSolid = solid;
              } else {
                // Fuse multiple solids together
                const fused: number = occApi.fuse(resultSolid, solid);
                shapesToFree.push(resultSolid);
                shapesToFree.push(solid);
                resultSolid = fused;
              }
            } catch (err) {
              console.error("Failed to extrude loop:", err);
            }
          }

          // Free wires
          for (const wire of wiresCreated) {
            occApi.freeShape(wire);
          }
          // Free intermediate shapes (but not the final solid)
          for (const shape of shapesToFree) {
            occApi.freeShape(shape);
          }

          if (resultSolid === null) continue;

          // Mesh the shape
          const meshData = occApi.mesh(resultSolid, 0.5);

          // Store mesh data for export
          exportableMeshes.push({
            positions: new Float32Array(meshData.positions),
            normals: new Float32Array(meshData.normals),
            indices: new Uint32Array(meshData.indices),
            name: op.name,
          });

          // Store shape handle for STEP export (don't free solid - kept for export)
          exportableShapeHandles.push(resultSolid);

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
        }

        // Handle primitive solid operations
        else if (op.type === "box") {
          console.log("[Box] Processing box op:", op.name, op);
          try {
            const solid = occApi.makeBox(op.center, op.dimensions);

            // Mesh the shape
            const meshData = occApi.mesh(solid, 0.5);

            // Store mesh data for export
            exportableMeshes.push({
              positions: new Float32Array(meshData.positions),
              normals: new Float32Array(meshData.normals),
              indices: new Uint32Array(meshData.indices),
              name: op.name,
            });

            // Store shape handle for STEP export
            exportableShapeHandles.push(solid);

            // Create Three.js mesh
            const mesh = createMeshFromData(meshData);
            mesh.userData.opId = opId;
            mesh.userData.opType = op.type;
            mesh.userData.isBody = true;
            mesh.userData.faceGroups = meshData.faceGroups;

            // Add edges
            const edges = createEdges(mesh.geometry);
            edges.userData.opId = opId;

            meshGroup.add(mesh);
            meshGroup.add(edges);
          } catch (err) {
            console.error("[Box] Failed to create box:", err);
          }
        }

        else if (op.type === "cylinder") {
          console.log("[Cylinder] Processing cylinder op:", op.name, op);
          try {
            const solid = occApi.makeCylinder(op.center, op.axis, op.radius.value, op.height.value);

            // Mesh the shape
            const meshData = occApi.mesh(solid, 0.5);

            // Store mesh data for export
            exportableMeshes.push({
              positions: new Float32Array(meshData.positions),
              normals: new Float32Array(meshData.normals),
              indices: new Uint32Array(meshData.indices),
              name: op.name,
            });

            // Store shape handle for STEP export
            exportableShapeHandles.push(solid);

            // Create Three.js mesh
            const mesh = createMeshFromData(meshData);
            mesh.userData.opId = opId;
            mesh.userData.opType = op.type;
            mesh.userData.isBody = true;
            mesh.userData.faceGroups = meshData.faceGroups;

            // Add edges
            const edges = createEdges(mesh.geometry);
            edges.userData.opId = opId;

            meshGroup.add(mesh);
            meshGroup.add(edges);
          } catch (err) {
            console.error("[Cylinder] Failed to create cylinder:", err);
          }
        }

        else if (op.type === "sphere") {
          console.log("[Sphere] Processing sphere op:", op.name, op);
          try {
            const solid = occApi.makeSphere(op.center, op.radius.value);

            // Mesh the shape
            const meshData = occApi.mesh(solid, 0.5);

            // Store mesh data for export
            exportableMeshes.push({
              positions: new Float32Array(meshData.positions),
              normals: new Float32Array(meshData.normals),
              indices: new Uint32Array(meshData.indices),
              name: op.name,
            });

            // Store shape handle for STEP export
            exportableShapeHandles.push(solid);

            // Create Three.js mesh
            const mesh = createMeshFromData(meshData);
            mesh.userData.opId = opId;
            mesh.userData.opType = op.type;
            mesh.userData.isBody = true;
            mesh.userData.faceGroups = meshData.faceGroups;

            // Add edges
            const edges = createEdges(mesh.geometry);
            edges.userData.opId = opId;

            meshGroup.add(mesh);
            meshGroup.add(edges);
          } catch (err) {
            console.error("[Sphere] Failed to create sphere:", err);
          }
        }

        else if (op.type === "cone") {
          console.log("[Cone] Processing cone op:", op.name, op);
          try {
            const solid = occApi.makeCone(op.center, op.axis, op.radius1.value, op.radius2.value, op.height.value);

            // Mesh the shape
            const meshData = occApi.mesh(solid, 0.5);

            // Store mesh data for export
            exportableMeshes.push({
              positions: new Float32Array(meshData.positions),
              normals: new Float32Array(meshData.normals),
              indices: new Uint32Array(meshData.indices),
              name: op.name,
            });

            // Store shape handle for STEP export
            exportableShapeHandles.push(solid);

            // Create Three.js mesh
            const mesh = createMeshFromData(meshData);
            mesh.userData.opId = opId;
            mesh.userData.opType = op.type;
            mesh.userData.isBody = true;
            mesh.userData.faceGroups = meshData.faceGroups;

            // Add edges
            const edges = createEdges(mesh.geometry);
            edges.userData.opId = opId;

            meshGroup.add(mesh);
            meshGroup.add(edges);
          } catch (err) {
            console.error("[Cone] Failed to create cone:", err);
          }
        }

        // Handle transform operations
        else if (op.type === "transform") {
          console.log("[Transform] Processing transform op:", op.name, op);
          // Transform operations need to find their target solid first
          // For now, we need to rebuild the target shape and then apply the transform
          // This is a simplified approach - ideally we'd cache intermediate results
          // Skip for now - transform will be applied to the already-rendered geometry
          console.log("[Transform] Transform operations pending proper implementation");
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

  // Render selectable sketch entities in sketch mode (for hit testing)
  useEffect(() => {
    const entityGroup = sketchEntityGroupRef.current;
    if (!entityGroup) return;

    // Clear existing
    while (entityGroup.children.length > 0) {
      const child = entityGroup.children[0];
      entityGroup.remove(child);
      if (child instanceof THREE.Line || child instanceof THREE.Mesh || child instanceof THREE.Points) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          (child.material as THREE.Material).dispose();
        }
      }
    }

    // Only render in sketch mode with active sketch
    if (editorMode !== "sketch" || !activeSketch || !activeSketchPlane) return;

    const sketch = activeSketch;
    const plane = activeSketchPlane;

    // Helper to convert sketch 2D to Three.js 3D
    const sketchTo3D = (x: number, y: number): THREE.Vector3 => {
      const world = sketchUtils.sketchToWorld([x, y], plane);
      return new THREE.Vector3(world[0], world[2], world[1]); // Swap Y/Z
    };

    const getPos = (id: PrimitiveId): [number, number] | null => {
      const solved = sketch.solvedPositions?.get(id);
      if (solved) return [solved[0], solved[1]];
      const prim = sketch.primitives.get(id);
      if (prim?.type === "point") return [prim.x, prim.y];
      return null;
    };

    // Render each primitive as a selectable entity
    for (const [primId, prim] of sketch.primitives) {
      const isSelected = sketchSelection.has(primId);
      const isHovered = hoveredSketchEntity === primId;

      // Determine colors based on state
      const normalColor = 0x4dabf7;
      const selectedColor = 0xffd43b;
      const hoverColor = 0x69db7c;
      const color = isSelected ? selectedColor : (isHovered ? hoverColor : normalColor);

      if (prim.type === "point") {
        // Render point as a sphere
        const pos = getPos(primId);
        if (!pos) continue;

        const geo = new THREE.SphereGeometry(2, 12, 12);
        const mat = new THREE.MeshBasicMaterial({ color, depthTest: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(sketchTo3D(pos[0], pos[1]));
        mesh.userData.primitiveId = primId;
        mesh.userData.primitiveType = "point";
        mesh.renderOrder = 1000;
        entityGroup.add(mesh);
      } else if (prim.type === "line") {
        // Render line
        const startPos = getPos(prim.start);
        const endPos = getPos(prim.end);
        if (!startPos || !endPos) continue;

        const geo = new THREE.BufferGeometry().setFromPoints([
          sketchTo3D(startPos[0], startPos[1]),
          sketchTo3D(endPos[0], endPos[1]),
        ]);
        const mat = new THREE.LineBasicMaterial({ color, linewidth: 2, depthTest: false });
        const line = new THREE.Line(geo, mat);
        line.userData.primitiveId = primId;
        line.userData.primitiveType = "line";
        line.renderOrder = 999;
        entityGroup.add(line);
      } else if (prim.type === "circle") {
        // Render circle
        const centerPos = getPos(prim.center);
        if (!centerPos) continue;

        const segments = 64;
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const x = centerPos[0] + Math.cos(angle) * prim.radius;
          const y = centerPos[1] + Math.sin(angle) * prim.radius;
          points.push(sketchTo3D(x, y));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color, linewidth: 2, depthTest: false });
        const line = new THREE.Line(geo, mat);
        line.userData.primitiveId = primId;
        line.userData.primitiveType = "circle";
        line.renderOrder = 999;
        entityGroup.add(line);
      } else if (prim.type === "arc") {
        // Render arc
        const centerPos = getPos(prim.center);
        const startPos = getPos(prim.start);
        const endPos = getPos(prim.end);
        if (!centerPos || !startPos || !endPos) continue;

        const dx1 = startPos[0] - centerPos[0];
        const dy1 = startPos[1] - centerPos[1];
        const radius = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const startAngle = Math.atan2(dy1, dx1);
        const dx2 = endPos[0] - centerPos[0];
        const dy2 = endPos[1] - centerPos[1];
        const endAngle = Math.atan2(dy2, dx2);

        let sweep = endAngle - startAngle;
        if (prim.clockwise) {
          if (sweep > 0) sweep -= Math.PI * 2;
        } else {
          if (sweep < 0) sweep += Math.PI * 2;
        }

        const segments = 32;
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const angle = startAngle + sweep * t;
          const x = centerPos[0] + Math.cos(angle) * radius;
          const y = centerPos[1] + Math.sin(angle) * radius;
          points.push(sketchTo3D(x, y));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color, linewidth: 2, depthTest: false });
        const line = new THREE.Line(geo, mat);
        line.userData.primitiveId = primId;
        line.userData.primitiveType = "arc";
        line.renderOrder = 999;
        entityGroup.add(line);
      }
    }
  }, [editorMode, activeSketch, activeSketchPlane, sketchSelection, hoveredSketchEntity]);

  // Render sketch transform gizmo
  useEffect(() => {
    const gizmoGroup = sketchGizmoGroupRef.current;
    if (!gizmoGroup) return;

    // Clear existing
    while (gizmoGroup.children.length > 0) {
      const child = gizmoGroup.children[0];
      gizmoGroup.remove(child);
      if (child instanceof THREE.Line || child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          (child.material as THREE.Material).dispose();
        }
      }
    }

    // Only show gizmo when there's a selection in sketch mode with select tool
    if (editorMode !== "sketch" || activeTool !== "select" || sketchSelection.size === 0) return;
    if (!activeSketch || !activeSketchPlane) return;

    const sketch = activeSketch;
    const plane = activeSketchPlane;

    // Calculate centroid of selection
    const pointIds = getMaterializedSelectionPoints();
    if (pointIds.length === 0) return;

    let cx = 0, cy = 0;
    for (const pointId of pointIds) {
      const solved = sketch.solvedPositions?.get(pointId);
      if (solved) {
        cx += solved[0];
        cy += solved[1];
      } else {
        const prim = sketch.primitives.get(pointId);
        if (prim?.type === "point") {
          cx += prim.x;
          cy += prim.y;
        }
      }
    }
    cx /= pointIds.length;
    cy /= pointIds.length;

    // Helper to convert sketch 2D to Three.js 3D
    const sketchTo3D = (x: number, y: number): THREE.Vector3 => {
      const world = sketchUtils.sketchToWorld([x, y], plane);
      return new THREE.Vector3(world[0], world[2], world[1]); // Swap Y/Z
    };

    const gizmoSize = 30; // Size in sketch units (mm)
    const centerPos = sketchTo3D(cx, cy);

    // X axis arrow (red)
    const xEndPos = sketchTo3D(cx + gizmoSize, cy);
    const xGeo = new THREE.BufferGeometry().setFromPoints([centerPos, xEndPos]);
    const xMat = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 3, depthTest: false });
    const xLine = new THREE.Line(xGeo, xMat);
    xLine.userData.gizmoHandle = "translate-x";
    xLine.renderOrder = 2000;
    gizmoGroup.add(xLine);

    // X arrow head
    const xHeadGeo = new THREE.ConeGeometry(2, 6, 8);
    const xHeadMat = new THREE.MeshBasicMaterial({ color: 0xff4444, depthTest: false });
    const xHead = new THREE.Mesh(xHeadGeo, xHeadMat);
    xHead.position.copy(xEndPos);
    // Rotate to point along X axis in sketch plane
    const xDir = new THREE.Vector3().subVectors(xEndPos, centerPos).normalize();
    xHead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), xDir);
    xHead.userData.gizmoHandle = "translate-x";
    xHead.renderOrder = 2000;
    gizmoGroup.add(xHead);

    // Y axis arrow (green)
    const yEndPos = sketchTo3D(cx, cy + gizmoSize);
    const yGeo = new THREE.BufferGeometry().setFromPoints([centerPos, yEndPos]);
    const yMat = new THREE.LineBasicMaterial({ color: 0x44ff44, linewidth: 3, depthTest: false });
    const yLine = new THREE.Line(yGeo, yMat);
    yLine.userData.gizmoHandle = "translate-y";
    yLine.renderOrder = 2000;
    gizmoGroup.add(yLine);

    // Y arrow head
    const yHeadGeo = new THREE.ConeGeometry(2, 6, 8);
    const yHeadMat = new THREE.MeshBasicMaterial({ color: 0x44ff44, depthTest: false });
    const yHead = new THREE.Mesh(yHeadGeo, yHeadMat);
    yHead.position.copy(yEndPos);
    const yDir = new THREE.Vector3().subVectors(yEndPos, centerPos).normalize();
    yHead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), yDir);
    yHead.userData.gizmoHandle = "translate-y";
    yHead.renderOrder = 2000;
    gizmoGroup.add(yHead);

    // Center square for free translate (XY)
    const squareSize = 6;
    const s1 = sketchTo3D(cx - squareSize/2, cy - squareSize/2);
    const s2 = sketchTo3D(cx + squareSize/2, cy - squareSize/2);
    const s3 = sketchTo3D(cx + squareSize/2, cy + squareSize/2);
    const s4 = sketchTo3D(cx - squareSize/2, cy + squareSize/2);

    const squareGeo = new THREE.BufferGeometry();
    const squareVerts = new Float32Array([
      s1.x, s1.y, s1.z,
      s2.x, s2.y, s2.z,
      s3.x, s3.y, s3.z,
      s1.x, s1.y, s1.z,
      s3.x, s3.y, s3.z,
      s4.x, s4.y, s4.z,
    ]);
    squareGeo.setAttribute("position", new THREE.BufferAttribute(squareVerts, 3));
    const squareMat = new THREE.MeshBasicMaterial({
      color: 0xffff44,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    });
    const squareMesh = new THREE.Mesh(squareGeo, squareMat);
    squareMesh.userData.gizmoHandle = "translate-xy";
    squareMesh.renderOrder = 2000;
    gizmoGroup.add(squareMesh);

    // Rotation ring (blue)
    const ringRadius = gizmoSize * 0.8;
    const ringSegments = 48;
    const ringPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= ringSegments; i++) {
      const angle = (i / ringSegments) * Math.PI * 2;
      const x = cx + Math.cos(angle) * ringRadius;
      const y = cy + Math.sin(angle) * ringRadius;
      ringPoints.push(sketchTo3D(x, y));
    }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
    const ringMat = new THREE.LineBasicMaterial({ color: 0x4444ff, linewidth: 2, depthTest: false });
    const ringLine = new THREE.Line(ringGeo, ringMat);
    ringLine.userData.gizmoHandle = "rotate";
    ringLine.renderOrder = 2000;
    gizmoGroup.add(ringLine);

  }, [editorMode, activeTool, activeSketch, activeSketchPlane, sketchSelection, getMaterializedSelectionPoints]);

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

  // Render object selection highlight (highlight all faces of selected objects)
  useEffect(() => {
    const scene = sceneRef.current;
    const meshGroup = meshGroupRef.current;

    // Clean up existing selection highlight group
    if (selectionHighlightGroupRef.current) {
      selectionHighlightGroupRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
      scene?.remove(selectionHighlightGroupRef.current);
      selectionHighlightGroupRef.current = null;
    }

    if (!meshGroup || !scene || objectSelection.size === 0) return;

    // Create a group for all selection highlights
    const selectionGroup = new THREE.Group();
    selectionGroup.name = "selection-highlight";

    // Find all body meshes
    const bodyMeshes: THREE.Mesh[] = [];
    meshGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.isBody) {
        bodyMeshes.push(obj);
      }
    });

    // Highlight material (blue tint for selection)
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0x4dabf7,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
    });

    // For each selected object, highlight all its faces
    objectSelection.forEach((opId) => {
      const targetMesh = bodyMeshes.find((m) => m.userData.opId === opId);
      if (!targetMesh) return;

      const geometry = targetMesh.geometry as THREE.BufferGeometry;
      const position = geometry.getAttribute("position");
      const index = geometry.getIndex();

      if (!position) return;

      // Clone the entire geometry for the highlight (all faces)
      const highlightGeo = new THREE.BufferGeometry();
      const vertices: number[] = [];

      if (index) {
        // Indexed geometry: extract all triangles
        for (let i = 0; i < index.count; i += 3) {
          const i0 = index.getX(i);
          const i1 = index.getX(i + 1);
          const i2 = index.getX(i + 2);
          vertices.push(
            position.getX(i0), position.getY(i0), position.getZ(i0),
            position.getX(i1), position.getY(i1), position.getZ(i1),
            position.getX(i2), position.getY(i2), position.getZ(i2)
          );
        }
      } else {
        // Non-indexed geometry: copy all vertices
        for (let i = 0; i < position.count; i++) {
          vertices.push(position.getX(i), position.getY(i), position.getZ(i));
        }
      }

      highlightGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));

      const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat.clone());
      // Copy transform from target mesh
      highlightMesh.position.copy(targetMesh.position);
      highlightMesh.rotation.copy(targetMesh.rotation);
      highlightMesh.scale.copy(targetMesh.scale);
      highlightMesh.renderOrder = 998;

      selectionGroup.add(highlightMesh);
    });

    if (selectionGroup.children.length > 0) {
      scene.add(selectionGroup);
      selectionHighlightGroupRef.current = selectionGroup;
    }
  }, [objectSelection, studio]); // Re-run when selection or studio changes

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
      // Calculate plane normal for extrude direction: cross(axisX, axisY)
      const nx = plane.axisX[1] * plane.axisY[2] - plane.axisX[2] * plane.axisY[1];
      const ny = plane.axisX[2] * plane.axisY[0] - plane.axisX[0] * plane.axisY[2];
      const nz = plane.axisX[0] * plane.axisY[1] - plane.axisX[1] * plane.axisY[0];
      const planeNormal: [number, number, number] = [nx, ny, nz];

      // Get depth from pending extrude
      const depth = pendingExtrude.depth || 10;
      const direction: [number, number, number] =
        pendingExtrude.direction === "reverse" ? [-nx, -ny, -nz] : [nx, ny, nz];

      // Helper to get point position in 2D
      const getPos2D = (pointId: PrimitiveId): Vec2 | null => {
        const pos = getPointPosition(sketch, pointId);
        return pos || null;
      };

      // Helper to transform 2D to 3D world coordinates
      const toWorld = (pos2d: Vec2): Vec3 => {
        return sketchUtils.sketchToWorld(pos2d, plane);
      };

      // Build wires for each extrudable shape
      const wires: number[] = [];
      const wiresCreated: number[] = [];

      // First, handle rect primitives directly (they're not detected by loop detection)
      for (const [primId, prim] of sketch.primitives) {
        if (prim.type === "rect" && !prim.construction) {
          const c1 = getPos2D(prim.corner1);
          const c2 = getPos2D(prim.corner2);
          if (!c1 || !c2) continue;

          // Create 4 corners of the rectangle
          const corners: Vec3[] = [
            toWorld([c1[0], c1[1]]),
            toWorld([c2[0], c1[1]]),
            toWorld([c2[0], c2[1]]),
            toWorld([c1[0], c2[1]]),
          ];

          const wire = occApi.makePolygon(corners);
          wires.push(wire);
          wiresCreated.push(wire);
        }
      }

      // Next, handle circles directly
      for (const [primId, prim] of sketch.primitives) {
        if (prim.type === "circle" && !prim.construction) {
          const centerPos = getPos2D(prim.center);
          if (!centerPos) continue;

          const centerWorld = toWorld(centerPos);
          const wire = occApi.makeCircleWire(centerWorld, planeNormal, prim.radius);
          wires.push(wire);
          wiresCreated.push(wire);
        }
      }

      // Use loop detection for edges (lines, arcs)
      const loops = sketchUtils.findClosedLoops(sketch);

      // Filter to only loops that are made of edges (not circles, which we already handled)
      for (const loop of loops) {
        // Skip if this is a circle loop (already handled above)
        if (loop.primitiveIds.length === 1) {
          const prim = sketch.primitives.get(loop.primitiveIds[0]);
          if (prim?.type === "circle") continue;
        }

        // For loops made of multiple edges (lines, arcs)
        const edges: number[] = [];

        for (const primId of loop.primitiveIds) {
          const prim = sketch.primitives.get(primId);
          if (!prim) continue;

          if (prim.type === "line") {
            const startPos = getPos2D(prim.start);
            const endPos = getPos2D(prim.end);
            if (!startPos || !endPos) continue;

            const startWorld = toWorld(startPos);
            const endWorld = toWorld(endPos);
            const edge = occApi.makeLineEdge(startWorld, endWorld);
            edges.push(edge);
          } else if (prim.type === "arc") {
            const centerPos = getPos2D(prim.center);
            const startPos = getPos2D(prim.start);
            const endPos = getPos2D(prim.end);
            if (!centerPos || !startPos || !endPos) continue;

            const centerWorld = toWorld(centerPos);
            const startWorld = toWorld(startPos);
            const endWorld = toWorld(endPos);
            const edge = occApi.makeArcEdge(centerWorld, startWorld, endWorld, planeNormal);
            edges.push(edge);
          }
        }

        if (edges.length === 0) {
          // Fallback: if we have point IDs, create polygon from points
          if (loop.pointIds.length >= 3) {
            const worldPoints: Vec3[] = [];
            for (const pointId of loop.pointIds) {
              const pos2d = getPos2D(pointId);
              if (pos2d) {
                worldPoints.push(toWorld(pos2d));
              }
            }
            if (worldPoints.length >= 3) {
              const wire = occApi.makePolygon(worldPoints);
              wires.push(wire);
              wiresCreated.push(wire);
            }
          }
        } else {
          // Create wire from edges
          const wire = occApi.makeWire(edges);
          wires.push(wire);
          wiresCreated.push(wire);
          // Free individual edges
          for (const edge of edges) {
            occApi.freeShape(edge);
          }
        }
      }

      if (wires.length === 0) return;

      // Create faces from wires and extrude
      let resultSolid: number | null = null;
      const shapesToFree: number[] = [];

      for (const wire of wires) {
        const face = occApi.makeFace(wire);
        shapesToFree.push(face);

        const solid = occApi.extrude(face, direction, depth);

        if (resultSolid === null) {
          resultSolid = solid;
        } else {
          const fused: number = occApi.fuse(resultSolid, solid);
          shapesToFree.push(resultSolid);
          shapesToFree.push(solid);
          resultSolid = fused;
        }
      }

      // Free wires
      for (const wire of wiresCreated) {
        occApi.freeShape(wire);
      }
      // Free intermediate shapes
      for (const shape of shapesToFree) {
        occApi.freeShape(shape);
      }

      if (resultSolid === null) return;

      const meshData = occApi.mesh(resultSolid, 0.5);

      // Free the solid after meshing
      occApi.freeShape(resultSolid);

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

    // Hide cursor and exit if not in sketch mode or no mouse/plane
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

    // Update cursor position (but only show if setting enabled)
    const cursorPos = sketchTo3D(sketchMousePos.x, sketchMousePos.y);
    cursorPoint.position.copy(cursorPos);
    cursorPoint.visible = showSketchCursor; // Only show cursor dot if setting is enabled

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
  }, [editorMode, sketchMousePos, sketchDrawingState, activeSketchPlane, showSketchCursor]);

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

    // Show planes in select-plane mode AND select-face mode (unified plane/face selection)
    if (editorMode !== "select-plane" && editorMode !== "select-face") return;

    // Determine which plane is hovered (from hoveredPlane OR hoveredFace.type === "datum-plane")
    const activeHoveredPlane = hoveredPlane || (hoveredFace?.type === "datum-plane" ? hoveredFace.planeId : null);

    const planeSize = 60;

    // XY Plane (Blue) - at Z=0, normal is +Z
    const xyGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const xyMaterial = new THREE.MeshBasicMaterial({
      color: activeHoveredPlane === "datum_xy" ? 0x6699ff : 0x4477cc,
      transparent: true,
      opacity: activeHoveredPlane === "datum_xy" ? 0.5 : 0.3,
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
      color: activeHoveredPlane === "datum_xz" ? 0x66ff66 : 0x44aa44,
      transparent: true,
      opacity: activeHoveredPlane === "datum_xz" ? 0.5 : 0.3,
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
      color: activeHoveredPlane === "datum_yz" ? 0xff6666 : 0xcc4444,
      transparent: true,
      opacity: activeHoveredPlane === "datum_yz" ? 0.5 : 0.3,
      side: THREE.DoubleSide,
    });
    const yzMesh = new THREE.Mesh(yzGeometry, yzMaterial);
    yzMesh.rotation.y = Math.PI / 2; // Rotate to face +X
    yzMesh.position.x = 0.01;
    yzMesh.userData = { planeId: "datum_yz", planeName: "YZ Plane" };
    planeGroup.add(yzMesh);
  }, [editorMode, hoveredPlane, hoveredFace]);

  // Update mesh materials based on render mode
  useEffect(() => {
    if (!meshGroupRef.current) return;

    meshGroupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        const mat = child.material;
        switch (renderMode) {
          case "wireframe":
            mat.wireframe = true;
            mat.metalness = 0.1;
            mat.roughness = 0.9;
            break;
          case "material":
            mat.wireframe = false;
            mat.metalness = 0.5;
            mat.roughness = 0.3;
            break;
          case "solid":
          default:
            mat.wireframe = false;
            mat.metalness = 0.3;
            mat.roughness = 0.6;
            break;
        }
        mat.needsUpdate = true;
      }
    });
  }, [renderMode]);

  // Disable orbit controls while dragging sketch gizmo
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (sketchGizmoState.mode !== "idle") {
      controls.enabled = false;
    } else {
      controls.enabled = true;
    }
  }, [sketchGizmoState.mode]);

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

    // Handle sketch mode - raycast onto sketch plane + entity hit testing
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

        // Conditionally snap to grid (10mm) - but only for drawing, not for selection
        const isDrawingTool = ["line", "rect", "circle", "arc"].includes(activeTool);
        if (gridSnappingEnabled && isDrawingTool) {
          const gridSize = 10;
          const snappedX = Math.round(sketchX / gridSize) * gridSize;
          const snappedY = Math.round(sketchY / gridSize) * gridSize;
          setSketchMousePos({ x: snappedX, y: snappedY });
        } else {
          setSketchMousePos({ x: sketchX, y: sketchY });
        }

        // Handle gizmo dragging
        if (sketchGizmoState.mode !== "idle") {
          updateSketchGizmoDrag({ x: sketchX, y: sketchY });
          return;
        }

        // If in select mode, check for entity hits
        if (activeTool === "select" && activeSketch) {
          // Check for gizmo hits first
          const gizmoGroup = sketchGizmoGroupRef.current;
          if (gizmoGroup && gizmoGroup.children.length > 0) {
            raycaster.params.Line = { threshold: 5 }; // Increase line threshold for gizmo
            const gizmoIntersects = raycaster.intersectObjects(gizmoGroup.children, true);
            if (gizmoIntersects.length > 0) {
              // Hovering over gizmo - don't change entity hover
              return;
            }
          }

          // Check for entity hits
          const entityGroup = sketchEntityGroupRef.current;
          if (entityGroup) {
            raycaster.params.Line = { threshold: 5 }; // Increase threshold for easier selection
            raycaster.params.Points = { threshold: 8 };
            const intersects = raycaster.intersectObjects(entityGroup.children, true);

            if (intersects.length > 0) {
              // Find the closest hit with a primitiveId
              for (const hit of intersects) {
                let obj: THREE.Object3D | null = hit.object;
                while (obj) {
                  if (obj.userData.primitiveId) {
                    const primId = obj.userData.primitiveId as PrimitiveId;
                    if (primId !== hoveredSketchEntity) {
                      setHoveredSketchEntity(primId);
                    }
                    return;
                  }
                  obj = obj.parent;
                }
              }
            }
          }

          // No hit - clear hover
          if (hoveredSketchEntity !== null) {
            setHoveredSketchEntity(null);
          }
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

    // Handle face/sketch selection mode - detect hover over sketches, body faces, and datum planes
    if (editorMode === "select-face") {
      const sketchGroup = sketchGroupRef.current;
      const meshGroup = meshGroupRef.current;
      const planeGroup = planeGroupRef.current;

      // First, check for body face intersections (they're in front of everything)
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

      // Then check for sketch intersections (only for extrude-profile target)
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

      // Finally, check for datum plane intersections (for edit-sketch-plane and sketch-plane targets)
      if (planeGroup && (faceSelectionTarget?.type === "edit-sketch-plane" || faceSelectionTarget?.type === "sketch-plane")) {
        const planeIntersects = raycaster.intersectObjects(planeGroup.children);
        if (planeIntersects.length > 0) {
          const planeId = planeIntersects[0].object.userData.planeId;
          if (planeId) {
            const newHover = { type: "datum-plane" as const, planeId };
            if (hoveredFace?.type !== "datum-plane" || hoveredFace.planeId !== planeId) {
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
  }, [editorMode, hoveredPlane, hoveredFace, activeSketchPlane, setSketchMousePos, faceSelectionTarget, setHoveredFace, activeTool, activeSketch, hoveredSketchEntity, setHoveredSketchEntity, sketchGizmoState, updateSketchGizmoDrag, gridSnappingEnabled]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Handle sketch mode clicks
    if (editorMode === "sketch") {
      // If currently dragging gizmo, don't process click (mouseUp handles it)
      if (sketchGizmoState.mode !== "idle") {
        return;
      }

      // If in select mode with select tool, handle entity selection
      if (activeTool === "select") {
        // If we have a hovered entity, toggle its selection
        if (hoveredSketchEntity) {
          if (e.ctrlKey || e.metaKey) {
            // Toggle selection
            toggleSketchEntitySelected(hoveredSketchEntity);
          } else {
            // Replace selection
            setSketchSelection(new Set([hoveredSketchEntity]));
          }
          return;
        }

        // Clicked on empty space - clear selection (unless holding ctrl/cmd)
        if (!e.ctrlKey && !e.metaKey) {
          clearSketchSelection();
        }
        return;
      }

      // Otherwise, use the drawing tools
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

      // For edit-sketch-plane, we want to select datum planes
      if (faceSelectionTarget.type === "edit-sketch-plane" && hoveredFace.type === "datum-plane") {
        console.log("[Viewport] Selected datum plane for sketch:", hoveredFace.planeId);
        selectFace({ type: "datum-plane", planeId: hoveredFace.planeId });
      }
    }

    // Handle object selection in "object" mode
    if (editorMode === "object") {
      const container = containerRef.current;
      const camera = cameraRef.current;
      const meshGroup = meshGroupRef.current;
      if (!container || !camera || !meshGroup) return;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // Find all body meshes
      const bodyMeshes: THREE.Mesh[] = [];
      meshGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.userData.isBody) {
          bodyMeshes.push(obj);
        }
      });

      const intersects = raycaster.intersectObjects(bodyMeshes);
      if (intersects.length > 0) {
        const opId = intersects[0].object.userData.opId;
        if (opId) {
          // Ctrl/Cmd click to add to selection, otherwise replace
          if (e.ctrlKey || e.metaKey) {
            const newSelection = new Set(objectSelection);
            if (newSelection.has(opId)) {
              newSelection.delete(opId);
            } else {
              newSelection.add(opId);
            }
            setObjectSelection(newSelection);
          } else {
            setObjectSelection(new Set([opId]));
          }
        }
      } else {
        // Clicked on empty space - clear selection (unless holding ctrl/cmd)
        if (!e.ctrlKey && !e.metaKey) {
          setObjectSelection(new Set());
        }
      }
    }
  }, [editorMode, createNewSketch, handleSketchClick, faceSelectionTarget, setPendingExtrudeSketch, setPendingExtrudeBodyFace, setPendingRevolveSketch, pendingRevolve, hoveredFace, selectFace, objectSelection, setObjectSelection, activeTool, hoveredSketchEntity, toggleSketchEntitySelected, setSketchSelection, clearSketchSelection, sketchGizmoState.mode]);

  // Handle mouse up - for ending gizmo drags
  const handleMouseUp = useCallback(() => {
    if (sketchGizmoState.mode !== "idle") {
      endSketchGizmoDrag();
    }
  }, [sketchGizmoState.mode, endSketchGizmoDrag]);

  // Handle mouse down - for starting gizmo drags
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle in sketch mode with select tool
    if (editorMode !== "sketch" || activeTool !== "select") return;

    const container = containerRef.current;
    const camera = cameraRef.current;
    const gizmoGroup = sketchGizmoGroupRef.current;

    if (!container || !camera || !gizmoGroup || !sketchMousePos || !activeSketchPlane) return;
    if (gizmoGroup.children.length === 0) return;

    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    raycaster.params.Line = { threshold: 5 };

    const gizmoIntersects = raycaster.intersectObjects(gizmoGroup.children, true);
    if (gizmoIntersects.length > 0) {
      // Find gizmo handle type
      for (const hit of gizmoIntersects) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.userData.gizmoHandle) {
            const handleType = obj.userData.gizmoHandle as string;
            if (handleType === "translate-x") {
              startSketchGizmoDrag("translate-x", sketchMousePos);
            } else if (handleType === "translate-y") {
              startSketchGizmoDrag("translate-y", sketchMousePos);
            } else if (handleType === "translate-xy") {
              startSketchGizmoDrag("translate-xy", sketchMousePos);
            } else if (handleType === "rotate") {
              startSketchGizmoDrag("rotate", sketchMousePos);
            }
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          obj = obj.parent;
        }
      }
    }
  }, [editorMode, activeTool, sketchMousePos, activeSketchPlane, startSketchGizmoDrag]);

  // View controls
  const handleResetView = useCallback(() => {
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.set(200, 200, 200);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    if (cameraRef.current) {
      if (cameraRef.current instanceof THREE.OrthographicCamera) {
        // For ortho, shrink frustum to zoom in
        cameraRef.current.left *= 0.8;
        cameraRef.current.right *= 0.8;
        cameraRef.current.top *= 0.8;
        cameraRef.current.bottom *= 0.8;
        cameraRef.current.updateProjectionMatrix();
      } else {
        cameraRef.current.position.multiplyScalar(0.8);
      }
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (cameraRef.current) {
      if (cameraRef.current instanceof THREE.OrthographicCamera) {
        // For ortho, expand frustum to zoom out
        cameraRef.current.left *= 1.25;
        cameraRef.current.right *= 1.25;
        cameraRef.current.top *= 1.25;
        cameraRef.current.bottom *= 1.25;
        cameraRef.current.updateProjectionMatrix();
      } else {
        cameraRef.current.position.multiplyScalar(1.25);
      }
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

  // Toggle between perspective and orthographic camera
  const handleToggleProjection = useCallback(() => {
    if (!controlsRef.current || !rendererRef.current || !containerRef.current) return;
    const perspCamera = perspCameraRef.current;
    const orthoCamera = orthoCameraRef.current;
    if (!perspCamera || !orthoCamera) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const aspect = width / height;
    const target = controlsRef.current.target.clone();

    if (isOrthographic) {
      // Switch to perspective
      // Copy position and orientation from ortho camera
      perspCamera.position.copy(orthoCamera.position);
      perspCamera.quaternion.copy(orthoCamera.quaternion);
      perspCamera.up.copy(orthoCamera.up);

      cameraRef.current = perspCamera;
      controlsRef.current.object = perspCamera;
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
      setIsOrthographic(false);
    } else {
      // Switch to orthographic
      // Calculate frustum size based on distance to target
      const distance = perspCamera.position.distanceTo(target);
      const fov = perspCamera.fov * (Math.PI / 180);
      const frustumHeight = 2 * distance * Math.tan(fov / 2);

      orthoCamera.left = -frustumHeight * aspect / 2;
      orthoCamera.right = frustumHeight * aspect / 2;
      orthoCamera.top = frustumHeight / 2;
      orthoCamera.bottom = -frustumHeight / 2;
      orthoCamera.updateProjectionMatrix();

      // Copy position and orientation from perspective camera
      orthoCamera.position.copy(perspCamera.position);
      orthoCamera.quaternion.copy(perspCamera.quaternion);
      orthoCamera.up.copy(perspCamera.up);

      cameraRef.current = orthoCamera;
      controlsRef.current.object = orthoCamera;
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
      setIsOrthographic(true);
    }
  }, [isOrthographic]);

  // Toggle grid visibility
  const handleToggleGrid = useCallback(() => {
    setShowGrid((prev) => {
      const next = !prev;
      if (gridGroupRef.current) {
        gridGroupRef.current.visible = next;
      }
      return next;
    });
  }, []);

  // Toggle axes visibility
  const handleToggleAxes = useCallback(() => {
    setShowAxes((prev) => {
      const next = !prev;
      if (axesHelperRef.current) {
        axesHelperRef.current.visible = next;
      }
      return next;
    });
  }, []);

  // Set render mode
  const handleSetRenderMode = useCallback((mode: RenderMode) => {
    setRenderMode(mode);
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
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onMouseUp={handleMouseUp}
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
      <ViewCube
        cameraRef={cameraRef}
        controlsRef={controlsRef}
        size={100}
        topOffset={viewCubeTopOffset}
        rightOffset={viewCubeRightOffset}
        isOrthographic={isOrthographic}
        onToggleProjection={handleToggleProjection}
        showGrid={showGrid}
        onToggleGrid={handleToggleGrid}
        showAxes={showAxes}
        onToggleAxes={handleToggleAxes}
        renderMode={renderMode}
        onSetRenderMode={handleSetRenderMode}
      />

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

      {/* Face/plane selection hint for edit-sketch-plane */}
      {editorMode === "select-face" && faceSelectionTarget?.type === "edit-sketch-plane" && (
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
          {hoveredFace?.type === "datum-plane"
            ? `Click to move sketch to ${hoveredFace.planeId === "datum_xy" ? "XY" : hoveredFace.planeId === "datum_xz" ? "XZ" : "YZ"} Plane`
            : "Click on a plane to change the sketch plane"}
        </div>
      )}
    </div>
  );
}

export default Viewport;
