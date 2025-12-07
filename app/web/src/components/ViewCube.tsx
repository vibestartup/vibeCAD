/**
 * ViewCube - Interactive 3D navigation cube for camera control
 *
 * Features:
 * - Click faces for standard views (Front, Back, Left, Right, Top, Bottom)
 * - Click edges for edge views (Top-Front, Left-Back, etc.)
 * - Click corners for isometric corner views
 * - Drag to rotate the main viewport camera
 * - Hover/click highlighting for user feedback
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";

// View directions for faces, edges, and corners
// Camera position vectors for each view (normalized, will be scaled by distance)
const FACE_VIEWS: Record<string, { position: THREE.Vector3; up: THREE.Vector3; label: string }> = {
  front: { position: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0), label: "FRONT" },
  back: { position: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0), label: "BACK" },
  right: { position: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0), label: "RIGHT" },
  left: { position: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0), label: "LEFT" },
  top: { position: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, -1), label: "TOP" },
  bottom: { position: new THREE.Vector3(0, -1, 0), up: new THREE.Vector3(0, 0, 1), label: "BOTTOM" },
};

const EDGE_VIEWS: Record<string, { position: THREE.Vector3; up: THREE.Vector3 }> = {
  // Horizontal edges (top)
  "top-front": { position: new THREE.Vector3(0, 1, 1).normalize(), up: new THREE.Vector3(0, 1, 0) },
  "top-back": { position: new THREE.Vector3(0, 1, -1).normalize(), up: new THREE.Vector3(0, 1, 0) },
  "top-right": { position: new THREE.Vector3(1, 1, 0).normalize(), up: new THREE.Vector3(0, 1, 0) },
  "top-left": { position: new THREE.Vector3(-1, 1, 0).normalize(), up: new THREE.Vector3(0, 1, 0) },
  // Horizontal edges (bottom)
  "bottom-front": { position: new THREE.Vector3(0, -1, 1).normalize(), up: new THREE.Vector3(0, 1, 0) },
  "bottom-back": { position: new THREE.Vector3(0, -1, -1).normalize(), up: new THREE.Vector3(0, 1, 0) },
  "bottom-right": { position: new THREE.Vector3(1, -1, 0).normalize(), up: new THREE.Vector3(0, 1, 0) },
  "bottom-left": { position: new THREE.Vector3(-1, -1, 0).normalize(), up: new THREE.Vector3(0, 1, 0) },
  // Vertical edges
  "front-right": { position: new THREE.Vector3(1, 0, 1).normalize(), up: new THREE.Vector3(0, 1, 0) },
  "front-left": { position: new THREE.Vector3(-1, 0, 1).normalize(), up: new THREE.Vector3(0, 1, 0) },
  "back-right": { position: new THREE.Vector3(1, 0, -1).normalize(), up: new THREE.Vector3(0, 1, 0) },
  "back-left": { position: new THREE.Vector3(-1, 0, -1).normalize(), up: new THREE.Vector3(0, 1, 0) },
};

const CORNER_VIEWS: Record<string, { position: THREE.Vector3; up: THREE.Vector3 }> = {
  "top-front-right": { position: new THREE.Vector3(1, 1, 1).normalize(), up: new THREE.Vector3(0, 1, 0) },
  "top-front-left": { position: new THREE.Vector3(-1, 1, 1).normalize(), up: new THREE.Vector3(0, 1, 0) },
  "top-back-right": { position: new THREE.Vector3(1, 1, -1).normalize(), up: new THREE.Vector3(0, 1, 0) },
  "top-back-left": { position: new THREE.Vector3(-1, 1, -1).normalize(), up: new THREE.Vector3(0, 1, 0) },
  "bottom-front-right": { position: new THREE.Vector3(1, -1, 1).normalize(), up: new THREE.Vector3(0, 1, 0) },
  "bottom-front-left": { position: new THREE.Vector3(-1, -1, 1).normalize(), up: new THREE.Vector3(0, 1, 0) },
  "bottom-back-right": { position: new THREE.Vector3(1, -1, -1).normalize(), up: new THREE.Vector3(0, 1, 0) },
  "bottom-back-left": { position: new THREE.Vector3(-1, -1, -1).normalize(), up: new THREE.Vector3(0, 1, 0) },
};

export type RenderMode = "solid" | "wireframe" | "material";

interface ViewCubeProps {
  /** Ref to the main camera to sync orientation */
  cameraRef: React.RefObject<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>;
  /** Ref to the orbit controls to set camera position */
  controlsRef: React.RefObject<{ target: THREE.Vector3; update: () => void } | null>;
  /** Size of the view cube in pixels */
  size?: number;
  /** Offset from top edge */
  topOffset?: number;
  /** Offset from right edge */
  rightOffset?: number;
  /** Whether currently in orthographic mode */
  isOrthographic?: boolean;
  /** Toggle perspective/orthographic projection */
  onToggleProjection?: () => void;
  /** Whether grid is visible */
  showGrid?: boolean;
  /** Toggle grid visibility */
  onToggleGrid?: () => void;
  /** Whether axes are visible */
  showAxes?: boolean;
  /** Toggle axes visibility */
  onToggleAxes?: () => void;
  /** Current render mode */
  renderMode?: RenderMode;
  /** Set render mode */
  onSetRenderMode?: (mode: RenderMode) => void;
}

// SVG Icons
const IconPerspective = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    {/* 3D cube with perspective - back face smaller */}
    {/* Front face */}
    <rect x="1" y="5" width="8" height="8" fill="none" />
    {/* Back face (smaller, offset up-right) */}
    <rect x="5" y="1" width="6" height="6" fill="none" />
    {/* Connecting edges */}
    <line x1="1" y1="5" x2="5" y2="1" />
    <line x1="9" y1="5" x2="11" y2="1" />
    <line x1="9" y1="13" x2="11" y2="7" />
  </svg>
);

const IconOrthographic = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    {/* Isometric cube - parallel edges, no perspective */}
    {/* Front face */}
    <path d="M1 10L1 4L7 1L7 7Z" fill="none" />
    {/* Right face */}
    <path d="M7 7L7 1L13 4L13 10Z" fill="none" />
    {/* Top face */}
    <path d="M1 4L7 1L13 4L7 7Z" fill="none" />
    {/* Bottom edge */}
    <line x1="1" y1="10" x2="7" y2="13" />
    <line x1="7" y1="13" x2="13" y2="10" />
  </svg>
);

const IconGrid = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round">
    {/* 3x3 grid */}
    <line x1="1" y1="5" x2="13" y2="5" />
    <line x1="1" y1="9" x2="13" y2="9" />
    <line x1="5" y1="1" x2="5" y2="13" />
    <line x1="9" y1="1" x2="9" y2="13" />
  </svg>
);

const IconAxes = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {/* XYZ axes from origin */}
    {/* X axis - right */}
    <line x1="4" y1="10" x2="12" y2="10" />
    <polyline points="10,8 12,10 10,12" />
    {/* Y axis - up */}
    <line x1="4" y1="10" x2="4" y2="2" />
    <polyline points="2,4 4,2 6,4" />
    {/* Z axis - diagonal toward viewer */}
    <line x1="4" y1="10" x2="1" y2="13" />
  </svg>
);

const IconRenderMode = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    {/* Shaded sphere representing render/shading mode */}
    <defs>
      <linearGradient id="sphereGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={color} stopOpacity="0.9" />
        <stop offset="100%" stopColor={color} stopOpacity="0.2" />
      </linearGradient>
    </defs>
    <circle cx="7" cy="7" r="5.5" fill="url(#sphereGrad)" stroke={color} strokeWidth="1" />
    {/* Highlight */}
    <circle cx="5" cy="5" r="1.5" fill={color} fillOpacity="0.4" />
  </svg>
);

// Render mode menu icons
const IconSolid = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    {/* Solid filled cube */}
    <path d="M7 1L12 4V10L7 13L2 10V4L7 1Z" fill={color} fillOpacity="0.6" stroke={color} strokeWidth="1" strokeLinejoin="round" />
    <path d="M7 1L7 13" stroke={color} strokeWidth="0.75" strokeOpacity="0.5" />
    <path d="M2 4L7 7L12 4" stroke={color} strokeWidth="0.75" strokeOpacity="0.5" />
  </svg>
);

const IconWireframe = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1" strokeLinejoin="round">
    {/* Wireframe cube - just edges */}
    <path d="M7 1L12 4V10L7 13L2 10V4L7 1Z" />
    <line x1="7" y1="7" x2="7" y2="13" />
    <line x1="2" y1="4" x2="7" y2="7" />
    <line x1="12" y1="4" x2="7" y2="7" />
  </svg>
);

const IconMaterial = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    {/* Material/PBR sphere with reflection */}
    <defs>
      <radialGradient id="matGrad" cx="35%" cy="35%" r="60%">
        <stop offset="0%" stopColor={color} stopOpacity="1" />
        <stop offset="50%" stopColor={color} stopOpacity="0.6" />
        <stop offset="100%" stopColor={color} stopOpacity="0.2" />
      </radialGradient>
    </defs>
    <circle cx="7" cy="7" r="5.5" fill="url(#matGrad)" stroke={color} strokeWidth="1" />
    {/* Specular highlight */}
    <ellipse cx="5" cy="5" rx="2" ry="1.5" fill="white" fillOpacity="0.5" />
    {/* Reflection line */}
    <path d="M4 10Q7 9 10 10" stroke={color} strokeWidth="0.5" strokeOpacity="0.4" fill="none" />
  </svg>
);

// Colors
const CUBE_COLOR = 0x2a2a4a;
const CUBE_HOVER_COLOR = 0x4a4a7a;
const CUBE_ACTIVE_COLOR = 0x646cff;
const EDGE_COLOR = 0x3a3a5a;
const EDGE_HOVER_COLOR = 0x5a5aaa;
const CORNER_COLOR = 0x4a4a6a;
const CORNER_HOVER_COLOR = 0x6a6abb;
const TEXT_COLOR = 0xaaaacc;

export function ViewCube({
  cameraRef,
  controlsRef,
  size = 100,
  topOffset = 16,
  rightOffset = 16,
  isOrthographic = false,
  onToggleProjection,
  showGrid = true,
  onToggleGrid,
  showAxes = true,
  onToggleAxes,
  renderMode = "solid",
  onSetRenderMode,
}: ViewCubeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cubeGroupRef = useRef<THREE.Group | null>(null);
  const localCameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);

  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [activeElement, setActiveElement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [renderMenuOpen, setRenderMenuOpen] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; cameraPos: THREE.Vector3 } | null>(null);

  // Create text texture for face labels
  const createTextTexture = useCallback((text: string, bgColor: number, isHovered: boolean, isActive: boolean) => {
    const canvas = document.createElement("canvas");
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Background with rounded corners
    const radius = 8;
    ctx.fillStyle = isActive ? "#646cff" : isHovered ? "#4a4a7a" : `#${bgColor.toString(16).padStart(6, "0")}`;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, radius);
    ctx.fill();

    // Border
    ctx.strokeStyle = isActive ? "#8888ff" : isHovered ? "#6666aa" : "#3a3a5a";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isActive ? "#ffffff" : isHovered ? "#ffffff" : "#aaaacc";
    ctx.fillText(text, size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  // Create a beveled box geometry with separate face, edge, and corner meshes
  const createBeveledCube = useCallback((hovered: string | null, active: string | null) => {
    const group = new THREE.Group();
    const cubeSize = 1;
    const bevelSize = 0.12;
    const faceSize = cubeSize - bevelSize * 2;
    const faceOffset = cubeSize / 2;
    // Position edges at midpoint between face plane and face edge extent for tight fit
    const edgeCenterOffset = (faceOffset + faceSize / 2) / 2;

    // Create face planes (6 faces)
    const faceConfigs: Array<{
      name: string;
      position: THREE.Vector3;
      rotation: THREE.Euler;
      label: string;
    }> = [
      { name: "front", position: new THREE.Vector3(0, 0, faceOffset), rotation: new THREE.Euler(0, 0, 0), label: "FRONT" },
      { name: "back", position: new THREE.Vector3(0, 0, -faceOffset), rotation: new THREE.Euler(0, Math.PI, 0), label: "BACK" },
      { name: "right", position: new THREE.Vector3(faceOffset, 0, 0), rotation: new THREE.Euler(0, Math.PI / 2, 0), label: "RIGHT" },
      { name: "left", position: new THREE.Vector3(-faceOffset, 0, 0), rotation: new THREE.Euler(0, -Math.PI / 2, 0), label: "LEFT" },
      { name: "top", position: new THREE.Vector3(0, faceOffset, 0), rotation: new THREE.Euler(-Math.PI / 2, 0, 0), label: "TOP" },
      { name: "bottom", position: new THREE.Vector3(0, -faceOffset, 0), rotation: new THREE.Euler(Math.PI / 2, 0, 0), label: "BOTTOM" },
    ];

    for (const config of faceConfigs) {
      const isHovered = hovered === config.name;
      const isActive = active === config.name;
      const texture = createTextTexture(config.label, CUBE_COLOR, isHovered, isActive);

      const geometry = new THREE.PlaneGeometry(faceSize, faceSize);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(config.position);
      mesh.rotation.copy(config.rotation);
      mesh.userData = { type: "face", name: config.name };
      group.add(mesh);
    }

    // Create edge bevels (12 edges)
    // Each edge is defined by:
    // - position: center of the edge bevel
    // - normal: outward-facing direction of the bevel
    // - axis: direction the edge runs along (for sizing the plane)
    const edgeLength = faceSize;
    const edgeWidth = bevelSize * Math.SQRT2;

    const edgeConfigs: Array<{
      name: string;
      position: THREE.Vector3;
      normal: THREE.Vector3;
      axis: THREE.Vector3; // which axis the edge runs along
    }> = [
      // Top horizontal edges (run along X or Z, bevel faces diagonally up+out)
      { name: "top-front", position: new THREE.Vector3(0, edgeCenterOffset, edgeCenterOffset), normal: new THREE.Vector3(0, 1, 1).normalize(), axis: new THREE.Vector3(1, 0, 0) },
      { name: "top-back", position: new THREE.Vector3(0, edgeCenterOffset, -edgeCenterOffset), normal: new THREE.Vector3(0, 1, -1).normalize(), axis: new THREE.Vector3(1, 0, 0) },
      { name: "top-right", position: new THREE.Vector3(edgeCenterOffset, edgeCenterOffset, 0), normal: new THREE.Vector3(1, 1, 0).normalize(), axis: new THREE.Vector3(0, 0, 1) },
      { name: "top-left", position: new THREE.Vector3(-edgeCenterOffset, edgeCenterOffset, 0), normal: new THREE.Vector3(-1, 1, 0).normalize(), axis: new THREE.Vector3(0, 0, 1) },
      // Bottom horizontal edges
      { name: "bottom-front", position: new THREE.Vector3(0, -edgeCenterOffset, edgeCenterOffset), normal: new THREE.Vector3(0, -1, 1).normalize(), axis: new THREE.Vector3(1, 0, 0) },
      { name: "bottom-back", position: new THREE.Vector3(0, -edgeCenterOffset, -edgeCenterOffset), normal: new THREE.Vector3(0, -1, -1).normalize(), axis: new THREE.Vector3(1, 0, 0) },
      { name: "bottom-right", position: new THREE.Vector3(edgeCenterOffset, -edgeCenterOffset, 0), normal: new THREE.Vector3(1, -1, 0).normalize(), axis: new THREE.Vector3(0, 0, 1) },
      { name: "bottom-left", position: new THREE.Vector3(-edgeCenterOffset, -edgeCenterOffset, 0), normal: new THREE.Vector3(-1, -1, 0).normalize(), axis: new THREE.Vector3(0, 0, 1) },
      // Vertical edges (run along Y)
      { name: "front-right", position: new THREE.Vector3(edgeCenterOffset, 0, edgeCenterOffset), normal: new THREE.Vector3(1, 0, 1).normalize(), axis: new THREE.Vector3(0, 1, 0) },
      { name: "front-left", position: new THREE.Vector3(-edgeCenterOffset, 0, edgeCenterOffset), normal: new THREE.Vector3(-1, 0, 1).normalize(), axis: new THREE.Vector3(0, 1, 0) },
      { name: "back-right", position: new THREE.Vector3(edgeCenterOffset, 0, -edgeCenterOffset), normal: new THREE.Vector3(1, 0, -1).normalize(), axis: new THREE.Vector3(0, 1, 0) },
      { name: "back-left", position: new THREE.Vector3(-edgeCenterOffset, 0, -edgeCenterOffset), normal: new THREE.Vector3(-1, 0, -1).normalize(), axis: new THREE.Vector3(0, 1, 0) },
    ];

    for (const config of edgeConfigs) {
      const isHovered = hovered === config.name;
      const isActive = active === config.name;
      const color = isActive ? CUBE_ACTIVE_COLOR : isHovered ? EDGE_HOVER_COLOR : EDGE_COLOR;

      const geometry = new THREE.PlaneGeometry(edgeLength, edgeWidth);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(config.position);

      // Orient the plane: lookAt makes the plane face the normal direction
      // Then rotate to align the plane's long axis with the edge direction
      const lookTarget = config.position.clone().add(config.normal);
      mesh.lookAt(lookTarget);
      // Rotate 90 degrees around Z if needed to align the long edge with the axis
      // Check if the plane's local X aligns with the edge axis
      const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(mesh.quaternion);
      if (Math.abs(localX.dot(config.axis)) < 0.9) {
        mesh.rotateZ(Math.PI / 2);
      }

      mesh.userData = { type: "edge", name: config.name };
      group.add(mesh);
    }

    // Create corner pyramids/chamfers (8 corners)
    // Position corners at the intersection of the chamfered edges
    const cornerOffset = edgeCenterOffset;

    const cornerConfigs: Array<{
      name: string;
      position: THREE.Vector3;
    }> = [
      { name: "top-front-right", position: new THREE.Vector3(cornerOffset, cornerOffset, cornerOffset) },
      { name: "top-front-left", position: new THREE.Vector3(-cornerOffset, cornerOffset, cornerOffset) },
      { name: "top-back-right", position: new THREE.Vector3(cornerOffset, cornerOffset, -cornerOffset) },
      { name: "top-back-left", position: new THREE.Vector3(-cornerOffset, cornerOffset, -cornerOffset) },
      { name: "bottom-front-right", position: new THREE.Vector3(cornerOffset, -cornerOffset, cornerOffset) },
      { name: "bottom-front-left", position: new THREE.Vector3(-cornerOffset, -cornerOffset, cornerOffset) },
      { name: "bottom-back-right", position: new THREE.Vector3(cornerOffset, -cornerOffset, -cornerOffset) },
      { name: "bottom-back-left", position: new THREE.Vector3(-cornerOffset, -cornerOffset, -cornerOffset) },
    ];

    for (const config of cornerConfigs) {
      const isHovered = hovered === config.name;
      const isActive = active === config.name;
      const color = isActive ? CUBE_ACTIVE_COLOR : isHovered ? CORNER_HOVER_COLOR : CORNER_COLOR;

      // Create a small octahedron for corners
      const geometry = new THREE.OctahedronGeometry(bevelSize * 0.8);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(config.position);
      mesh.userData = { type: "corner", name: config.name };
      group.add(mesh);
    }

    return group;
  }, [createTextTexture]);

  // Initialize Three.js scene (only on mount/size change)
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera - start with perspective, will be updated by other effect
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 3.5);
    camera.lookAt(0, 0, 0);
    localCameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add cube
    const cubeGroup = createBeveledCube(null, null);
    scene.add(cubeGroup);
    cubeGroupRef.current = cubeGroup;

    // Cleanup
    return () => {
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [size, createBeveledCube]);

  // Update camera when projection type changes
  useEffect(() => {
    if (!localCameraRef.current) return;

    // Store current rotation from existing camera
    const currentQuaternion = localCameraRef.current.quaternion.clone();
    const currentPosition = localCameraRef.current.position.clone();

    if (isOrthographic) {
      const frustumSize = 1.8;
      const camera = new THREE.OrthographicCamera(
        -frustumSize / 2,
        frustumSize / 2,
        frustumSize / 2,
        -frustumSize / 2,
        0.1,
        100
      );
      camera.position.copy(currentPosition);
      camera.quaternion.copy(currentQuaternion);
      localCameraRef.current = camera;
    } else {
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.copy(currentPosition);
      camera.quaternion.copy(currentQuaternion);
      localCameraRef.current = camera;
    }
  }, [isOrthographic]);

  // Update cube appearance when hover/active state changes
  useEffect(() => {
    if (!sceneRef.current || !cubeGroupRef.current) return;

    const scene = sceneRef.current;

    // Remove old cube
    scene.remove(cubeGroupRef.current);
    cubeGroupRef.current.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        }
      }
    });

    // Create new cube with updated state
    const newCube = createBeveledCube(hoveredElement, activeElement);
    scene.add(newCube);
    cubeGroupRef.current = newCube;
  }, [hoveredElement, activeElement, createBeveledCube]);

  // Animation loop - sync cube orientation with main camera
  useEffect(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const localCamera = localCameraRef.current;
    const cubeGroup = cubeGroupRef.current;

    if (!renderer || !scene || !localCamera) return;

    let frameId: number;

    const animate = () => {
      frameId = requestAnimationFrame(animate);

      // Get main camera orientation and apply inverse to cube
      // This makes the cube appear to rotate WITH the scene
      if (cameraRef.current && cubeGroupRef.current) {
        const mainCamera = cameraRef.current;

        // Get camera direction
        const cameraDirection = new THREE.Vector3();
        mainCamera.getWorldDirection(cameraDirection);

        // Create quaternion from camera orientation
        const cameraQuaternion = mainCamera.quaternion.clone();

        // Apply inverse rotation to the cube so it mirrors the scene orientation
        cubeGroupRef.current.quaternion.copy(cameraQuaternion).invert();
      }

      renderer.render(scene, localCamera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [cameraRef]);

  // Handle mouse move for hover detection
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return;

    const container = containerRef.current;
    const localCamera = localCameraRef.current;
    if (!container || !localCamera || !cubeGroupRef.current) return;

    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / size) * 2 - 1,
      -((e.clientY - rect.top) / size) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, localCamera);

    const intersects = raycaster.intersectObjects(cubeGroupRef.current.children, true);

    if (intersects.length > 0) {
      const hitObject = intersects[0].object;
      const name = hitObject.userData.name;
      if (name && name !== hoveredElement) {
        setHoveredElement(name);
      }
    } else {
      if (hoveredElement !== null) {
        setHoveredElement(null);
      }
    }
  }, [size, isDragging, hoveredElement]);

  // Handle mouse down for click/drag
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cameraRef.current) return;

    setActiveElement(hoveredElement);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      cameraPos: cameraRef.current.position.clone(),
    };
  }, [hoveredElement, cameraRef]);

  // Handle mouse up - either click or end drag
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) {
      setActiveElement(null);
      return;
    }

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If minimal movement, treat as click
    if (distance < 5 && activeElement) {
      // Handle click on face/edge/corner
      let viewConfig: { position: THREE.Vector3; up: THREE.Vector3 } | undefined;

      if (activeElement in FACE_VIEWS) {
        viewConfig = FACE_VIEWS[activeElement];
      } else if (activeElement in EDGE_VIEWS) {
        viewConfig = EDGE_VIEWS[activeElement];
      } else if (activeElement in CORNER_VIEWS) {
        viewConfig = CORNER_VIEWS[activeElement];
      }

      if (viewConfig && cameraRef.current && controlsRef.current) {
        // Get current distance from target
        const currentDistance = cameraRef.current.position.distanceTo(controlsRef.current.target);

        // Set new camera position at same distance
        const newPosition = viewConfig.position.clone().multiplyScalar(currentDistance);
        newPosition.add(controlsRef.current.target);

        cameraRef.current.position.copy(newPosition);
        cameraRef.current.up.copy(viewConfig.up);
        cameraRef.current.lookAt(controlsRef.current.target);
        controlsRef.current.update();
      }
    }

    setIsDragging(false);
    setActiveElement(null);
    dragStartRef.current = null;
  }, [isDragging, activeElement, cameraRef, controlsRef]);

  // Handle global mouse move for drag rotation
  useEffect(() => {
    if (!isDragging) return;

    // Set grabbing cursor on body so it persists even outside the ViewCube
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current || !cameraRef.current || !controlsRef.current) return;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      // Rotate camera around target based on drag
      const sensitivity = 0.01;
      const target = controlsRef.current.target;
      const startPos = dragStartRef.current.cameraPos;

      // Calculate new position by rotating around target
      const theta = -dx * sensitivity;  // Horizontal rotation
      const phi = dy * sensitivity;     // Vertical rotation

      // Convert to spherical coordinates
      const offset = startPos.clone().sub(target);
      const spherical = new THREE.Spherical().setFromVector3(offset);

      spherical.theta += theta;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi + phi));

      // Convert back to cartesian
      offset.setFromSpherical(spherical);
      cameraRef.current.position.copy(target).add(offset);
      cameraRef.current.lookAt(target);
      controlsRef.current.update();
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setActiveElement(null);
      dragStartRef.current = null;
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      // Restore previous cursor
      document.body.style.cursor = previousCursor;
    };
  }, [isDragging, cameraRef, controlsRef]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    if (!isDragging) {
      setHoveredElement(null);
    }
  }, [isDragging]);

  // Icon button style
  const iconBtnStyle: React.CSSProperties = {
    width: 22,
    height: 22,
    border: "none",
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "#aaa",
    cursor: "pointer",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.15s, color 0.15s",
  };

  const iconBtnActiveStyle: React.CSSProperties = {
    ...iconBtnStyle,
    backgroundColor: "rgba(100, 108, 255, 0.3)",
    color: "#fff",
  };

  // Render mode config
  const renderModes: { mode: RenderMode; icon: React.ReactNode; label: string }[] = [
    { mode: "solid", icon: <IconSolid />, label: "Solid" },
    { mode: "wireframe", icon: <IconWireframe />, label: "Wireframe" },
    { mode: "material", icon: <IconMaterial />, label: "Material" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: topOffset,
        right: rightOffset,
        width: size,
        height: size,
        borderRadius: 8,
        backgroundColor: "rgba(20, 20, 35, 0.5)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        zIndex: 25,
      }}
    >
      {/* 3D Cube Canvas */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          cursor: isDragging ? "grabbing" : hoveredElement ? "pointer" : "grab",
        }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />

      {/* Top-left: Projection toggle */}
      {onToggleProjection && (
        <button
          style={{
            ...iconBtnStyle,
            position: "absolute",
            top: 4,
            left: 4,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleProjection();
          }}
          title={isOrthographic ? "Orthographic (click for Perspective)" : "Perspective (click for Orthographic)"}
        >
          {isOrthographic ? <IconOrthographic /> : <IconPerspective />}
        </button>
      )}

      {/* Bottom-left: Grid, Axes toggles */}
      <div
        style={{
          position: "absolute",
          bottom: 4,
          left: 4,
          display: "flex",
          gap: 3,
        }}
      >
        {onToggleGrid && (
          <button
            style={showGrid ? iconBtnActiveStyle : iconBtnStyle}
            onClick={(e) => {
              e.stopPropagation();
              onToggleGrid();
            }}
            title={showGrid ? "Hide Grid" : "Show Grid"}
          >
            <IconGrid color={showGrid ? "#fff" : "#aaa"} />
          </button>
        )}
        {onToggleAxes && (
          <button
            style={showAxes ? iconBtnActiveStyle : iconBtnStyle}
            onClick={(e) => {
              e.stopPropagation();
              onToggleAxes();
            }}
            title={showAxes ? "Hide Axes" : "Show Axes"}
          >
            <IconAxes color={showAxes ? "#fff" : "#aaa"} />
          </button>
        )}
      </div>

      {/* Bottom-right: Render Mode */}
      {onSetRenderMode && (
        <div
          style={{
            position: "absolute",
            bottom: 4,
            right: 4,
          }}
        >
          <button
            style={iconBtnStyle}
            onClick={(e) => {
              e.stopPropagation();
              setRenderMenuOpen(!renderMenuOpen);
            }}
            title="Render Mode"
          >
            <IconRenderMode />
          </button>
          {renderMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: 26,
                right: 0,
                zIndex: 1000,
                backgroundColor: "rgba(20, 20, 35, 0.95)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 6,
                padding: 4,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                minWidth: 100,
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {renderModes.map((rm) => (
                <button
                  key={rm.mode}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    border: "none",
                    borderRadius: 4,
                    backgroundColor: renderMode === rm.mode ? "rgba(100, 108, 255, 0.3)" : "transparent",
                    color: renderMode === rm.mode ? "#fff" : "#aaa",
                    cursor: "pointer",
                    fontSize: 11,
                    textAlign: "left",
                    width: "100%",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetRenderMode(rm.mode);
                    setRenderMenuOpen(false);
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", width: 16 }}>{rm.icon}</span>
                  <span>{rm.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ViewCube;
