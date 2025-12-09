/**
 * DrawingToolbar - Horizontal toolbar for the drawing editor.
 *
 * Provides tools for adding views, dimensions, and annotations.
 * Follows the same pattern as PcbToolbar and SchematicToolbar.
 */

import React, { useState } from "react";
import { useDrawingStore, DrawingTool } from "../../store/drawing-store";

// ============================================================================
// Tool Definitions
// ============================================================================

interface Tool {
  id: DrawingTool;
  label: string;
  icon: string;
  shortcut?: string;
  group: "select" | "dimension" | "annotation";
}

const TOOLS: Tool[] = [
  // Selection
  { id: "select", label: "Select", icon: "⎋", shortcut: "V", group: "select" },
  { id: "pan", label: "Pan", icon: "☰", shortcut: "H", group: "select" },

  // Dimensions
  { id: "dim-linear", label: "Linear", icon: "↔", shortcut: "D", group: "dimension" },
  { id: "dim-diameter", label: "Diameter", icon: "⌀", group: "dimension" },
  { id: "dim-radius", label: "Radius", icon: "R", group: "dimension" },
  { id: "dim-angle", label: "Angle", icon: "∠", group: "dimension" },

  // Annotations
  { id: "text", label: "Text", icon: "A", shortcut: "T", group: "annotation" },
  { id: "note", label: "Note", icon: "✉", group: "annotation" },
  { id: "balloon", label: "Balloon", icon: "⓪", group: "annotation" },
];

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    height: "100%",
    flex: 1,
    gap: 8,
  } as React.CSSProperties,

  divider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    margin: "0 8px",
  } as React.CSSProperties,

  toolGroup: {
    display: "flex",
    alignItems: "center",
    gap: 2,
  } as React.CSSProperties,

  toolButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 8px",
    border: "none",
    borderRadius: 4,
    backgroundColor: "transparent",
    color: "#aaa",
    cursor: "pointer",
    minWidth: 40,
    fontSize: 16,
    transition: "background-color 0.15s, color 0.15s",
  } as React.CSSProperties,

  toolButtonActive: {
    backgroundColor: "#646cff",
    color: "#fff",
  } as React.CSSProperties,

  toolLabel: {
    fontSize: 9,
    marginTop: 2,
    opacity: 0.7,
  } as React.CSSProperties,

  actionButton: {
    padding: "6px 12px",
    border: "none",
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "#aaa",
    cursor: "pointer",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 6,
  } as React.CSSProperties,

  spacer: {
    flex: 1,
  } as React.CSSProperties,
};

// ============================================================================
// Props
// ============================================================================

interface DrawingToolbarProps {
  onAddView?: () => void;
  onRecompute?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function DrawingToolbar({ onAddView, onRecompute }: DrawingToolbarProps) {
  const activeTool = useDrawingStore((s) => s.activeTool);
  const setActiveTool = useDrawingStore((s) => s.setActiveTool);
  const deleteSelected = useDrawingStore((s) => s.deleteSelected);
  const selectedViews = useDrawingStore((s) => s.selectedViews);
  const selectedDimensions = useDrawingStore((s) => s.selectedDimensions);
  const selectedAnnotations = useDrawingStore((s) => s.selectedAnnotations);
  const isRecomputing = useDrawingStore((s) => s.isRecomputing);
  const recomputeViews = useDrawingStore((s) => s.recomputeViews);

  const [hoveredTool, setHoveredTool] = useState<string | null>(null);

  const hasSelection =
    selectedViews.size > 0 || selectedDimensions.size > 0 || selectedAnnotations.size > 0;

  const handleRecompute = () => {
    if (onRecompute) {
      onRecompute();
    } else {
      recomputeViews();
    }
  };

  // Group tools
  const selectTools = TOOLS.filter((t) => t.group === "select");
  const dimensionTools = TOOLS.filter((t) => t.group === "dimension");
  const annotationTools = TOOLS.filter((t) => t.group === "annotation");

  const renderToolButton = (tool: Tool) => (
    <button
      key={tool.id}
      style={{
        ...styles.toolButton,
        ...(activeTool === tool.id ? styles.toolButtonActive : {}),
        ...(hoveredTool === tool.id && activeTool !== tool.id
          ? { backgroundColor: "#333", color: "#fff" }
          : {}),
      }}
      onClick={() => setActiveTool(tool.id)}
      onMouseEnter={() => setHoveredTool(tool.id)}
      onMouseLeave={() => setHoveredTool(null)}
      title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ""}`}
    >
      <span>{tool.icon}</span>
      <span style={styles.toolLabel}>{tool.label}</span>
    </button>
  );

  return (
    <div style={styles.container}>
      {/* Selection Tools */}
      <div style={styles.toolGroup}>{selectTools.map(renderToolButton)}</div>

      <div style={styles.divider} />

      {/* View Actions */}
      <button
        style={{
          ...styles.actionButton,
          ...(hoveredTool === "add-view" ? { backgroundColor: "#333", color: "#fff" } : {}),
        }}
        onClick={onAddView}
        onMouseEnter={() => setHoveredTool("add-view")}
        onMouseLeave={() => setHoveredTool(null)}
        title="Add View"
      >
        <span>⊞</span>
        <span>Add View</span>
      </button>

      <button
        style={{
          ...styles.actionButton,
          ...(isRecomputing ? { opacity: 0.5, cursor: "not-allowed" } : {}),
          ...(hoveredTool === "recompute" && !isRecomputing
            ? { backgroundColor: "#333", color: "#fff" }
            : {}),
        }}
        onClick={isRecomputing ? undefined : handleRecompute}
        onMouseEnter={() => setHoveredTool("recompute")}
        onMouseLeave={() => setHoveredTool(null)}
        disabled={isRecomputing}
        title="Recompute Views"
      >
        <span>↻</span>
        <span>{isRecomputing ? "Computing..." : "Recompute"}</span>
      </button>

      <div style={styles.divider} />

      {/* Dimension Tools */}
      <div style={styles.toolGroup}>{dimensionTools.map(renderToolButton)}</div>

      <div style={styles.divider} />

      {/* Annotation Tools */}
      <div style={styles.toolGroup}>{annotationTools.map(renderToolButton)}</div>

      <div style={styles.spacer} />

      {/* Delete */}
      <button
        style={{
          ...styles.actionButton,
          ...(hasSelection ? {} : { opacity: 0.5, cursor: "not-allowed" }),
          ...(hoveredTool === "delete" && hasSelection
            ? { backgroundColor: "#ff6b6b", color: "#fff" }
            : {}),
        }}
        onClick={hasSelection ? deleteSelected : undefined}
        onMouseEnter={() => setHoveredTool("delete")}
        onMouseLeave={() => setHoveredTool(null)}
        disabled={!hasSelection}
        title="Delete Selected (Del)"
      >
        <span>✖</span>
        <span>Delete</span>
      </button>
    </div>
  );
}

export default DrawingToolbar;
