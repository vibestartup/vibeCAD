/**
 * Viewport - 3D viewport using Three.js for rendering CAD geometry.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useCadStore } from "../store";
import { loadOcc, getOcc } from "@vibecad/kernel";
import type { MeshData, OccApi } from "@vibecad/kernel";
import {
  sketch as sketchUtils,
  getDatumPlanes,
  DATUM_XY,
  DATUM_XZ,
  DATUM_YZ,
} from "@vibecad/core";
import type { Sketch, SketchPlane, SketchPlaneId, SketchOp, Vec2, Vec3 } from "@vibecad/core";

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
function calculateGridSpacing(cameraDistance: number): { major: number; minor: number; label: string } {
  // Target: keep major grid lines roughly 40-100 pixels apart on screen
  // At distance 100, we want spacing ~10 units
  const baseSpacing = cameraDistance / 8;

  // Snap to nice numbers: 0.1, 0.5, 1, 5, 10, 50, 100, 500, 1000...
  const niceNumbers = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  let majorSpacing = niceNumbers[0];
  for (const n of niceNumbers) {
    if (n >= baseSpacing) {
      majorSpacing = n;
      break;
    }
    majorSpacing = n;
  }

  // Minor grid is 1/5 of major
  const minorSpacing = majorSpacing / 5;

  // Format label (assuming units are mm)
  let label: string;
  if (majorSpacing < 1) {
    label = `${majorSpacing * 1000}μm`;
  } else if (majorSpacing < 10) {
    label = `${majorSpacing}mm`;
  } else if (majorSpacing < 1000) {
    label = `${majorSpacing / 10}cm`;
  } else {
    label = `${majorSpacing / 1000}m`;
  }

  return { major: majorSpacing, minor: minorSpacing, label };
}

// Format a numeric value as a label with appropriate units (value is in mm)
function formatTickLabel(value: number): string {
  const absVal = Math.abs(value);
  if (absVal === 0) return "0";

  // Format with units
  if (absVal < 1) {
    return `${(value * 1000).toFixed(0)}μm`;
  } else if (absVal < 10) {
    return `${value.toFixed(0)}mm`;
  } else if (absVal < 100) {
    return `${(value / 10).toFixed(0)}cm`;
  } else if (absVal < 1000) {
    return `${(value / 10).toFixed(0)}cm`;
  } else {
    return `${(value / 1000).toFixed(1)}m`;
  }
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
      const xLabel = createTextSprite(formatTickLabel(i), 0xcc6666);
      xLabel.position.set(i, 0.1, -labelOffset);
      xLabel.scale.set(labelSize, labelSize, 1);
      group.add(xLabel);
    }

    // Add labels along negative X axis
    if (i < 0 && i >= -halfSize * 0.8) {
      const xLabel = createTextSprite(formatTickLabel(i), 0xcc6666);
      xLabel.position.set(i, 0.1, -labelOffset);
      xLabel.scale.set(labelSize, labelSize, 1);
      group.add(xLabel);
    }

    // Add labels along positive Z axis
    if (i > 0 && i <= halfSize * 0.8) {
      const zLabel = createTextSprite(formatTickLabel(i), 0x6666cc);
      zLabel.position.set(-labelOffset, 0.1, i);
      zLabel.scale.set(labelSize, labelSize, 1);
      group.add(zLabel);
    }

    // Add labels along negative Z axis
    if (i < 0 && i >= -halfSize * 0.8) {
      const zLabel = createTextSprite(formatTickLabel(i), 0x6666cc);
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
function createMeshFromData(meshData: MeshData): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(meshData.positions, 3)
  );

  if (meshData.normals.length > 0) {
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(meshData.normals, 3)
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

// Create 3D line geometry from sketch primitives
function createSketchLines(
  sketch: Sketch,
  plane: SketchPlane,
  color: number = 0x4dabf7,
  opacity: number = 0.5
): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    linewidth: 1,
  });

  // Get point position helper
  const getPointPos = (id: string): Vec2 | undefined => {
    const solved = sketch.solvedPositions?.get(id as any);
    if (solved) return solved;
    const prim = sketch.primitives.get(id as any);
    if (prim?.type === "point") return [prim.x, prim.y];
    return undefined;
  };

  // Draw each primitive
  for (const [, prim] of sketch.primitives) {
    if (prim.type === "line") {
      const startPos = getPointPos(prim.start);
      const endPos = getPointPos(prim.end);
      if (startPos && endPos) {
        const geometry = new THREE.BufferGeometry().setFromPoints([
          sketchPointTo3D(startPos, plane),
          sketchPointTo3D(endPos, plane),
        ]);
        const line = new THREE.Line(geometry, material);
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
        const line = new THREE.Line(geometry, material);
        group.add(line);
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
        const line = new THREE.Line(geometry, material);
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
  const previewGroupRef = useRef<THREE.Group | null>(null);
  const cursorPointRef = useRef<THREE.Mesh | null>(null);

  const [isOccLoading, setIsOccLoading] = useState(true);
  const [occError, setOccError] = useState<string | null>(null);
  const [occApi, setOccApi] = useState<OccApi | null>(null);
  const [hoveredPlane, setHoveredPlane] = useState<string | null>(null);

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
    const initialSpacing = calculateGridSpacing(camera.position.length());
    const grid = createDynamicGrid(initialSpacing);
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

      // Update grid based on camera distance
      const cameraDistance = camera.position.length();
      const spacing = calculateGridSpacing(cameraDistance);

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
        const newGrid = createDynamicGrid(spacing);
        scene.add(newGrid);
        gridGroupRef.current = newGrid;
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

  // Build and render geometry from the part studio operations
  useEffect(() => {
    if (!occApi || !meshGroupRef.current || !studio) return;

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
          const sketch = studio.sketches.get(op.sketchId);
          if (!sketch) continue;

          // Build profile from sketch lines
          // Get all lines and build a polygon from them
          const lines: Array<{ start: string; end: string }> = [];
          const points: Map<string, [number, number]> = new Map();

          // Collect points and lines from sketch
          for (const [id, prim] of sketch.primitives) {
            if (prim.type === "point") {
              const solved = sketch.solvedPositions?.get(id);
              const pos: [number, number] = solved ? [solved[0], solved[1]] : [prim.x, prim.y];
              points.set(id, pos);
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
              const pos = points.get(nextLine.start);
              if (pos) orderedPoints.push([pos[0], pos[1], 0]);
              currentEnd = nextLine.end;
            } else {
              const pos = points.get(nextLine.end);
              if (pos) orderedPoints.push([pos[0], pos[1], 0]);
              currentEnd = nextLine.start;
            }
            lines.splice(lines.indexOf(nextLine), 1);
            i = -1; // restart the search
          }

          if (orderedPoints.length < 3) continue;

          // Get extrude depth
          const depth = op.depth.value;
          const direction: [number, number, number] =
            op.direction === "reverse" ? [0, 0, -1] : [0, 0, 1];

          // Create geometry using OCC
          const wire = occApi.makePolygon(orderedPoints);
          const face = occApi.makeFace(wire);
          const solid = occApi.extrude(face, direction, depth);

          // Mesh the shape
          const meshData = occApi.mesh(solid, 0.5);

          // Create Three.js mesh
          const mesh = createMeshFromData(meshData);

          // Add edges
          const edges = createEdges(mesh.geometry);

          meshGroup.add(mesh);
          meshGroup.add(edges);

          // Free OCC shapes
          occApi.freeShape(wire);
          occApi.freeShape(face);
          occApi.freeShape(solid);
        }
      }
    } catch (err) {
      console.error("Failed to create geometry:", err);
    }
  }, [occApi, studio, timelinePosition]);

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

    // Build a map of sketchId -> operation index for sketch operations
    const sketchOpIndices = new Map<string, number>();
    for (let i = 0; i < studio.opOrder.length; i++) {
      const opId = studio.opOrder[i];
      const opNode = studio.opGraph.get(opId);
      if (opNode?.op.type === "sketch") {
        const sketchOp = opNode.op as SketchOp;
        sketchOpIndices.set(sketchOp.sketchId, i);
      }
    }

    // Render each sketch that's within the timeline position
    for (const [sketchId, sketch] of studio.sketches) {
      // Check if this sketch's operation is within the timeline position
      const sketchIndex = sketchOpIndices.get(sketchId);
      if (sketchIndex === undefined || sketchIndex > maxIndex) {
        continue; // Skip sketches beyond the timeline position
      }

      // Skip if sketch has no primitives
      if (sketch.primitives.size === 0) continue;

      // Get the plane for this sketch
      const plane = getPlaneById(sketch.planeId, studio.planes);
      if (!plane) continue;

      // Create 3D lines for the sketch with transparent style
      const sketchLines = createSketchLines(sketch, plane, 0x4dabf7, 0.5);
      sketchGroup.add(sketchLines);
    }
  }, [studio, timelinePosition]);

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
        const markerScale = startPos.distanceTo(camera.position) * 0.005;
        startMarker.scale.setScalar(markerScale);
        previewGroup.add(startMarker);
      } else if (sketchDrawingState.type === "circle") {
        const centerPos = sketchTo3D(sketchDrawingState.center.x, sketchDrawingState.center.y);
        const centerMarker = new THREE.Mesh(startMarkerGeometry, startMarkerMaterial);
        centerMarker.position.copy(centerPos);
        const markerScale = centerPos.distanceTo(camera.position) * 0.005;
        centerMarker.scale.setScalar(markerScale);
        previewGroup.add(centerMarker);
      } else if (sketchDrawingState.type === "arc" && sketchDrawingState.center) {
        const centerPos = sketchTo3D(sketchDrawingState.center.x, sketchDrawingState.center.y);
        const centerMarker = new THREE.Mesh(startMarkerGeometry, startMarkerMaterial);
        centerMarker.position.copy(centerPos);
        const markerScale = centerPos.distanceTo(camera.position) * 0.005;
        centerMarker.scale.setScalar(markerScale);
        previewGroup.add(centerMarker);

        if (sketchDrawingState.type === "arc" && sketchDrawingState.start) {
          const startPos = sketchTo3D(sketchDrawingState.start.x, sketchDrawingState.start.y);
          const startMarker = new THREE.Mesh(startMarkerGeometry.clone(), startMarkerMaterial);
          startMarker.position.copy(startPos);
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

        // Snap to grid (10mm)
        const gridSize = 10;
        const snappedX = Math.round(sketchX / gridSize) * gridSize;
        const snappedY = Math.round(sketchY / gridSize) * gridSize;

        setSketchMousePos({ x: snappedX, y: snappedY });
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

    // Clear sketch mouse pos and hovered plane in other modes
    if (hoveredPlane !== null) setHoveredPlane(null);
  }, [editorMode, hoveredPlane, activeSketchPlane, setSketchMousePos]);

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
  }, [editorMode, createNewSketch, handleSketchClick]);

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

  return (
    <div
      ref={containerRef}
      style={{
        ...styles.container,
        cursor: editorMode === "select-plane" ? (hoveredPlane ? "pointer" : "crosshair") : undefined,
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
