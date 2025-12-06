/**
 * 3D Viewport component - renders the CAD model using Three.js.
 */

import React, { useRef, useEffect, useState } from "react";
import type { Mesh } from "@vibecad/core";
import { useActiveStudio, useSelection, useDocumentContext } from "../../context";

// ============================================================================
// Props
// ============================================================================

interface Viewport3DProps {
  /** Width of the viewport */
  width?: number | string;
  /** Height of the viewport */
  height?: number | string;
  /** Background color */
  backgroundColor?: string;
  /** Enable grid */
  showGrid?: boolean;
  /** Enable axes helper */
  showAxes?: boolean;
  /** Called when an entity is clicked */
  onSelect?: (entityId: string | null) => void;
  /** Called when an entity is hovered */
  onHover?: (entityId: string | null) => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 3D viewport for rendering CAD geometry.
 *
 * This is a placeholder component. The actual implementation requires:
 * - Three.js scene setup
 * - OrbitControls for camera movement
 * - Raycasting for selection
 * - Mesh rendering from OpResult data
 */
export function Viewport3D({
  width = "100%",
  height = "100%",
  backgroundColor = "#1a1a2e",
  showGrid = true,
  showAxes = true,
  onSelect,
  onHover,
}: Viewport3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const studio = useActiveStudio();
  const selection = useSelection();
  const [isInitialized, setIsInitialized] = useState(false);

  // Get meshes from studio results
  const meshes: Array<{ opId: string; mesh: Mesh }> = [];
  if (studio?.results) {
    for (const [opId, result] of studio.results) {
      if (result.mesh) {
        meshes.push({ opId, mesh: result.mesh });
      }
    }
  }

  useEffect(() => {
    if (!containerRef.current) return;

    // TODO: Initialize Three.js scene
    // - Create scene, camera, renderer
    // - Add OrbitControls
    // - Add lights
    // - Add grid and axes helpers if enabled
    // - Set up animation loop

    setIsInitialized(true);

    return () => {
      // Cleanup Three.js resources
    };
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    // TODO: Update meshes when studio.results changes
    // - Clear existing meshes
    // - Create BufferGeometry from each Mesh
    // - Add to scene with materials

  }, [meshes, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;

    // TODO: Update selection highlighting
    // - Highlight selected meshes/faces/edges

  }, [selection, isInitialized]);

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        backgroundColor,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Placeholder content */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          color: "#666",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>&#x1F4D0;</div>
        <div style={{ fontSize: "14px" }}>
          3D Viewport
          <br />
          <span style={{ fontSize: "12px", color: "#444" }}>
            {meshes.length} mesh{meshes.length !== 1 ? "es" : ""} to render
          </span>
        </div>
      </div>
    </div>
  );
}

export default Viewport3D;
