/**
 * Viewport - 3D viewport using Three.js for rendering CAD geometry.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useCadStore } from "../store";
import { loadOcc, getOcc } from "@vibecad/kernel";
import type { MeshData, OccApi } from "@vibecad/kernel";

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

// Grid helper with custom styling
function createGrid() {
  const gridHelper = new THREE.GridHelper(100, 100, 0x444466, 0x333355);
  gridHelper.position.y = 0;
  return gridHelper;
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

export function Viewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);

  const [isOccLoading, setIsOccLoading] = useState(true);
  const [occError, setOccError] = useState<string | null>(null);
  const [occApi, setOccApi] = useState<OccApi | null>(null);

  const studio = useCadStore((s) =>
    s.activeStudioId ? s.document.partStudios.get(s.activeStudioId) : null
  );

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
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
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

    // Grid and axes
    scene.add(createGrid());
    scene.add(createAxes());

    // Mesh group for CAD geometry
    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    // Animation loop
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
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
      // Process each operation in order
      for (const opId of studio.opOrder) {
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
              const pos = sketch.solvedPositions?.get(id) || [prim.x, prim.y];
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
  }, [occApi, studio]);

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
    <div ref={containerRef} style={styles.container}>
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
        {!isOccLoading && !occError && (
          <>
            <div>Orbit: Left Mouse</div>
            <div>Pan: Right Mouse</div>
            <div>Zoom: Scroll</div>
          </>
        )}
      </div>
    </div>
  );
}

export default Viewport;
