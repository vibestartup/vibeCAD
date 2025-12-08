/**
 * DrawingToolbar - Tool palette for the drawing editor.
 *
 * Provides tools for adding views, dimensions, and annotations.
 */

import React, { useState } from "react";
import { useDrawingStore, DrawingTool } from "../../store/drawing-store";
import type { ViewProjection, DrawingSheetSize as SheetSize } from "@vibecad/core";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    padding: 8,
    backgroundColor: "#1a1a2e",
    borderRight: "1px solid #333",
    width: 48,
    alignItems: "center",
  },
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    width: "100%",
  },
  sectionLabel: {
    fontSize: 9,
    color: "#666",
    textAlign: "center" as const,
    marginBottom: 2,
  },
  button: {
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    border: "1px solid transparent",
    borderRadius: 4,
    color: "#888",
    fontSize: 16,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  buttonHover: {
    backgroundColor: "#252545",
    color: "#fff",
    border: "1px solid #444",
  },
  buttonActive: {
    backgroundColor: "#3a3a5a",
    color: "#fff",
    border: "1px solid #646cff",
  },
  divider: {
    width: "80%",
    height: 1,
    backgroundColor: "#333",
    margin: "4px 0",
  },
  tooltip: {
    position: "fixed" as const,
    backgroundColor: "#1a1a2e",
    border: "1px solid #444",
    borderRadius: 4,
    padding: "4px 8px",
    fontSize: 11,
    color: "#fff",
    whiteSpace: "nowrap" as const,
    zIndex: 1000,
    pointerEvents: "none" as const,
  },
};

// ============================================================================
// Tool Button Component
// ============================================================================

interface ToolButtonProps {
  icon: string;
  label: string;
  tool: DrawingTool;
  activeTool: DrawingTool;
  onClick: () => void;
}

function ToolButton({ icon, label, tool, activeTool, onClick }: ToolButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const isActive = tool === activeTool;

  const handleMouseEnter = (e: React.MouseEvent) => {
    setIsHovered(true);
    setTooltipPos({ x: e.clientX + 10, y: e.clientY });
  };

  return (
    <>
      <button
        style={{
          ...styles.button,
          ...(isActive ? styles.buttonActive : {}),
          ...(isHovered && !isActive ? styles.buttonHover : {}),
        }}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsHovered(false)}
        title={label}
      >
        {icon}
      </button>
      {isHovered && (
        <div style={{ ...styles.tooltip, left: tooltipPos.x + 20, top: tooltipPos.y - 10 }}>{label}</div>
      )}
    </>
  );
}

// ============================================================================
// Action Button Component
// ============================================================================

interface ActionButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function ActionButton({ icon, label, onClick, disabled }: ActionButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      style={{
        ...styles.button,
        ...(isHovered && !disabled ? styles.buttonHover : {}),
        ...(disabled ? { opacity: 0.4, cursor: "not-allowed" } : {}),
      }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={label}
      disabled={disabled}
    >
      {icon}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface DrawingToolbarProps {
  onAddView?: () => void;
  onRecompute?: () => void;
}

export function DrawingToolbar({ onAddView, onRecompute }: DrawingToolbarProps) {
  const activeTool = useDrawingStore((s) => s.activeTool);
  const setActiveTool = useDrawingStore((s) => s.setActiveTool);
  const deleteSelected = useDrawingStore((s) => s.deleteSelected);
  const selectedViews = useDrawingStore((s) => s.selectedViews);
  const selectedDimensions = useDrawingStore((s) => s.selectedDimensions);
  const selectedAnnotations = useDrawingStore((s) => s.selectedAnnotations);
  const isRecomputing = useDrawingStore((s) => s.isRecomputing);
  const recomputeViews = useDrawingStore((s) => s.recomputeViews);

  const hasSelection =
    selectedViews.size > 0 || selectedDimensions.size > 0 || selectedAnnotations.size > 0;

  const handleRecompute = () => {
    if (onRecompute) {
      onRecompute();
    } else {
      recomputeViews();
    }
  };

  return (
    <div style={styles.container}>
      {/* Selection Tools */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Select</div>
        <ToolButton
          icon="\u2B9E"
          label="Select (V)"
          tool="select"
          activeTool={activeTool}
          onClick={() => setActiveTool("select")}
        />
        <ToolButton
          icon="\u2630"
          label="Pan (H)"
          tool="pan"
          activeTool={activeTool}
          onClick={() => setActiveTool("pan")}
        />
      </div>

      <div style={styles.divider} />

      {/* View Tools */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Views</div>
        <ActionButton icon="\u229E" label="Add View" onClick={onAddView || (() => {})} />
        <ActionButton
          icon="\u21BB"
          label="Recompute Views"
          onClick={handleRecompute}
          disabled={isRecomputing}
        />
      </div>

      <div style={styles.divider} />

      {/* Dimension Tools */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Dim</div>
        <ToolButton
          icon="\u2194"
          label="Linear Dimension (D)"
          tool="dim-linear"
          activeTool={activeTool}
          onClick={() => setActiveTool("dim-linear")}
        />
        <ToolButton
          icon="\u2300"
          label="Diameter Dimension"
          tool="dim-diameter"
          activeTool={activeTool}
          onClick={() => setActiveTool("dim-diameter")}
        />
        <ToolButton
          icon="R"
          label="Radius Dimension"
          tool="dim-radius"
          activeTool={activeTool}
          onClick={() => setActiveTool("dim-radius")}
        />
        <ToolButton
          icon="\u2220"
          label="Angle Dimension"
          tool="dim-angle"
          activeTool={activeTool}
          onClick={() => setActiveTool("dim-angle")}
        />
      </div>

      <div style={styles.divider} />

      {/* Annotation Tools */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Annot</div>
        <ToolButton
          icon="A"
          label="Text (T)"
          tool="text"
          activeTool={activeTool}
          onClick={() => setActiveTool("text")}
        />
        <ToolButton
          icon="\u2709"
          label="Note with Leader"
          tool="note"
          activeTool={activeTool}
          onClick={() => setActiveTool("note")}
        />
        <ToolButton
          icon="\u24EA"
          label="Balloon"
          tool="balloon"
          activeTool={activeTool}
          onClick={() => setActiveTool("balloon")}
        />
      </div>

      <div style={styles.divider} />

      {/* Edit Actions */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Edit</div>
        <ActionButton
          icon="\u2716"
          label="Delete Selected (Del)"
          onClick={deleteSelected}
          disabled={!hasSelection}
        />
      </div>
    </div>
  );
}

export default DrawingToolbar;
