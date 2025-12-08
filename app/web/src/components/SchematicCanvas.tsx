/**
 * SchematicCanvas - 2D canvas for schematic editing.
 * Renders symbols, wires, and provides interaction for the schematic editor.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useSchematicStore } from "../store/schematic-store";
import type { PinId } from "@vibecad/core";
import { Schematic } from "@vibecad/core";

type Symbol = Schematic.Symbol;
type SymbolInstance = Schematic.SymbolInstance;
type Wire = Schematic.Wire;
type NetLabel = Schematic.NetLabel;
type SchematicPoint = Schematic.SchematicPoint;
type SymbolPrimitive = Schematic.SymbolPrimitive;

// ============================================================================
// Constants
// ============================================================================

const GRID_SIZE = 50; // 50 mils (typical schematic grid)
const SCALE = 0.5; // pixels per mil
const SYMBOL_COLOR = "#4dabf7";
const WIRE_COLOR = "#69db7c";
const SELECTED_COLOR = "#ffd43b";
const HOVER_COLOR = "#ffa94d";
const PIN_COLOR = "#ff6b6b";
const GRID_COLOR = "rgba(128, 128, 128, 0.2)";
const GRID_MAJOR_COLOR = "rgba(128, 128, 128, 0.4)";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "#1a1b26",
    overflow: "hidden",
  } as React.CSSProperties,

  canvas: {
    position: "absolute",
    top: 0,
    left: 0,
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
    zIndex: 10,
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
    zIndex: 10,
  } as React.CSSProperties,

  toolbar: {
    position: "absolute",
    top: 16,
    left: 16,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    zIndex: 10,
  } as React.CSSProperties,

  toolButton: {
    width: 36,
    height: 36,
    backgroundColor: "rgba(30, 30, 60, 0.9)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 4,
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
  } as React.CSSProperties,

  activeToolButton: {
    backgroundColor: "rgba(77, 171, 247, 0.5)",
    borderColor: "#4dabf7",
  } as React.CSSProperties,
};

// ============================================================================
// Helper Functions
// ============================================================================

function getHint(mode: string, wireDrawing: boolean, pendingSymbol: boolean): string {
  if (pendingSymbol) {
    return "Click to place symbol, R to rotate, F to flip, ESC to cancel";
  }
  if (wireDrawing) {
    return "Click to add wire segment, double-click to finish, ESC to cancel";
  }
  switch (mode) {
    case "select":
      return "Click to select, drag to move, Shift+click for multi-select";
    case "draw-wire":
      return "Click on a pin or location to start wire";
    case "place-label":
      return "Click to place net label";
    default:
      return "";
  }
}

// ============================================================================
// Component
// ============================================================================

export function SchematicCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Store state
  const schematic = useSchematicStore((s) => s.schematic);
  const viewOffset = useSchematicStore((s) => s.viewOffset);
  const zoom = useSchematicStore((s) => s.zoom);
  const mode = useSchematicStore((s) => s.mode);
  const activeTool = useSchematicStore((s) => s.activeTool);
  const selectedInstances = useSchematicStore((s) => s.selectedInstances);
  const selectedWires = useSchematicStore((s) => s.selectedWires);
  const hoveredInstance = useSchematicStore((s) => s.hoveredInstance);
  const hoveredWire = useSchematicStore((s) => s.hoveredWire);
  const hoveredPin = useSchematicStore((s) => s.hoveredPin);
  const mousePos = useSchematicStore((s) => s.mousePos);
  const wireDrawing = useSchematicStore((s) => s.wireDrawing);
  const pendingSymbol = useSchematicStore((s) => s.pendingSymbol);
  const gridSize = useSchematicStore((s) => s.gridSize);
  const snapToGrid = useSchematicStore((s) => s.snapToGrid);

  // Store actions
  const pan = useSchematicStore((s) => s.pan);
  const setZoom = useSchematicStore((s) => s.setZoom);
  const setMousePos = useSchematicStore((s) => s.setMousePos);
  const setTool = useSchematicStore((s) => s.setTool);
  const setHoveredInstance = useSchematicStore((s) => s.setHoveredInstance);
  const setHoveredWire = useSchematicStore((s) => s.setHoveredWire);
  const selectInstance = useSchematicStore((s) => s.selectInstance);
  const selectWire = useSchematicStore((s) => s.selectWire);
  const clearSelection = useSchematicStore((s) => s.clearSelection);
  const startWire = useSchematicStore((s) => s.startWire);
  const addWirePoint = useSchematicStore((s) => s.addWirePoint);
  const finishWire = useSchematicStore((s) => s.finishWire);
  const cancelWire = useSchematicStore((s) => s.cancelWire);
  const placeSymbol = useSchematicStore((s) => s.placeSymbol);
  const cancelPlaceSymbol = useSchematicStore((s) => s.cancelPlaceSymbol);
  const rotatePendingSymbol = useSchematicStore((s) => s.rotatePendingSymbol);
  const mirrorPendingSymbol = useSchematicStore((s) => s.mirrorPendingSymbol);
  const moveSelectedInstances = useSchematicStore((s) => s.moveSelectedInstances);
  const getActiveSheetInstances = useSchematicStore((s) => s.getActiveSheetInstances);
  const getActiveSheetWires = useSchematicStore((s) => s.getActiveSheetWires);
  const getActiveSheetLabels = useSchematicStore((s) => s.getActiveSheetLabels);
  const getSymbol = useSchematicStore((s) => s.getSymbol);

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [lastPanPos, setLastPanPos] = useState<{ x: number; y: number } | null>(null);

  // Convert screen coords to schematic coords
  const screenToSchematic = useCallback(
    (screenX: number, screenY: number): SchematicPoint => {
      const x = (screenX - canvasSize.width / 2 - viewOffset.x) / zoom;
      const y = -(screenY - canvasSize.height / 2 - viewOffset.y) / zoom;
      return { x, y };
    },
    [canvasSize, viewOffset, zoom]
  );

  // Convert schematic coords to screen coords
  const schematicToScreen = useCallback(
    (schemaX: number, schemaY: number): { x: number; y: number } => {
      const x = schemaX * zoom + canvasSize.width / 2 + viewOffset.x;
      const y = -schemaY * zoom + canvasSize.height / 2 + viewOffset.y;
      return { x, y };
    },
    [canvasSize, viewOffset, zoom]
  );

  // Snap point to grid
  const snapPoint = useCallback(
    (point: SchematicPoint): SchematicPoint => {
      if (!snapToGrid) return point;
      return {
        x: Math.round(point.x / gridSize) * gridSize,
        y: Math.round(point.y / gridSize) * gridSize,
      };
    },
    [snapToGrid, gridSize]
  );

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

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (wireDrawing) {
          cancelWire();
        } else if (pendingSymbol) {
          cancelPlaceSymbol();
        } else {
          clearSelection();
        }
      } else if (e.key === "r" || e.key === "R") {
        if (pendingSymbol) {
          rotatePendingSymbol();
        }
      } else if (e.key === "f" || e.key === "F") {
        if (pendingSymbol) {
          mirrorPendingSymbol();
        }
      } else if (e.key === "w" || e.key === "W") {
        setTool("wire");
      } else if (e.key === "v" || e.key === "V") {
        setTool("select");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [wireDrawing, pendingSymbol, cancelWire, cancelPlaceSymbol, rotatePendingSymbol, mirrorPendingSymbol, clearSelection, setTool]);

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Middle mouse button for panning
      if (e.button === 1) {
        setIsPanning(true);
        setLastPanPos({ x: e.clientX, y: e.clientY });
        return;
      }

      // Left click
      if (e.button === 0) {
        const schemaPos = screenToSchematic(screenX, screenY);
        const snappedPos = snapPoint(schemaPos);

        if (pendingSymbol) {
          // Place the pending symbol
          placeSymbol(snappedPos);
        } else if (mode === "draw-wire") {
          if (wireDrawing) {
            // Add wire point
            addWirePoint(snappedPos);
          } else {
            // Start new wire
            startWire(snappedPos);
          }
        } else if (mode === "select") {
          // Check for hit testing (simplified - in real app would use proper bounds checking)
          // For now, just clear selection on empty click
          if (!e.shiftKey) {
            clearSelection();
          }
          setIsDragging(true);
          setDragStart({ x: screenX, y: screenY });
        }
      }
    },
    [screenToSchematic, snapPoint, mode, wireDrawing, pendingSymbol, placeSymbol, addWirePoint, startWire, clearSelection]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const schemaPos = screenToSchematic(screenX, screenY);
      const snappedPos = snapPoint(schemaPos);
      setMousePos(snappedPos);

      // Panning
      if (isPanning && lastPanPos) {
        const dx = e.clientX - lastPanPos.x;
        const dy = e.clientY - lastPanPos.y;
        pan(dx, dy);
        setLastPanPos({ x: e.clientX, y: e.clientY });
        return;
      }

      // Dragging selection
      if (isDragging && dragStart && selectedInstances.size > 0) {
        const currentScreen = { x: screenX, y: screenY };
        const delta = {
          x: (currentScreen.x - dragStart.x) / zoom,
          y: -(currentScreen.y - dragStart.y) / zoom,
        };
        if (Math.abs(delta.x) > 5 || Math.abs(delta.y) > 5) {
          moveSelectedInstances(snapPoint(delta));
          setDragStart(currentScreen);
        }
      }
    },
    [screenToSchematic, snapPoint, setMousePos, isPanning, lastPanPos, pan, isDragging, dragStart, selectedInstances, zoom, moveSelectedInstances]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      setIsPanning(false);
      setLastPanPos(null);
      setIsDragging(false);
      setDragStart(null);
    },
    []
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (wireDrawing) {
        finishWire();
      }
    },
    [wireDrawing, finishWire]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(zoom * delta);
    },
    [zoom, setZoom]
  );

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
    ctx.fillStyle = "#1a1b26";
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw grid
    drawGrid(ctx, canvasSize, viewOffset, zoom, gridSize);

    // Get active sheet contents
    const instances = getActiveSheetInstances();
    const wires = getActiveSheetWires();
    const labels = getActiveSheetLabels();

    // Draw wires
    for (const wire of wires) {
      const isSelected = selectedWires.has(wire.id);
      const isHovered = hoveredWire === wire.id;
      drawWire(ctx, wire, schematicToScreen, isSelected, isHovered);
    }

    // Draw symbol instances
    for (const instance of instances) {
      const symbol = getSymbol(instance.symbolId);
      if (!symbol) continue;

      const isSelected = selectedInstances.has(instance.id);
      const isHovered = hoveredInstance === instance.id;
      drawSymbolInstance(ctx, instance, symbol, schematicToScreen, isSelected, isHovered);
    }

    // Draw net labels
    for (const label of labels) {
      drawNetLabel(ctx, label, schematicToScreen);
    }

    // Draw wire in progress
    if (wireDrawing && wireDrawing.points.length > 0) {
      ctx.strokeStyle = WIRE_COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      ctx.beginPath();
      const firstPt = schematicToScreen(wireDrawing.points[0].x, wireDrawing.points[0].y);
      ctx.moveTo(firstPt.x, firstPt.y);

      for (let i = 1; i < wireDrawing.points.length; i++) {
        const pt = schematicToScreen(wireDrawing.points[i].x, wireDrawing.points[i].y);
        ctx.lineTo(pt.x, pt.y);
      }

      // Draw to current mouse position
      if (mousePos) {
        const lastPt = wireDrawing.points[wireDrawing.points.length - 1];
        // Orthogonal routing preview (horizontal then vertical)
        if (lastPt.x !== mousePos.x && lastPt.y !== mousePos.y) {
          const cornerPt = schematicToScreen(mousePos.x, lastPt.y);
          ctx.lineTo(cornerPt.x, cornerPt.y);
        }
        const mousePt = schematicToScreen(mousePos.x, mousePos.y);
        ctx.lineTo(mousePt.x, mousePt.y);
      }

      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw pending symbol preview
    if (pendingSymbol && mousePos) {
      const symbol = getSymbol(pendingSymbol.symbolId);
      if (symbol) {
        ctx.globalAlpha = 0.6;
        drawSymbolAtPosition(
          ctx,
          symbol,
          mousePos,
          pendingSymbol.rotation,
          pendingSymbol.mirror,
          schematicToScreen
        );
        ctx.globalAlpha = 1.0;
      }
    }

    // Draw cursor crosshair
    if (mousePos) {
      const cursor = schematicToScreen(mousePos.x, mousePos.y);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cursor.x - 10, cursor.y);
      ctx.lineTo(cursor.x + 10, cursor.y);
      ctx.moveTo(cursor.x, cursor.y - 10);
      ctx.lineTo(cursor.x, cursor.y + 10);
      ctx.stroke();
    }
  }, [
    canvasSize,
    viewOffset,
    zoom,
    gridSize,
    schematic,
    selectedInstances,
    selectedWires,
    hoveredInstance,
    hoveredWire,
    wireDrawing,
    pendingSymbol,
    mousePos,
    getActiveSheetInstances,
    getActiveSheetWires,
    getActiveSheetLabels,
    getSymbol,
    schematicToScreen,
  ]);

  return (
    <div ref={containerRef} style={styles.container}>
      <canvas
        ref={canvasRef}
        style={styles.canvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Tool buttons */}
      <div style={styles.toolbar}>
        <button
          style={{
            ...styles.toolButton,
            ...(activeTool === "select" ? styles.activeToolButton : {}),
          }}
          onClick={() => setTool("select")}
          title="Select (V)"
        >
          V
        </button>
        <button
          style={{
            ...styles.toolButton,
            ...(activeTool === "wire" ? styles.activeToolButton : {}),
          }}
          onClick={() => setTool("wire")}
          title="Wire (W)"
        >
          W
        </button>
      </div>

      {/* Status hint */}
      <div style={styles.hint}>
        {getHint(mode, wireDrawing !== null, pendingSymbol !== null)}
      </div>

      {/* Coordinates */}
      <div style={styles.coords}>
        {mousePos
          ? `X: ${mousePos.x.toFixed(0)}, Y: ${mousePos.y.toFixed(0)}`
          : ""}
      </div>
    </div>
  );
}

// ============================================================================
// Drawing Functions
// ============================================================================

function drawGrid(
  ctx: CanvasRenderingContext2D,
  canvasSize: { width: number; height: number },
  viewOffset: { x: number; y: number },
  zoom: number,
  gridSize: number
) {
  const gridSpacing = gridSize * zoom;

  // Don't draw grid if too zoomed out
  if (gridSpacing < 10) return;

  const startX = (viewOffset.x % gridSpacing) + canvasSize.width / 2;
  const startY = (viewOffset.y % gridSpacing) + canvasSize.height / 2;

  // Draw minor grid
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let x = startX % gridSpacing; x < canvasSize.width; x += gridSpacing) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasSize.height);
  }

  for (let y = startY % gridSpacing; y < canvasSize.height; y += gridSpacing) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvasSize.width, y);
  }

  ctx.stroke();

  // Draw major grid (every 5 grid units)
  const majorSpacing = gridSpacing * 5;
  if (majorSpacing >= 50) {
    ctx.strokeStyle = GRID_MAJOR_COLOR;
    ctx.beginPath();

    for (let x = startX % majorSpacing; x < canvasSize.width; x += majorSpacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasSize.height);
    }

    for (let y = startY % majorSpacing; y < canvasSize.height; y += majorSpacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvasSize.width, y);
    }

    ctx.stroke();
  }
}

function drawWire(
  ctx: CanvasRenderingContext2D,
  wire: Wire,
  toScreen: (x: number, y: number) => { x: number; y: number },
  isSelected: boolean,
  isHovered: boolean
) {
  if (wire.points.length < 2) return;

  ctx.strokeStyle = isSelected ? SELECTED_COLOR : isHovered ? HOVER_COLOR : WIRE_COLOR;
  ctx.lineWidth = isSelected || isHovered ? 3 : 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  const first = toScreen(wire.points[0].x, wire.points[0].y);
  ctx.moveTo(first.x, first.y);

  for (let i = 1; i < wire.points.length; i++) {
    const pt = toScreen(wire.points[i].x, wire.points[i].y);
    ctx.lineTo(pt.x, pt.y);
  }

  ctx.stroke();

  // Draw junction dots at vertices
  ctx.fillStyle = ctx.strokeStyle;
  for (const pt of wire.points) {
    const screen = toScreen(pt.x, pt.y);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSymbolInstance(
  ctx: CanvasRenderingContext2D,
  instance: SymbolInstance,
  symbol: Symbol,
  toScreen: (x: number, y: number) => { x: number; y: number },
  isSelected: boolean,
  isHovered: boolean
) {
  ctx.save();

  const pos = toScreen(instance.position.x, instance.position.y);
  ctx.translate(pos.x, pos.y);

  // Apply rotation (convert to canvas rotation direction)
  ctx.rotate((-instance.rotation * Math.PI) / 180);

  // Apply mirror
  if (instance.mirror) {
    ctx.scale(-1, 1);
  }

  const color = isSelected ? SELECTED_COLOR : isHovered ? HOVER_COLOR : SYMBOL_COLOR;

  // Draw symbol primitives
  for (const prim of symbol.primitives) {
    drawSymbolPrimitive(ctx, prim, color);
  }

  // Draw pins
  ctx.fillStyle = PIN_COLOR;
  for (const [pinId, pin] of symbol.pins) {
    ctx.beginPath();
    ctx.arc(pin.position.x * SCALE, -pin.position.y * SCALE, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Draw reference designator
  if (instance.refDes) {
    ctx.fillStyle = color;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(instance.refDes, pos.x, pos.y - 30);
  }

  // Draw value
  if (instance.value) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(instance.value, pos.x, pos.y + 40);
  }
}

function drawSymbolAtPosition(
  ctx: CanvasRenderingContext2D,
  symbol: Symbol,
  position: SchematicPoint,
  rotation: number,
  mirror: boolean,
  toScreen: (x: number, y: number) => { x: number; y: number }
) {
  ctx.save();

  const pos = toScreen(position.x, position.y);
  ctx.translate(pos.x, pos.y);
  ctx.rotate((-rotation * Math.PI) / 180);
  if (mirror) {
    ctx.scale(-1, 1);
  }

  for (const prim of symbol.primitives) {
    drawSymbolPrimitive(ctx, prim, SYMBOL_COLOR);
  }

  // Draw pins
  ctx.fillStyle = PIN_COLOR;
  for (const [pinId, pin] of symbol.pins) {
    ctx.beginPath();
    ctx.arc(pin.position.x * SCALE, -pin.position.y * SCALE, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawSymbolPrimitive(
  ctx: CanvasRenderingContext2D,
  prim: SymbolPrimitive,
  color: string
) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  switch (prim.type) {
    case "line": {
      ctx.beginPath();
      ctx.moveTo(prim.start.x * SCALE, -prim.start.y * SCALE);
      ctx.lineTo(prim.end.x * SCALE, -prim.end.y * SCALE);
      ctx.stroke();
      break;
    }
    case "rect": {
      ctx.strokeRect(
        prim.x * SCALE,
        -prim.y * SCALE - prim.height * SCALE,
        prim.width * SCALE,
        prim.height * SCALE
      );
      if (prim.fill) {
        ctx.globalAlpha = 0.2;
        ctx.fillRect(
          prim.x * SCALE,
          -prim.y * SCALE - prim.height * SCALE,
          prim.width * SCALE,
          prim.height * SCALE
        );
        ctx.globalAlpha = 1.0;
      }
      break;
    }
    case "circle": {
      ctx.beginPath();
      ctx.arc(prim.center.x * SCALE, -prim.center.y * SCALE, prim.radius * SCALE, 0, Math.PI * 2);
      ctx.stroke();
      if (prim.fill) {
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
      break;
    }
    case "arc": {
      ctx.beginPath();
      ctx.arc(
        prim.center.x * SCALE,
        -prim.center.y * SCALE,
        prim.radius * SCALE,
        (-prim.startAngle * Math.PI) / 180,
        (-prim.endAngle * Math.PI) / 180,
        true
      );
      ctx.stroke();
      break;
    }
    case "polyline": {
      if (prim.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(prim.points[0].x * SCALE, -prim.points[0].y * SCALE);
      for (let i = 1; i < prim.points.length; i++) {
        ctx.lineTo(prim.points[i].x * SCALE, -prim.points[i].y * SCALE);
      }
      ctx.stroke();
      if (prim.fill) {
        ctx.closePath();
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
      break;
    }
    case "text": {
      ctx.font = `${prim.fontSize * SCALE}px sans-serif`;
      ctx.textAlign = prim.align || "left";
      ctx.fillText(prim.text, prim.position.x * SCALE, -prim.position.y * SCALE);
      break;
    }
  }
}

function drawNetLabel(
  ctx: CanvasRenderingContext2D,
  label: NetLabel,
  toScreen: (x: number, y: number) => { x: number; y: number }
) {
  const pos = toScreen(label.position.x, label.position.y);

  // Draw label background
  ctx.fillStyle = "rgba(30, 30, 60, 0.9)";
  const textWidth = ctx.measureText(label.netName).width + 16;
  ctx.fillRect(pos.x - textWidth / 2, pos.y - 12, textWidth, 24);

  // Draw label border
  ctx.strokeStyle = label.style === "global" ? "#ffd43b" : WIRE_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(pos.x - textWidth / 2, pos.y - 12, textWidth, 24);

  // Draw text
  ctx.fillStyle = "#fff";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label.netName, pos.x, pos.y);
}

export default SchematicCanvas;
