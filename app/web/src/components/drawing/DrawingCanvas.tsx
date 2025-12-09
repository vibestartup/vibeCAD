/**
 * DrawingCanvas - SVG-based 2D drawing editor component.
 *
 * Renders the drawing sheet with views, dimensions, and annotations.
 * Handles pan/zoom, selection, and editing interactions.
 */

import React, { useRef, useState, useCallback, useEffect } from "react";
import { useDrawingStore } from "../../store/drawing-store";
import type {
  Drawing,
  DrawingView,
  DrawingDimension,
  DrawingAnnotation,
  DrawingViewId,
  Vec2,
} from "@vibecad/core";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    width: "100%",
    height: "100%",
    backgroundColor: "#2a2a3a",
    overflow: "hidden",
    position: "relative" as const,
  },
  svg: {
    width: "100%",
    height: "100%",
    cursor: "default",
  },
  sheet: {
    fill: "#ffffff",
    stroke: "#000000",
    strokeWidth: 0.5,
  },
  sheetShadow: {
    fill: "rgba(0, 0, 0, 0.3)",
  },
  margin: {
    stroke: "#cccccc",
    strokeWidth: 0.25,
    strokeDasharray: "2,2",
    fill: "none",
  },
  viewBorder: {
    stroke: "#0066cc",
    strokeWidth: 0.5,
    fill: "none",
  },
  viewBorderSelected: {
    stroke: "#ff6600",
    strokeWidth: 1,
    fill: "rgba(255, 102, 0, 0.1)",
  },
  viewBorderHovered: {
    stroke: "#0099ff",
    strokeWidth: 0.75,
    fill: "rgba(0, 153, 255, 0.05)",
  },
  dimensionLine: {
    stroke: "#000000",
    strokeWidth: 0.35,
    fill: "none",
  },
  dimensionText: {
    fontSize: 3.5,
    fontFamily: "sans-serif",
    fill: "#000000",
    textAnchor: "middle" as const,
    dominantBaseline: "middle" as const,
  },
  annotationText: {
    fontSize: 3.5,
    fontFamily: "sans-serif",
    fill: "#000000",
  },
  projectedEdge: {
    stroke: "#000000",
    strokeWidth: 0.35,
    fill: "none",
  },
  projectedEdgeHidden: {
    stroke: "#000000",
    strokeWidth: 0.25,
    strokeDasharray: "1.5,1",
    fill: "none",
  },
  centerline: {
    stroke: "#cc0000",
    strokeWidth: 0.25,
    strokeDasharray: "8,2,2,2",
    fill: "none",
  },
  titleBlock: {
    stroke: "#000000",
    strokeWidth: 0.5,
    fill: "none",
  },
  grid: {
    stroke: "#e0e0e0",
    strokeWidth: 0.1,
  },
};

// ============================================================================
// Helper Components
// ============================================================================

interface ViewRendererProps {
  view: DrawingView;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
}

function ViewRenderer({ view, isSelected, isHovered, onSelect, onHover }: ViewRendererProps) {
  // For now, render a placeholder rectangle for the view
  // Real implementation would render projected edges from view.projectionResult
  const size = 80 * view.scale; // Placeholder size

  const borderStyle = isSelected
    ? styles.viewBorderSelected
    : isHovered
    ? styles.viewBorderHovered
    : styles.viewBorder;

  return (
    <g
      transform={`translate(${view.position[0]}, ${view.position[1]}) rotate(${view.rotation})`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={{ cursor: "pointer" }}
    >
      {/* View bounding box */}
      <rect x={-size / 2} y={-size / 2} width={size} height={size} {...borderStyle} />

      {/* Projected edges placeholder */}
      {view.projectionResult ? (
        view.projectionResult.edges.map((edge, i) => (
          <polyline
            key={i}
            points={edge.points.map((p) => `${p[0]},${p[1]}`).join(" ")}
            {...(edge.type === "hidden" ? styles.projectedEdgeHidden : styles.projectedEdge)}
          />
        ))
      ) : (
        // Placeholder content when no projection
        <g>
          <line x1={-size / 3} y1={0} x2={size / 3} y2={0} {...styles.projectedEdge} />
          <line x1={0} y1={-size / 3} x2={0} y2={size / 3} {...styles.projectedEdge} />
          <text x={0} y={size / 2 + 5} {...styles.dimensionText} fontSize={2.5}>
            {view.projection.toUpperCase()} 1:{1 / view.scale}
          </text>
          <text x={0} y={-size / 2 - 3} {...styles.dimensionText} fontSize={2}>
            {view.sourceRef.path}
          </text>
        </g>
      )}

      {/* View label */}
      <text x={0} y={size / 2 + 10} {...styles.dimensionText} fontSize={3}>
        {view.name}
      </text>
    </g>
  );
}

interface DimensionRendererProps {
  dimension: DrawingDimension;
  isSelected: boolean;
  onSelect: () => void;
}

function DimensionRenderer({ dimension, isSelected, onSelect }: DimensionRendererProps) {
  if (dimension.type !== "linear") return null;

  const { point1, point2, offset, direction } = dimension;
  if (!point1.explicit || !point2.explicit) return null;

  const p1 = point1.explicit;
  const p2 = point2.explicit;

  // Calculate dimension line position
  let dimP1: Vec2, dimP2: Vec2;
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];

  if (direction === "horizontal") {
    dimP1 = [p1[0], p1[1] + offset];
    dimP2 = [p2[0], p2[1] + offset];
  } else if (direction === "vertical") {
    dimP1 = [p1[0] + offset, p1[1]];
    dimP2 = [p2[0] + offset, p2[1]];
  } else {
    // Aligned - perpendicular to line
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;
    const ny = dx / len;
    dimP1 = [p1[0] + nx * offset, p1[1] + ny * offset];
    dimP2 = [p2[0] + nx * offset, p2[1] + ny * offset];
  }

  // Calculate measured value
  let value: number;
  if (direction === "horizontal") {
    value = Math.abs(p2[0] - p1[0]);
  } else if (direction === "vertical") {
    value = Math.abs(p2[1] - p1[1]);
  } else {
    value = Math.sqrt(dx * dx + dy * dy);
  }

  const midX = (dimP1[0] + dimP2[0]) / 2;
  const midY = (dimP1[1] + dimP2[1]) / 2;

  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }}>
      {/* Extension lines */}
      <line x1={p1[0]} y1={p1[1]} x2={dimP1[0]} y2={dimP1[1]} {...styles.dimensionLine} />
      <line x1={p2[0]} y1={p2[1]} x2={dimP2[0]} y2={dimP2[1]} {...styles.dimensionLine} />

      {/* Dimension line */}
      <line
        x1={dimP1[0]}
        y1={dimP1[1]}
        x2={dimP2[0]}
        y2={dimP2[1]}
        {...styles.dimensionLine}
        stroke={isSelected ? "#ff6600" : "#000000"}
      />

      {/* Arrows */}
      <ArrowHead x={dimP1[0]} y={dimP1[1]} angle={Math.atan2(dimP2[1] - dimP1[1], dimP2[0] - dimP1[0])} />
      <ArrowHead x={dimP2[0]} y={dimP2[1]} angle={Math.atan2(dimP1[1] - dimP2[1], dimP1[0] - dimP2[0])} />

      {/* Value text */}
      <text x={midX + dimension.labelOffset[0]} y={midY + dimension.labelOffset[1] - 1.5} {...styles.dimensionText}>
        {value.toFixed(2)}
      </text>
    </g>
  );
}

function ArrowHead({ x, y, angle, size = 2.5 }: { x: number; y: number; angle: number; size?: number }) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x1 = x - size * cos + (size / 3) * sin;
  const y1 = y - size * sin - (size / 3) * cos;
  const x2 = x - size * cos - (size / 3) * sin;
  const y2 = y - size * sin + (size / 3) * cos;

  return <polygon points={`${x},${y} ${x1},${y1} ${x2},${y2}`} fill="#000000" />;
}

interface AnnotationRendererProps {
  annotation: DrawingAnnotation;
  isSelected: boolean;
  onSelect: () => void;
}

function AnnotationRenderer({ annotation, isSelected, onSelect }: AnnotationRendererProps) {
  if (annotation.type === "text") {
    return (
      <text
        x={annotation.position[0]}
        y={annotation.position[1]}
        {...styles.annotationText}
        fontSize={annotation.fontSize}
        textAnchor={annotation.alignment === "center" ? "middle" : annotation.alignment === "right" ? "end" : "start"}
        transform={`rotate(${annotation.rotation}, ${annotation.position[0]}, ${annotation.position[1]})`}
        onClick={onSelect}
        style={{ cursor: "pointer" }}
        fill={isSelected ? "#ff6600" : "#000000"}
      >
        {annotation.text}
      </text>
    );
  }

  if (annotation.type === "note") {
    return (
      <g onClick={onSelect} style={{ cursor: "pointer" }}>
        {annotation.leader && annotation.leader.attachPoint.explicit && (
          <line
            x1={annotation.position[0]}
            y1={annotation.position[1]}
            x2={annotation.leader.attachPoint.explicit[0]}
            y2={annotation.leader.attachPoint.explicit[1]}
            {...styles.dimensionLine}
          />
        )}
        <text
          x={annotation.position[0]}
          y={annotation.position[1]}
          {...styles.annotationText}
          fontSize={annotation.fontSize}
          fill={isSelected ? "#ff6600" : "#000000"}
        >
          {annotation.text}
        </text>
      </g>
    );
  }

  return null;
}

// ============================================================================
// Main Component
// ============================================================================

export function DrawingCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Vec2>([0, 0]);

  const drawing = useDrawingStore((s) => s.drawing);
  const sheetZoom = useDrawingStore((s) => s.sheetZoom);
  const sheetPan = useDrawingStore((s) => s.sheetPan);
  const setSheetZoom = useDrawingStore((s) => s.setSheetZoom);
  const setSheetPan = useDrawingStore((s) => s.setSheetPan);
  const selectedViews = useDrawingStore((s) => s.selectedViews);
  const selectedDimensions = useDrawingStore((s) => s.selectedDimensions);
  const selectedAnnotations = useDrawingStore((s) => s.selectedAnnotations);
  const hoveredView = useDrawingStore((s) => s.hoveredView);
  const selectView = useDrawingStore((s) => s.selectView);
  const selectDimension = useDrawingStore((s) => s.selectDimension);
  const selectAnnotation = useDrawingStore((s) => s.selectAnnotation);
  const clearSelection = useDrawingStore((s) => s.clearSelection);
  const setHoveredView = useDrawingStore((s) => s.setHoveredView);
  const editorMode = useDrawingStore((s) => s.editorMode);
  const pendingViewPlacement = useDrawingStore((s) => s.pendingViewPlacement);
  const confirmViewPlacement = useDrawingStore((s) => s.confirmViewPlacement);

  // Get sheet dimensions, with fallback for null drawing
  const sheet = drawing?.sheet ?? { width: 420, height: 297, margins: { top: 10, bottom: 10, left: 10, right: 10 }, size: "A3" as const, orientation: "landscape" as const };

  // Convert screen coordinates to sheet coordinates
  const screenToSheet = useCallback(
    (screenX: number, screenY: number): Vec2 => {
      if (!svgRef.current) return [0, 0];
      const rect = svgRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const x = (screenX - rect.left - centerX) / sheetZoom - sheetPan[0] + sheet.width / 2;
      const y = (screenY - rect.top - centerY) / sheetZoom - sheetPan[1] + sheet.height / 2;
      return [x, y];
    },
    [sheetZoom, sheetPan, sheet.width, sheet.height]
  );

  // Handle wheel zoom (use native event listener for non-passive behavior)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const currentZoom = useDrawingStore.getState().sheetZoom;
      setSheetZoom(currentZoom * delta);
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [setSheetZoom]);

  // Handle pan
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        // Middle mouse or Alt+left click for pan
        setIsPanning(true);
        setPanStart([e.clientX - sheetPan[0] * sheetZoom, e.clientY - sheetPan[1] * sheetZoom]);
      } else if (e.button === 0 && editorMode === "place-view" && pendingViewPlacement) {
        // Place view on click
        const pos = screenToSheet(e.clientX, e.clientY);
        confirmViewPlacement(pos);
      } else if (e.button === 0) {
        // Left click - clear selection if clicking on background
        clearSelection();
      }
    },
    [sheetPan, sheetZoom, editorMode, pendingViewPlacement, confirmViewPlacement, clearSelection, screenToSheet]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const newPanX = (e.clientX - panStart[0]) / sheetZoom;
        const newPanY = (e.clientY - panStart[1]) / sheetZoom;
        setSheetPan([newPanX, newPanY]);
      }
    },
    [isPanning, panStart, sheetZoom, setSheetPan]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Calculate viewBox to center the sheet
  const viewBoxWidth = sheet.width + 40;
  const viewBoxHeight = sheet.height + 40;
  const viewBoxX = -20 - sheetPan[0];
  const viewBoxY = -20 - sheetPan[1];

  return (
    <div style={styles.container}>
      <svg
        ref={svgRef}
        style={{
          ...styles.svg,
          cursor: isPanning ? "grabbing" : editorMode === "place-view" ? "crosshair" : "default",
        }}
        viewBox={`${viewBoxX / sheetZoom} ${viewBoxY / sheetZoom} ${viewBoxWidth / sheetZoom} ${viewBoxHeight / sheetZoom}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Sheet shadow */}
        <rect x={3} y={3} width={sheet.width} height={sheet.height} {...styles.sheetShadow} />

        {/* Sheet background */}
        <rect x={0} y={0} width={sheet.width} height={sheet.height} {...styles.sheet} />

        {/* Margins */}
        <rect
          x={sheet.margins.left}
          y={sheet.margins.top}
          width={sheet.width - sheet.margins.left - sheet.margins.right}
          height={sheet.height - sheet.margins.top - sheet.margins.bottom}
          {...styles.margin}
        />

        {/* Grid (optional) */}
        <g opacity={0.5}>
          {Array.from({ length: Math.floor(sheet.width / 10) + 1 }, (_, i) => (
            <line key={`v${i}`} x1={i * 10} y1={0} x2={i * 10} y2={sheet.height} {...styles.grid} />
          ))}
          {Array.from({ length: Math.floor(sheet.height / 10) + 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 10} x2={sheet.width} y2={i * 10} {...styles.grid} />
          ))}
        </g>

        {/* Views */}
        {drawing && Array.from(drawing.views.values()).map((view) => (
          <ViewRenderer
            key={view.id}
            view={view}
            isSelected={selectedViews.has(view.id)}
            isHovered={hoveredView === view.id}
            onSelect={() => selectView(view.id)}
            onHover={(hovered) => setHoveredView(hovered ? view.id : null)}
          />
        ))}

        {/* Dimensions */}
        {drawing && Array.from(drawing.dimensions.values()).map((dim) => (
          <DimensionRenderer
            key={dim.id}
            dimension={dim}
            isSelected={selectedDimensions.has(dim.id)}
            onSelect={() => selectDimension(dim.id)}
          />
        ))}

        {/* Annotations */}
        {drawing && Array.from(drawing.annotations.values()).map((ann) => (
          <AnnotationRenderer
            key={ann.id}
            annotation={ann}
            isSelected={selectedAnnotations.has(ann.id)}
            onSelect={() => selectAnnotation(ann.id)}
          />
        ))}

        {/* Title block placeholder */}
        <g transform={`translate(${sheet.width - 180}, ${sheet.height - 50})`}>
          <rect x={0} y={0} width={170} height={40} {...styles.titleBlock} />
          <line x1={0} y1={20} x2={170} y2={20} {...styles.titleBlock} />
          <line x1={85} y1={0} x2={85} y2={20} {...styles.titleBlock} />
          <text x={5} y={12} fontSize={3} fontFamily="sans-serif">
            {drawing?.name || "Untitled"}
          </text>
          <text x={90} y={12} fontSize={2.5} fontFamily="sans-serif">
            Scale: {sheet.size}
          </text>
          <text x={5} y={32} fontSize={2.5} fontFamily="sans-serif">
            {drawing?.titleBlock?.drawnBy || "vibeCAD"}
          </text>
        </g>

        {/* Pending view placement preview */}
        {pendingViewPlacement && (
          <g opacity={0.5}>
            <rect
              x={sheet.width / 2 - 40}
              y={sheet.height / 2 - 40}
              width={80}
              height={80}
              stroke="#0066cc"
              strokeWidth={1}
              strokeDasharray="4,4"
              fill="rgba(0, 102, 204, 0.1)"
            />
            <text x={sheet.width / 2} y={sheet.height / 2} {...styles.dimensionText}>
              Click to place view
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

export default DrawingCanvas;
