/**
 * 2D Sketch Canvas - renders and edits sketch geometry.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import type { PrimitiveId, Vec2 } from "@vibecad/core";
import {
  useActiveSketch,
  useSelection,
  useDocumentContext,
} from "../../context";
import { useSketchPrimitives, useSketchConstraints } from "../../hooks";

// ============================================================================
// Props
// ============================================================================

type SketchTool = "select" | "point" | "line" | "rectangle" | "circle" | "arc";

interface SketchCanvasProps {
  /** Width of the canvas */
  width?: number | string;
  /** Height of the canvas */
  height?: number | string;
  /** Background color */
  backgroundColor?: string;
  /** Grid spacing */
  gridSize?: number;
  /** Current tool */
  tool?: SketchTool;
  /** Called when tool changes */
  onToolChange?: (tool: SketchTool) => void;
  /** Called when primitive is selected */
  onSelect?: (primitiveId: PrimitiveId | null) => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 2D canvas for sketch editing.
 *
 * This is a placeholder component. The actual implementation requires:
 * - Canvas/SVG rendering of primitives
 * - Pan and zoom controls
 * - Tool state machine for drawing
 * - Constraint visualization
 * - Dimension labels
 */
export function SketchCanvas({
  width = "100%",
  height = "100%",
  backgroundColor = "#1e1e2e",
  gridSize = 10,
  tool = "select",
  onToolChange,
  onSelect,
}: SketchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sketch = useActiveSketch();
  const selection = useSelection();
  const { setSelection } = useDocumentContext();

  const [viewTransform, setViewTransform] = useState({
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  });

  // Get primitives and constraints
  const primitives = sketch ? Array.from(sketch.primitives.values()) : [];
  const constraints = sketch ? Array.from(sketch.constraints.values()) : [];

  // Screen to sketch coordinates
  const screenToSketch = useCallback(
    (screenX: number, screenY: number): Vec2 => {
      const { offsetX, offsetY, scale } = viewTransform;
      return [
        (screenX - offsetX) / scale,
        (screenY - offsetY) / scale,
      ];
    },
    [viewTransform]
  );

  // Sketch to screen coordinates
  const sketchToScreen = useCallback(
    (sketchX: number, sketchY: number): Vec2 => {
      const { offsetX, offsetY, scale } = viewTransform;
      return [
        sketchX * scale + offsetX,
        sketchY * scale + offsetY,
      ];
    },
    [viewTransform]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 0.5;
    const { offsetX, offsetY, scale } = viewTransform;
    const gridStep = gridSize * scale;

    // Vertical lines
    const startX = offsetX % gridStep;
    for (let x = startX; x < canvas.width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Horizontal lines
    const startY = offsetY % gridStep;
    for (let y = startY; y < canvas.height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;

    // X axis
    ctx.beginPath();
    ctx.moveTo(0, offsetY);
    ctx.lineTo(canvas.width, offsetY);
    ctx.stroke();

    // Y axis
    ctx.beginPath();
    ctx.moveTo(offsetX, 0);
    ctx.lineTo(offsetX, canvas.height);
    ctx.stroke();

    // Draw primitives
    // TODO: Render each primitive type

    // Draw constraints
    // TODO: Render constraint indicators

  }, [sketch, viewTransform, gridSize, backgroundColor, selection]);

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          cursor: tool === "select" ? "default" : "crosshair",
        }}
      />

      {/* Tool indicator */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          padding: "4px 8px",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          color: "#fff",
          fontSize: "12px",
          borderRadius: 4,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Tool: {tool}
      </div>

      {/* Stats */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          padding: "4px 8px",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          color: "#888",
          fontSize: "11px",
          borderRadius: 4,
          fontFamily: "monospace",
        }}
      >
        {primitives.length} primitives | {constraints.length} constraints
        {sketch?.dof !== undefined && ` | DOF: ${sketch.dof}`}
      </div>
    </div>
  );
}

export default SketchCanvas;
