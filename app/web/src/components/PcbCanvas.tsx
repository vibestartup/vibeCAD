/**
 * PcbCanvas - 2D canvas for PCB layout editing.
 * Renders footprints, traces, vias, copper pours, and board outline.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { usePcbStore } from "../store/pcb-store";
import type { LayerId, Vec2 } from "@vibecad/core";
import { Pcb } from "@vibecad/core";

type FootprintInstance = Pcb.FootprintInstance;
type Footprint = Pcb.Footprint;
type Trace = Pcb.Trace;
type Via = Pcb.Via;
type CopperPour = Pcb.CopperPour;
type Layer = Pcb.Layer;
type DrcViolation = Pcb.DrcViolation;

// ============================================================================
// Constants
// ============================================================================

// Pixels per mm at zoom 1.0
const PIXELS_PER_MM = 10;

// Layer colors
const LAYER_COLORS: Record<string, string> = {
  "F.Cu": "#ff4444", // Top copper - red
  "B.Cu": "#4444ff", // Bottom copper - blue
  "In1.Cu": "#44ff44", // Inner layer 1 - green
  "In2.Cu": "#ffff44", // Inner layer 2 - yellow
  "F.SilkS": "#ffffff", // Top silkscreen - white
  "B.SilkS": "#888888", // Bottom silkscreen - gray
  "F.Mask": "#9944ff44", // Top soldermask - purple (transparent)
  "B.Mask": "#44449944", // Bottom soldermask - blue (transparent)
  "Edge.Cuts": "#ffff00", // Board outline - yellow
  "F.Fab": "#666666", // Top fabrication - dark gray
  "B.Fab": "#444444", // Bottom fabrication - darker gray
  "F.CrtYd": "#ff00ff44", // Top courtyard - magenta (transparent)
  "B.CrtYd": "#00ffff44", // Bottom courtyard - cyan (transparent)
};

const SELECTED_COLOR = "#ffd43b";
const HOVER_COLOR = "#ffa94d";
const RATSNEST_COLOR = "rgba(255, 255, 0, 0.3)";
const DRC_VIOLATION_COLOR = "#ff0000";
const GRID_COLOR = "rgba(128, 128, 128, 0.2)";
const GRID_MAJOR_COLOR = "rgba(128, 128, 128, 0.4)";
const BOARD_OUTLINE_COLOR = "#ffff00";
const BOARD_FILL_COLOR = "#2a2a3a";
const PAD_COLOR = "#c0c0c0";
const DRILL_COLOR = "#1a1b26";

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

  layerPanel: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(30, 30, 60, 0.9)",
    padding: 8,
    borderRadius: 4,
    zIndex: 10,
    maxHeight: 300,
    overflowY: "auto",
  } as React.CSSProperties,

  layerItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 0",
    cursor: "pointer",
    fontSize: 11,
  } as React.CSSProperties,

  layerColor: {
    width: 16,
    height: 16,
    borderRadius: 2,
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

function getHint(mode: string, routing: boolean, pendingFootprint: boolean): string {
  if (pendingFootprint) {
    return "Click to place footprint, R to rotate, F to flip side, ESC to cancel";
  }
  if (routing) {
    return "Click to add route segment, V for via, Space to switch layer, ESC to cancel";
  }
  switch (mode) {
    case "select":
      return "Click to select, drag to move, Shift+click for multi-select";
    case "route":
      return "Click on a pad to start routing";
    case "draw-zone":
      return "Click to add zone points, double-click to finish";
    default:
      return "";
  }
}

function getLayerColor(layer: Layer): string {
  return LAYER_COLORS[layer.name] || "#888888";
}

// ============================================================================
// Component
// ============================================================================

export function PcbCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Store state
  const pcb = usePcbStore((s) => s.pcb);
  const viewOffset = usePcbStore((s) => s.viewOffset);
  const zoom = usePcbStore((s) => s.zoom);
  const mode = usePcbStore((s) => s.mode);
  const activeTool = usePcbStore((s) => s.activeTool);
  const activeLayer = usePcbStore((s) => s.activeLayer);
  const layerVisibility = usePcbStore((s) => s.layerVisibility);
  const selectedInstances = usePcbStore((s) => s.selectedInstances);
  const selectedTraces = usePcbStore((s) => s.selectedTraces);
  const selectedVias = usePcbStore((s) => s.selectedVias);
  const hoveredInstance = usePcbStore((s) => s.hoveredInstance);
  const hoveredTrace = usePcbStore((s) => s.hoveredTrace);
  const hoveredVia = usePcbStore((s) => s.hoveredVia);
  const mousePos = usePcbStore((s) => s.mousePos);
  const routing = usePcbStore((s) => s.routing);
  const pendingFootprint = usePcbStore((s) => s.pendingFootprint);
  const showDrcViolations = usePcbStore((s) => s.showDrcViolations);
  const showRatsnest = usePcbStore((s) => s.showRatsnest);
  const gridSize = usePcbStore((s) => s.gridSize);
  const snapToGrid = usePcbStore((s) => s.snapToGrid);

  // Store actions
  const pan = usePcbStore((s) => s.pan);
  const setZoom = usePcbStore((s) => s.setZoom);
  const setMousePos = usePcbStore((s) => s.setMousePos);
  const setTool = usePcbStore((s) => s.setTool);
  const setActiveLayer = usePcbStore((s) => s.setActiveLayer);
  const toggleLayerVisibility = usePcbStore((s) => s.toggleLayerVisibility);
  const selectInstance = usePcbStore((s) => s.selectInstance);
  const selectTrace = usePcbStore((s) => s.selectTrace);
  const clearSelection = usePcbStore((s) => s.clearSelection);
  const startRoute = usePcbStore((s) => s.startRoute);
  const addRoutePoint = usePcbStore((s) => s.addRoutePoint);
  const finishRoute = usePcbStore((s) => s.finishRoute);
  const cancelRoute = usePcbStore((s) => s.cancelRoute);
  const switchRouteLayer = usePcbStore((s) => s.switchRouteLayer);
  const placeViaAndSwitchLayer = usePcbStore((s) => s.placeViaAndSwitchLayer);
  const placeFootprint = usePcbStore((s) => s.placeFootprint);
  const cancelPlaceFootprint = usePcbStore((s) => s.cancelPlaceFootprint);
  const rotatePendingFootprint = usePcbStore((s) => s.rotatePendingFootprint);
  const flipPendingFootprint = usePcbStore((s) => s.flipPendingFootprint);
  const moveSelectedInstances = usePcbStore((s) => s.moveSelectedInstances);
  const getFootprint = usePcbStore((s) => s.getFootprint);
  const getInstance = usePcbStore((s) => s.getInstance);

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [lastPanPos, setLastPanPos] = useState<{ x: number; y: number } | null>(null);

  // Convert screen coords to PCB coords (mm)
  const screenToPcb = useCallback(
    (screenX: number, screenY: number): Vec2 => {
      const x = (screenX - canvasSize.width / 2 - viewOffset.x) / (zoom * PIXELS_PER_MM);
      const y = -(screenY - canvasSize.height / 2 - viewOffset.y) / (zoom * PIXELS_PER_MM);
      return [x, y];
    },
    [canvasSize, viewOffset, zoom]
  );

  // Convert PCB coords to screen coords
  const pcbToScreen = useCallback(
    (pcbX: number, pcbY: number): { x: number; y: number } => {
      const x = pcbX * zoom * PIXELS_PER_MM + canvasSize.width / 2 + viewOffset.x;
      const y = -pcbY * zoom * PIXELS_PER_MM + canvasSize.height / 2 + viewOffset.y;
      return { x, y };
    },
    [canvasSize, viewOffset, zoom]
  );

  // Snap point to grid
  const snapPoint = useCallback(
    (point: Vec2): Vec2 => {
      if (!snapToGrid) return point;
      return [
        Math.round(point[0] / gridSize) * gridSize,
        Math.round(point[1] / gridSize) * gridSize,
      ];
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
        if (routing) {
          cancelRoute();
        } else if (pendingFootprint) {
          cancelPlaceFootprint();
        } else {
          clearSelection();
        }
      } else if (e.key === "r" || e.key === "R") {
        if (pendingFootprint) {
          rotatePendingFootprint();
        }
      } else if (e.key === "f" || e.key === "F") {
        if (pendingFootprint) {
          flipPendingFootprint();
        }
      } else if (e.key === " ") {
        // Space to switch layer during routing
        if (routing) {
          e.preventDefault();
          switchRouteLayer();
        }
      } else if (e.key === "v" || e.key === "V") {
        if (routing) {
          // Place via and switch layer
          placeViaAndSwitchLayer();
        } else {
          setTool("select");
        }
      } else if (e.key === "x" || e.key === "X") {
        setTool("track");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [routing, pendingFootprint, cancelRoute, cancelPlaceFootprint, rotatePendingFootprint, flipPendingFootprint, switchRouteLayer, placeViaAndSwitchLayer, clearSelection, setTool]);

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
        const pcbPos = screenToPcb(screenX, screenY);
        const snappedPos = snapPoint(pcbPos);

        if (pendingFootprint) {
          // Place the pending footprint
          const fp = getFootprint(pendingFootprint.footprintId);
          const refDes = fp && pcb ? `U${pcb.instances.size + 1}` : "U?";
          placeFootprint(snappedPos, refDes);
        } else if (mode === "route") {
          if (routing) {
            // Add route point
            addRoutePoint(snappedPos);
          } else {
            // Start new route
            startRoute(snappedPos, null);
          }
        } else if (mode === "select") {
          if (!e.shiftKey) {
            clearSelection();
          }
          setIsDragging(true);
          setDragStart({ x: screenX, y: screenY });
        }
      }
    },
    [screenToPcb, snapPoint, mode, routing, pendingFootprint, pcb, getFootprint, placeFootprint, addRoutePoint, startRoute, clearSelection]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const pcbPos = screenToPcb(screenX, screenY);
      const snappedPos = snapPoint(pcbPos);
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
        const delta: Vec2 = [
          (currentScreen.x - dragStart.x) / (zoom * PIXELS_PER_MM),
          -(currentScreen.y - dragStart.y) / (zoom * PIXELS_PER_MM),
        ];
        if (Math.abs(delta[0]) > 0.1 || Math.abs(delta[1]) > 0.1) {
          moveSelectedInstances(snapPoint(delta));
          setDragStart(currentScreen);
        }
      }
    },
    [screenToPcb, snapPoint, setMousePos, isPanning, lastPanPos, pan, isDragging, dragStart, selectedInstances, zoom, moveSelectedInstances]
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
      if (routing) {
        finishRoute();
      }
    },
    [routing, finishRoute]
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
    if (!canvas || !pcb) return;

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

    // Draw board outline and fill
    if (pcb.boardOutline.outline.length > 0) {
      drawBoardOutline(ctx, pcb.boardOutline.outline, pcbToScreen);
    }

    // Draw copper pours (lowest layer)
    for (const pour of pcb.copperPours.values()) {
      const layer = pcb.layers.get(pour.layerId);
      if (!layer || !layerVisibility.get(pour.layerId)) continue;
      drawCopperPour(ctx, pour, layer, pcbToScreen);
    }

    // Draw traces
    for (const trace of pcb.traces.values()) {
      const layer = pcb.layers.get(trace.layerId);
      if (!layer || !layerVisibility.get(trace.layerId)) continue;
      const isSelected = selectedTraces.has(trace.id);
      const isHovered = hoveredTrace === trace.id;
      drawTrace(ctx, trace, layer, pcbToScreen, zoom, isSelected, isHovered);
    }

    // Draw vias
    for (const via of pcb.vias.values()) {
      const isSelected = selectedVias.has(via.id);
      const isHovered = hoveredVia === via.id;
      drawVia(ctx, via, pcbToScreen, zoom, isSelected, isHovered);
    }

    // Draw footprint instances
    for (const instance of pcb.instances.values()) {
      const footprint = pcb.footprints.get(instance.footprintId);
      if (!footprint) continue;
      const isSelected = selectedInstances.has(instance.id);
      const isHovered = hoveredInstance === instance.id;
      drawFootprintInstance(ctx, instance, footprint, pcb.layers, layerVisibility, pcbToScreen, zoom, isSelected, isHovered);
    }

    // Draw ratsnest
    if (showRatsnest) {
      for (const net of pcb.nets.values()) {
        if (net.ratsnest) {
          drawRatsnest(ctx, net.ratsnest, pcbToScreen);
        }
      }
    }

    // Draw DRC violations
    if (showDrcViolations && pcb.drcViolations) {
      for (const violation of pcb.drcViolations) {
        drawDrcViolation(ctx, violation, pcbToScreen, zoom);
      }
    }

    // Draw route in progress
    if (routing && routing.points.length > 0 && routing.layerId) {
      const layer = pcb.layers.get(routing.layerId);
      if (layer) {
        const color = getLayerColor(layer);
        ctx.strokeStyle = color;
        ctx.lineWidth = routing.traceWidth * zoom * PIXELS_PER_MM;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        const firstPt = pcbToScreen(routing.points[0][0], routing.points[0][1]);
        ctx.moveTo(firstPt.x, firstPt.y);

        for (let i = 1; i < routing.points.length; i++) {
          const pt = pcbToScreen(routing.points[i][0], routing.points[i][1]);
          ctx.lineTo(pt.x, pt.y);
        }

        // Draw to current mouse position
        if (mousePos) {
          const mousePt = pcbToScreen(mousePos[0], mousePos[1]);
          ctx.lineTo(mousePt.x, mousePt.y);
        }

        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw pending footprint preview
    if (pendingFootprint && mousePos) {
      const footprint = getFootprint(pendingFootprint.footprintId);
      if (footprint) {
        ctx.globalAlpha = 0.6;
        const previewInstance: FootprintInstance = {
          id: "" as any,
          footprintId: pendingFootprint.footprintId,
          position: mousePos,
          rotation: pendingFootprint.rotation,
          side: pendingFootprint.side,
          locked: false,
          refDes: "?",
          value: "",
          padNets: new Map(),
          properties: new Map(),
          refDesVisible: true,
          valueVisible: true,
        };
        drawFootprintInstance(ctx, previewInstance, footprint, pcb.layers, layerVisibility, pcbToScreen, zoom, false, false);
        ctx.globalAlpha = 1.0;
      }
    }

    // Draw cursor crosshair
    if (mousePos) {
      const cursor = pcbToScreen(mousePos[0], mousePos[1]);
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
    pcb,
    layerVisibility,
    selectedInstances,
    selectedTraces,
    selectedVias,
    hoveredInstance,
    hoveredTrace,
    hoveredVia,
    routing,
    pendingFootprint,
    mousePos,
    showDrcViolations,
    showRatsnest,
    pcbToScreen,
    getFootprint,
  ]);

  // Show loading state if PCB is not initialized yet
  if (!pcb) {
    return (
      <div ref={containerRef} style={{ ...styles.container, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#888" }}>Loading PCB...</span>
      </div>
    );
  }

  // Get visible layers for layer panel
  const visibleLayers = Array.from(pcb.layers.entries()).filter(([_, layer]) => true);

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
            ...(activeTool === "track" ? styles.activeToolButton : {}),
          }}
          onClick={() => setTool("track")}
          title="Route Track (X)"
        >
          X
        </button>
      </div>

      {/* Layer panel */}
      <div style={styles.layerPanel}>
        <div style={{ color: "#fff", fontSize: 12, marginBottom: 8, fontWeight: "bold" }}>
          Layers
        </div>
        {visibleLayers.map(([layerId, layer]) => (
          <div
            key={layerId}
            style={{
              ...styles.layerItem,
              opacity: layerVisibility.get(layerId) ? 1 : 0.5,
              backgroundColor: activeLayer === layerId ? "rgba(77, 171, 247, 0.3)" : "transparent",
            }}
            onClick={() => setActiveLayer(layerId)}
            onDoubleClick={() => toggleLayerVisibility(layerId)}
          >
            <div
              style={{
                ...styles.layerColor,
                backgroundColor: getLayerColor(layer),
              }}
            />
            <span style={{ color: "#fff" }}>{layer.name}</span>
          </div>
        ))}
      </div>

      {/* Status hint */}
      <div style={styles.hint}>
        {getHint(mode, routing !== null, pendingFootprint !== null)}
      </div>

      {/* Coordinates */}
      <div style={styles.coords}>
        {mousePos
          ? `X: ${mousePos[0].toFixed(2)}mm, Y: ${mousePos[1].toFixed(2)}mm`
          : ""}
        {activeLayer && pcb.layers.get(activeLayer)
          ? ` | Layer: ${pcb.layers.get(activeLayer)!.name}`
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
  const gridSpacing = gridSize * zoom * PIXELS_PER_MM;

  // Don't draw grid if too zoomed out
  if (gridSpacing < 5) return;

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

  // Draw major grid (every 5mm)
  const majorSpacing = 5 * zoom * PIXELS_PER_MM;
  if (majorSpacing >= 20) {
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

function drawBoardOutline(
  ctx: CanvasRenderingContext2D,
  outline: Vec2[],
  toScreen: (x: number, y: number) => { x: number; y: number }
) {
  if (outline.length < 3) return;

  // Fill board area
  ctx.fillStyle = BOARD_FILL_COLOR;
  ctx.beginPath();
  const first = toScreen(outline[0][0], outline[0][1]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < outline.length; i++) {
    const pt = toScreen(outline[i][0], outline[i][1]);
    ctx.lineTo(pt.x, pt.y);
  }
  ctx.closePath();
  ctx.fill();

  // Draw outline
  ctx.strokeStyle = BOARD_OUTLINE_COLOR;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTrace(
  ctx: CanvasRenderingContext2D,
  trace: Trace,
  layer: Layer,
  toScreen: (x: number, y: number) => { x: number; y: number },
  zoom: number,
  isSelected: boolean,
  isHovered: boolean
) {
  if (trace.segments.length === 0) return;

  const color = isSelected ? SELECTED_COLOR : isHovered ? HOVER_COLOR : getLayerColor(layer);
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const seg of trace.segments) {
    ctx.lineWidth = seg.width * zoom * PIXELS_PER_MM;
    ctx.beginPath();
    const start = toScreen(seg.start[0], seg.start[1]);
    const end = toScreen(seg.end[0], seg.end[1]);
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
}

function drawVia(
  ctx: CanvasRenderingContext2D,
  via: Via,
  toScreen: (x: number, y: number) => { x: number; y: number },
  zoom: number,
  isSelected: boolean,
  isHovered: boolean
) {
  const pos = toScreen(via.position[0], via.position[1]);
  const outerRadius = (via.diameter / 2) * zoom * PIXELS_PER_MM;
  const innerRadius = (via.drillDiameter / 2) * zoom * PIXELS_PER_MM;

  // Draw via outer (copper annular ring)
  ctx.fillStyle = isSelected ? SELECTED_COLOR : isHovered ? HOVER_COLOR : PAD_COLOR;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, outerRadius, 0, Math.PI * 2);
  ctx.fill();

  // Draw drill hole
  ctx.fillStyle = DRILL_COLOR;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, innerRadius, 0, Math.PI * 2);
  ctx.fill();
}

function drawCopperPour(
  ctx: CanvasRenderingContext2D,
  pour: CopperPour,
  layer: Layer,
  toScreen: (x: number, y: number) => { x: number; y: number }
) {
  if (pour.outline.length < 3) return;

  const color = getLayerColor(layer);
  ctx.fillStyle = color + "44"; // Add transparency
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  ctx.beginPath();
  const first = toScreen(pour.outline[0][0], pour.outline[0][1]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pour.outline.length; i++) {
    const pt = toScreen(pour.outline[i][0], pour.outline[i][1]);
    ctx.lineTo(pt.x, pt.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawFootprintInstance(
  ctx: CanvasRenderingContext2D,
  instance: FootprintInstance,
  footprint: Footprint,
  layers: Map<LayerId, Layer>,
  layerVisibility: Map<LayerId, boolean>,
  toScreen: (x: number, y: number) => { x: number; y: number },
  zoom: number,
  isSelected: boolean,
  isHovered: boolean
) {
  ctx.save();

  const pos = toScreen(instance.position[0], instance.position[1]);
  ctx.translate(pos.x, pos.y);

  // Apply rotation (convert to canvas rotation direction)
  ctx.rotate((-instance.rotation * Math.PI) / 180);

  // Apply mirror for bottom side
  if (instance.side === "bottom") {
    ctx.scale(-1, 1);
  }

  const scale = zoom * PIXELS_PER_MM;

  // Draw pads
  for (const [padId, pad] of footprint.pads) {
    // Check layer visibility
    for (const layerId of pad.layers) {
      if (!layerVisibility.get(layerId)) continue;
    }

    const padColor = isSelected ? SELECTED_COLOR : isHovered ? HOVER_COLOR : PAD_COLOR;
    ctx.fillStyle = padColor;

    const padX = pad.position[0] * scale;
    const padY = -pad.position[1] * scale;
    // Get size from pad.shape (width/height for rect, diameter for circle)
    const padW = (pad.shape.width || pad.shape.diameter || 1) * scale;
    const padH = (pad.shape.height || pad.shape.diameter || 1) * scale;

    if (pad.shape.type === "rect") {
      ctx.fillRect(padX - padW / 2, padY - padH / 2, padW, padH);
    } else if (pad.shape.type === "circle" || pad.shape.type === "oval") {
      ctx.beginPath();
      ctx.ellipse(padX, padY, padW / 2, padH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (pad.shape.type === "roundrect") {
      const radius = Math.min(padW, padH) * (pad.shape.cornerRadius || 0.25);
      roundRect(ctx, padX - padW / 2, padY - padH / 2, padW, padH, radius);
      ctx.fill();
    }

    // Draw drill hole for through-hole pads
    if (pad.drill) {
      ctx.fillStyle = DRILL_COLOR;
      const drillRadius = (pad.drill.diameter / 2) * scale;
      ctx.beginPath();
      ctx.arc(padX, padY, drillRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw graphics (silkscreen, etc.)
  // footprint.graphics is Map<LayerId, FootprintGraphic[]>
  for (const [layerId, graphicsList] of footprint.graphics) {
    const layer = layers.get(layerId);
    if (!layer || !layerVisibility.get(layerId)) continue;

    ctx.strokeStyle = getLayerColor(layer);

    for (const graphic of graphicsList) {
      // FootprintText has thickness instead of width
      const lineWidth = graphic.type === "text" ? graphic.thickness : graphic.width;
      ctx.lineWidth = (lineWidth || 0.15) * scale;

      if (graphic.type === "line") {
        ctx.beginPath();
        ctx.moveTo(graphic.start[0] * scale, -graphic.start[1] * scale);
        ctx.lineTo(graphic.end[0] * scale, -graphic.end[1] * scale);
        ctx.stroke();
      } else if (graphic.type === "circle") {
        ctx.beginPath();
        ctx.arc(
          graphic.center[0] * scale,
          -graphic.center[1] * scale,
          graphic.radius * scale,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      } else if (graphic.type === "rect") {
        ctx.strokeRect(
          graphic.corner1[0] * scale,
          -graphic.corner1[1] * scale,
          (graphic.corner2[0] - graphic.corner1[0]) * scale,
          -(graphic.corner2[1] - graphic.corner1[1]) * scale
        );
      } else if (graphic.type === "arc") {
        ctx.beginPath();
        ctx.arc(
          graphic.center[0] * scale,
          -graphic.center[1] * scale,
          graphic.radius * scale,
          (-graphic.startAngle * Math.PI) / 180,
          (-graphic.endAngle * Math.PI) / 180,
          true
        );
        ctx.stroke();
      } else if (graphic.type === "polygon") {
        if (graphic.points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(graphic.points[0][0] * scale, -graphic.points[0][1] * scale);
          for (let i = 1; i < graphic.points.length; i++) {
            ctx.lineTo(graphic.points[i][0] * scale, -graphic.points[i][1] * scale);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
    }
  }

  ctx.restore();

  // Draw reference designator (outside of transform)
  if (instance.refDesVisible && instance.refDes) {
    const labelColor = isSelected ? SELECTED_COLOR : isHovered ? HOVER_COLOR : "#ffffff";
    ctx.fillStyle = labelColor;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(instance.refDes, pos.x, pos.y - 20);
  }
}

function drawRatsnest(
  ctx: CanvasRenderingContext2D,
  ratsnest: Array<{ from: Vec2; to: Vec2 }>,
  toScreen: (x: number, y: number) => { x: number; y: number }
) {
  ctx.strokeStyle = RATSNEST_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);

  for (const line of ratsnest) {
    const from = toScreen(line.from[0], line.from[1]);
    const to = toScreen(line.to[0], line.to[1]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

function drawDrcViolation(
  ctx: CanvasRenderingContext2D,
  violation: DrcViolation,
  toScreen: (x: number, y: number) => { x: number; y: number },
  zoom: number
) {
  const pos = toScreen(violation.location[0], violation.location[1]);

  // Draw violation marker
  ctx.strokeStyle = DRC_VIOLATION_COLOR;
  ctx.lineWidth = 2;

  // Draw X
  const size = 10;
  ctx.beginPath();
  ctx.moveTo(pos.x - size, pos.y - size);
  ctx.lineTo(pos.x + size, pos.y + size);
  ctx.moveTo(pos.x + size, pos.y - size);
  ctx.lineTo(pos.x - size, pos.y + size);
  ctx.stroke();

  // Draw circle around it
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, size + 5, 0, Math.PI * 2);
  ctx.stroke();
}

// Helper to draw rounded rectangle
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default PcbCanvas;
