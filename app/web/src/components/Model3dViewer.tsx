/**
 * Model3dViewer - standalone 3D model viewer for STL, OBJ, GLTF/GLB files
 *
 * This is a STANDALONE viewer using Three.js directly.
 * It does NOT use vibeCAD's OCC kernel or CAD infrastructure.
 * It's purely for previewing external 3D model files.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Model3dDocument } from "../store/tabs-store";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    backgroundColor: "#1a1a2e",
    overflow: "hidden",
  },

  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    backgroundColor: "#1a1a2e",
    borderBottom: "1px solid #333",
    flexShrink: 0,
  },

  toolbarButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 12px",
    borderRadius: 4,
    backgroundColor: "transparent",
    border: "1px solid #333",
    color: "#888",
    fontSize: 12,
    cursor: "pointer",
    transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
    gap: 6,
  },

  toolbarButtonHover: {
    backgroundColor: "#252545",
    borderColor: "#444",
    color: "#fff",
  },

  toolbarButtonActive: {
    backgroundColor: "#646cff",
    borderColor: "#646cff",
    color: "#fff",
  },

  toolbarDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#333",
  },

  info: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  infoItem: {
    fontSize: 11,
    color: "#666",
  },

  formatBadge: {
    fontSize: 10,
    color: "#4dabf7",
    backgroundColor: "#252545",
    padding: "2px 8px",
    borderRadius: 4,
    textTransform: "uppercase" as const,
  },

  canvas: {
    flex: 1,
    width: "100%",
    outline: "none",
  },

  loadingOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 15, 26, 0.9)",
    gap: 16,
  },

  loadingSpinner: {
    width: 48,
    height: 48,
    border: "3px solid #333",
    borderTopColor: "#646cff",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },

  loadingText: {
    fontSize: 14,
    color: "#888",
  },

  errorOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 15, 26, 0.95)",
    gap: 16,
    padding: 32,
  },

  errorIcon: {
    fontSize: 48,
    opacity: 0.5,
  },

  errorText: {
    fontSize: 14,
    color: "#ff6b6b",
    textAlign: "center" as const,
  },
};

const keyframes = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// ============================================================================
// Helpers
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function dataURLtoArrayBuffer(dataURL: string): ArrayBuffer {
  const base64 = dataURL.split(",")[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function dataURLtoBlob(dataURL: string): Blob {
  const arr = dataURL.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

// ============================================================================
// Component
// ============================================================================

interface Model3dViewerProps {
  document: Model3dDocument;
}

export function Model3dViewer({ document }: Model3dViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    model: THREE.Object3D | null;
    animationId: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [vertexCount, setVertexCount] = useState(0);
  const [faceCount, setFaceCount] = useState(0);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  // Initialize Three.js scene
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      10000
    );
    camera.position.set(50, 50, 50);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 1;
    controls.maxDistance = 5000;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-50, 50, -50);
    scene.add(directionalLight2);

    // Grid helper
    const gridHelper = new THREE.GridHelper(100, 20, 0x444444, 0x333333);
    gridHelper.name = "grid";
    scene.add(gridHelper);

    // Store refs
    sceneRef.current = {
      scene,
      camera,
      renderer,
      controls,
      model: null,
      animationId: 0,
    };

    // Animation loop
    const animate = () => {
      const refs = sceneRef.current;
      if (!refs) return;

      refs.animationId = requestAnimationFrame(animate);
      refs.controls.update();
      refs.renderer.render(refs.scene, refs.camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!container || !sceneRef.current) return;
      const { camera, renderer } = sceneRef.current;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
        sceneRef.current.renderer.dispose();
        sceneRef.current.controls.dispose();
      }
    };
  }, []);

  // Load model
  useEffect(() => {
    const refs = sceneRef.current;
    if (!refs) return;

    setLoading(true);
    setError(null);

    // Remove existing model
    if (refs.model) {
      refs.scene.remove(refs.model);
      refs.model = null;
    }

    const loadModel = async () => {
      try {
        let object: THREE.Object3D;

        switch (document.format) {
          case "stl": {
            const loader = new STLLoader();
            const arrayBuffer = dataURLtoArrayBuffer(document.src);
            const geometry = loader.parse(arrayBuffer);
            const material = new THREE.MeshStandardMaterial({
              color: 0x646cff,
              metalness: 0.3,
              roughness: 0.6,
              flatShading: true,
            });
            object = new THREE.Mesh(geometry, material);
            object.castShadow = true;
            object.receiveShadow = true;
            break;
          }

          case "obj": {
            const loader = new OBJLoader();
            const blob = dataURLtoBlob(document.src);
            const text = await blob.text();
            object = loader.parse(text);
            // Apply default material to OBJ meshes
            object.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.material = new THREE.MeshStandardMaterial({
                  color: 0x646cff,
                  metalness: 0.3,
                  roughness: 0.6,
                });
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            break;
          }

          case "gltf":
          case "glb": {
            const loader = new GLTFLoader();
            const blob = dataURLtoBlob(document.src);
            const url = URL.createObjectURL(blob);
            const gltf = await new Promise<any>((resolve, reject) => {
              loader.load(url, resolve, undefined, reject);
            });
            URL.revokeObjectURL(url);
            object = gltf.scene;
            object.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            break;
          }

          default:
            throw new Error(`Unsupported format: ${document.format}`);
        }

        // Center and scale model
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 50 / maxDim;

        object.position.sub(center);
        object.scale.setScalar(scale);

        // Count vertices and faces
        let vCount = 0;
        let fCount = 0;
        object.traverse((child) => {
          if (child instanceof THREE.Mesh && child.geometry) {
            const geo = child.geometry;
            if (geo.attributes.position) {
              vCount += geo.attributes.position.count;
            }
            if (geo.index) {
              fCount += geo.index.count / 3;
            } else if (geo.attributes.position) {
              fCount += geo.attributes.position.count / 3;
            }
          }
        });
        setVertexCount(vCount);
        setFaceCount(Math.round(fCount));

        refs.scene.add(object);
        refs.model = object;

        // Fit camera to model
        refs.camera.position.set(75, 75, 75);
        refs.controls.target.set(0, 0, 0);
        refs.controls.update();

        setLoading(false);
      } catch (err) {
        console.error("Failed to load model:", err);
        setError(err instanceof Error ? err.message : "Failed to load model");
        setLoading(false);
      }
    };

    loadModel();
  }, [document.src, document.format]);

  // Toggle wireframe
  useEffect(() => {
    const refs = sceneRef.current;
    if (!refs?.model) return;

    refs.model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.wireframe = wireframe;
          }
        });
      }
    });
  }, [wireframe]);

  // Toggle grid
  useEffect(() => {
    const refs = sceneRef.current;
    if (!refs) return;

    const grid = refs.scene.getObjectByName("grid");
    if (grid) {
      grid.visible = showGrid;
    }
  }, [showGrid]);

  // Toggle auto-rotate
  useEffect(() => {
    const refs = sceneRef.current;
    if (!refs) return;
    refs.controls.autoRotate = autoRotate;
    refs.controls.autoRotateSpeed = 2;
  }, [autoRotate]);

  // Reset camera
  const resetCamera = useCallback(() => {
    const refs = sceneRef.current;
    if (!refs) return;
    refs.camera.position.set(75, 75, 75);
    refs.controls.target.set(0, 0, 0);
    refs.controls.update();
  }, []);

  // View presets
  const setView = useCallback((view: "top" | "front" | "right" | "iso") => {
    const refs = sceneRef.current;
    if (!refs) return;

    const dist = 100;
    switch (view) {
      case "top":
        refs.camera.position.set(0, dist, 0);
        break;
      case "front":
        refs.camera.position.set(0, 0, dist);
        break;
      case "right":
        refs.camera.position.set(dist, 0, 0);
        break;
      case "iso":
        refs.camera.position.set(dist * 0.7, dist * 0.7, dist * 0.7);
        break;
    }
    refs.controls.target.set(0, 0, 0);
    refs.controls.update();
  }, []);

  return (
    <div style={styles.container}>
      <style>{keyframes}</style>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "wireframe" ? styles.toolbarButtonHover : {}),
            ...(wireframe ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setWireframe(!wireframe)}
          onMouseEnter={() => setHoveredButton("wireframe")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Toggle Wireframe"
        >
          Wireframe
        </button>

        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "grid" ? styles.toolbarButtonHover : {}),
            ...(showGrid ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setShowGrid(!showGrid)}
          onMouseEnter={() => setHoveredButton("grid")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Toggle Grid"
        >
          Grid
        </button>

        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "rotate" ? styles.toolbarButtonHover : {}),
            ...(autoRotate ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setAutoRotate(!autoRotate)}
          onMouseEnter={() => setHoveredButton("rotate")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Auto Rotate"
        >
          Rotate
        </button>

        <div style={styles.toolbarDivider} />

        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "reset" ? styles.toolbarButtonHover : {}),
          }}
          onClick={resetCamera}
          onMouseEnter={() => setHoveredButton("reset")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Reset Camera"
        >
          Reset
        </button>

        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "top" ? styles.toolbarButtonHover : {}),
          }}
          onClick={() => setView("top")}
          onMouseEnter={() => setHoveredButton("top")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Top View"
        >
          Top
        </button>

        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "front" ? styles.toolbarButtonHover : {}),
          }}
          onClick={() => setView("front")}
          onMouseEnter={() => setHoveredButton("front")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Front View"
        >
          Front
        </button>

        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "iso" ? styles.toolbarButtonHover : {}),
          }}
          onClick={() => setView("iso")}
          onMouseEnter={() => setHoveredButton("iso")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Isometric View"
        >
          Iso
        </button>

        <div style={styles.info}>
          <span style={styles.formatBadge}>{document.format}</span>
          <span style={styles.infoItem}>{vertexCount.toLocaleString()} verts</span>
          <span style={styles.infoItem}>{faceCount.toLocaleString()} faces</span>
          <span style={styles.infoItem}>{formatFileSize(document.size)}</span>
        </div>
      </div>

      {/* Canvas Container */}
      <div ref={containerRef} style={{ flex: 1, position: "relative" }}>
        <canvas ref={canvasRef} style={styles.canvas} />

        {/* Loading Overlay */}
        {loading && (
          <div style={styles.loadingOverlay}>
            <div style={styles.loadingSpinner} />
            <div style={styles.loadingText}>Loading model...</div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div style={styles.errorOverlay}>
            <div style={styles.errorIcon}>⚠️</div>
            <div style={styles.errorText}>{error}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Model3dViewer;
