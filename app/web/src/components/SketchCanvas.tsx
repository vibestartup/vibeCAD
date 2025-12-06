/**
 * SketchCanvas - 2D overlay for sketching on the viewport.
 * Handles mouse interactions for drawing lines, rectangles, circles, and arcs.
 * Also displays sketches in object mode with transparent lines.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useCadStore } from "../store";
import type { Sketch, SketchPrimitive, Vec2, SketchId } from "@vibecad/core";

interface Point2D {
  x: number;
  y: number;
}

// Drawing state for multi-click tools
type DrawingState =
  | { type: "idle" }
  | { type: "line"; start: Point2D }
  | { type: "rect"; start: Point2D }
  | { type: "circle"; center: Point2D }
  | { type: "arc"; step: "center" | "start" | "end"; center?: Point2D; start?: Point2D };

const styles = {
  // Active sketch editing mode - full overlay
  overlayActive: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "auto",
    cursor: "crosshair",
    zIndex: 100,
    backgroundColor: "rgba(20, 20, 40, 0.95)",
  } as React.CSSProperties,

  canvas: {
    width: "100%",
    height: "100%",
  } as React.CSSProperties,

  hint: {
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
  } as React.CSSProperties,

  coords: {
    position: "absolute",
    bottom: 16,
    left: 16,
    backgroundColor: "rgba(30, 30, 60, 0.9)",
    color: "#aaa",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontFamily: "monospace",
    pointerEvents: "none",
  } as React.CSSProperties,
};

// Scale factor: 1 pixel = 1mm in sketch space
const SCALE = 1;
const GRID_SIZE = 10; // 10mm grid

function getHint(tool: string, drawingState: DrawingState): string {
  switch (tool) {
    case "line":
      return drawingState.type === "line"
        ? "Click to place end point, ESC to cancel"
        : "Click to place start point";
    case "rect":
      return drawingState.type === "rect"
        ? "Click to place opposite corner, ESC to cancel"
        : "Click to place first corner";
    case "circle":
      return drawingState.type === "circle"
        ? "Click to set radius, ESC to cancel"
        : "Click to place center";
    case "arc":
      if (drawingState.type === "arc") {
        if (drawingState.step === "center") return "Click to place center";
        if (drawingState.step === "start") return "Click to place start point, ESC to cancel";
        return "Click to place end point, ESC to cancel";
      }
      return "Click to place center";
    default:
      return "Select a sketch tool";
  }
}

export function SketchCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeSketchId = useCadStore((s) => s.activeSketchId);
  const activeStudioId = useCadStore((s) => s.activeStudioId);
  const document = useCadStore((s) => s.document);
  const activeTool = useCadStore((s) => s.activeTool);
  const editorMode = useCadStore((s) => s.editorMode);
  const addLine = useCadStore((s) => s.addLine);
  const addRectangle = useCadStore((s) => s.addRectangle);
  const addCircle = useCadStore((s) => s.addCircle);
  const addArc = useCadStore((s) => s.addArc);
  const setActiveTool = useCadStore((s) => s.setActiveTool);

  const [drawingState, setDrawingState] = useState<DrawingState>({ type: "idle" });
  const [mousePos, setMousePos] = useState<Point2D>({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Determine if we're in active sketch editing mode
  const isSketchTool = ["line", "rect", "circle", "arc"].includes(activeTool);
  const isActiveSketchMode = editorMode === "sketch" && activeSketchId && isSketchTool;

  // Get the active sketch (for editing mode)
  const activeSketch: Sketch | null = React.useMemo(() => {
    if (!activeStudioId || !activeSketchId) return null;
    const studio = document.partStudios.get(activeStudioId);
    if (!studio) return null;
    return studio.sketches.get(activeSketchId) ?? null;
  }, [document, activeStudioId, activeSketchId]);

  // Convert screen coords to sketch coords (centered origin)
  const screenToSketch = useCallback((screenX: number, screenY: number): Point2D => {
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;
    return {
      x: (screenX - centerX) / SCALE,
      y: -(screenY - centerY) / SCALE, // Flip Y axis
    };
  }, [canvasSize]);

  // Convert sketch coords to screen coords
  const sketchToScreen = useCallback((sketchX: number, sketchY: number): Point2D => {
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;
    return {
      x: centerX + sketchX * SCALE,
      y: centerY - sketchY * SCALE, // Flip Y axis
    };
  }, [canvasSize]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setCanvasSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Handle keyboard (ESC to cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawingState({ type: "idle" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas resolution
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;

    // In active sketch mode, draw full grid and axes
    if (isActiveSketchMode) {
      // Draw grid
      ctx.strokeStyle = "#333355";
      ctx.lineWidth = 0.5;
      const gridSpacing = GRID_SIZE * SCALE;

      // Vertical lines
      for (let x = centerX % gridSpacing; x < canvasSize.width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasSize.height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = centerY % gridSpacing; y < canvasSize.height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasSize.width, y);
        ctx.stroke();
      }

      // Draw axes
      ctx.strokeStyle = "#666688";
      ctx.lineWidth = 1;

      // X axis
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(canvasSize.width, centerY);
      ctx.stroke();

      // Y axis
      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, canvasSize.height);
      ctx.stroke();

      // Draw origin
      ctx.fillStyle = "#646cff";
      ctx.beginPath();
      ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw active sketch primitives (full opacity, thicker lines)
      if (activeSketch && activeSketch.primitives.size > 0) {
        for (const [id, prim] of activeSketch.primitives) {
          drawPrimitive(ctx, prim, activeSketch, sketchToScreen, { opacity: 1.0, lineWidth: 2 });
        }
      }

      // Draw in-progress shape
      if (drawingState.type !== "idle") {
        ctx.strokeStyle = "#69db7c";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        if (drawingState.type === "line") {
          const start = sketchToScreen(drawingState.start.x, drawingState.start.y);
          const end = sketchToScreen(mousePos.x, mousePos.y);
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        } else if (drawingState.type === "rect") {
          const p1 = sketchToScreen(drawingState.start.x, drawingState.start.y);
          const p2 = sketchToScreen(mousePos.x, mousePos.y);
          const x = Math.min(p1.x, p2.x);
          const y = Math.min(p1.y, p2.y);
          const w = Math.abs(p2.x - p1.x);
          const h = Math.abs(p2.y - p1.y);
          ctx.strokeRect(x, y, w, h);
        } else if (drawingState.type === "circle") {
          const center = sketchToScreen(drawingState.center.x, drawingState.center.y);
          const dx = mousePos.x - drawingState.center.x;
          const dy = mousePos.y - drawingState.center.y;
          const radius = Math.sqrt(dx * dx + dy * dy) * SCALE;
          ctx.beginPath();
          ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        } else if (drawingState.type === "arc" && drawingState.center) {
          const center = sketchToScreen(drawingState.center.x, drawingState.center.y);
          if (drawingState.start) {
            const dx1 = drawingState.start.x - drawingState.center.x;
            const dy1 = drawingState.start.y - drawingState.center.y;
            const radius = Math.sqrt(dx1 * dx1 + dy1 * dy1) * SCALE;
            const startAngle = Math.atan2(-dy1, dx1);
            const dx2 = mousePos.x - drawingState.center.x;
            const dy2 = mousePos.y - drawingState.center.y;
            const endAngle = Math.atan2(-dy2, dx2);
            ctx.beginPath();
            ctx.arc(center.x, center.y, radius, startAngle, endAngle);
            ctx.stroke();
          } else {
            // Just show radius line
            const end = sketchToScreen(mousePos.x, mousePos.y);
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
          }
        }

        ctx.setLineDash([]);
      }

      // Draw cursor point
      const cursorScreen = sketchToScreen(mousePos.x, mousePos.y);
      ctx.fillStyle = "#69db7c";
      ctx.beginPath();
      ctx.arc(cursorScreen.x, cursorScreen.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [canvasSize, activeSketch, isActiveSketchMode, drawingState, mousePos, sketchToScreen]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const sketchCoords = screenToSketch(screenX, screenY);

    // Snap to grid
    const snapped = {
      x: Math.round(sketchCoords.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(sketchCoords.y / GRID_SIZE) * GRID_SIZE,
    };

    setMousePos(snapped);
  }, [screenToSketch]);

  // Handle click
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    console.log("[SketchCanvas] handleClick:", { activeSketchId, activeTool, mousePos, drawingState });
    if (!activeSketchId) {
      console.log("[SketchCanvas] No active sketch, ignoring click");
      return;
    }

    const tool = activeTool;
    const pos = mousePos;

    switch (tool) {
      case "line":
        if (drawingState.type === "line") {
          // Complete the line
          console.log("[SketchCanvas] Completing line from", drawingState.start, "to", pos);
          addLine(drawingState.start.x, drawingState.start.y, pos.x, pos.y);
          setDrawingState({ type: "idle" });
        } else {
          // Start a new line
          console.log("[SketchCanvas] Starting line at", pos);
          setDrawingState({ type: "line", start: pos });
        }
        break;

      case "rect":
        if (drawingState.type === "rect") {
          // Complete the rectangle
          addRectangle(drawingState.start.x, drawingState.start.y, pos.x, pos.y);
          setDrawingState({ type: "idle" });
        } else {
          // Start a new rectangle
          setDrawingState({ type: "rect", start: pos });
        }
        break;

      case "circle":
        if (drawingState.type === "circle") {
          // Complete the circle
          const dx = pos.x - drawingState.center.x;
          const dy = pos.y - drawingState.center.y;
          const radius = Math.sqrt(dx * dx + dy * dy);
          if (radius > 0) {
            addCircle(drawingState.center.x, drawingState.center.y, radius);
          }
          setDrawingState({ type: "idle" });
        } else {
          // Start a new circle
          setDrawingState({ type: "circle", center: pos });
        }
        break;

      case "arc":
        if (drawingState.type === "arc") {
          if (drawingState.step === "start" && drawingState.center) {
            // Set start point
            setDrawingState({ ...drawingState, step: "end", start: pos });
          } else if (drawingState.step === "end" && drawingState.center && drawingState.start) {
            // Complete the arc
            addArc(
              drawingState.center.x,
              drawingState.center.y,
              drawingState.start.x,
              drawingState.start.y,
              pos.x,
              pos.y,
              false
            );
            setDrawingState({ type: "idle" });
          }
        } else {
          // Start a new arc - first click is center
          setDrawingState({ type: "arc", step: "start", center: pos });
        }
        break;
    }
  }, [activeSketchId, activeTool, drawingState, mousePos, addLine, addRectangle, addCircle, addArc]);

  // Only render in active sketch editing mode
  // Object mode sketch rendering is now handled by Viewport in 3D
  if (!isActiveSketchMode) {
    return null;
  }

  // In active sketch mode, render interactive overlay
  return (
    <div
      ref={containerRef}
      style={styles.overlayActive}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} style={styles.canvas} />

      <div style={styles.hint}>
        {getHint(activeTool, drawingState)}
      </div>

      <div style={styles.coords}>
        X: {mousePos.x.toFixed(0)}mm, Y: {mousePos.y.toFixed(0)}mm
      </div>
    </div>
  );
}

// Style options for drawing primitives
interface DrawStyle {
  opacity: number;
  lineWidth: number;
}

// Helper to apply opacity to a hex color
function colorWithOpacity(hex: string, opacity: number): string {
  // Convert hex to rgba
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Helper to draw a primitive
function drawPrimitive(
  ctx: CanvasRenderingContext2D,
  prim: SketchPrimitive,
  sketch: Sketch,
  sketchToScreen: (x: number, y: number) => Point2D,
  style: DrawStyle = { opacity: 1.0, lineWidth: 2 }
) {
  const getPos = (id: string): Point2D | null => {
    const solved = sketch.solvedPositions?.get(id as any);
    if (solved) {
      return sketchToScreen(solved[0], solved[1]);
    }
    const p = sketch.primitives.get(id as any);
    if (p?.type === "point") {
      return sketchToScreen(p.x, p.y);
    }
    return null;
  };

  const normalColor = colorWithOpacity("#4dabf7", style.opacity);
  const constructionColor = colorWithOpacity("#888888", style.opacity);

  ctx.lineWidth = style.lineWidth;

  switch (prim.type) {
    case "point": {
      const pos = sketchToScreen(prim.x, prim.y);
      ctx.fillStyle = prim.construction ? constructionColor : normalColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, Math.max(2, style.lineWidth), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "line": {
      const start = getPos(prim.start);
      const end = getPos(prim.end);
      if (start && end) {
        ctx.strokeStyle = prim.construction ? constructionColor : normalColor;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
      break;
    }
    case "circle": {
      const center = getPos(prim.center);
      if (center) {
        ctx.strokeStyle = prim.construction ? constructionColor : normalColor;
        ctx.beginPath();
        ctx.arc(center.x, center.y, prim.radius * SCALE, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case "arc": {
      const center = getPos(prim.center);
      const start = getPos(prim.start);
      const end = getPos(prim.end);
      if (center && start && end) {
        const centerSketch = sketch.solvedPositions?.get(prim.center as any) ||
          (() => { const p = sketch.primitives.get(prim.center as any); return p?.type === "point" ? [p.x, p.y] : null; })();
        const startSketch = sketch.solvedPositions?.get(prim.start as any) ||
          (() => { const p = sketch.primitives.get(prim.start as any); return p?.type === "point" ? [p.x, p.y] : null; })();
        const endSketch = sketch.solvedPositions?.get(prim.end as any) ||
          (() => { const p = sketch.primitives.get(prim.end as any); return p?.type === "point" ? [p.x, p.y] : null; })();

        if (centerSketch && startSketch && endSketch) {
          const dx1 = startSketch[0] - centerSketch[0];
          const dy1 = startSketch[1] - centerSketch[1];
          const radius = Math.sqrt(dx1 * dx1 + dy1 * dy1) * SCALE;
          const startAngle = Math.atan2(-dy1, dx1);
          const dx2 = endSketch[0] - centerSketch[0];
          const dy2 = endSketch[1] - centerSketch[1];
          const endAngle = Math.atan2(-dy2, dx2);

          ctx.strokeStyle = prim.construction ? constructionColor : normalColor;
          ctx.beginPath();
          ctx.arc(center.x, center.y, radius, startAngle, endAngle, prim.clockwise);
          ctx.stroke();
        }
      }
      break;
    }
  }
}

export default SketchCanvas;
