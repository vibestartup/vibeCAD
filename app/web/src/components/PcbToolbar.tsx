/**
 * PcbToolbar - top toolbar for PCB editor.
 */

import React, { useState } from "react";
import { usePcbStore } from "../store/pcb-store";
import type { PcbTool } from "../store/pcb-store";

// ============================================================================
// Tool Definitions
// ============================================================================

interface Tool {
  id: PcbTool;
  label: string;
  icon: string;
  shortcut?: string;
  group: "select" | "route" | "draw" | "measure";
}

const TOOLS: Tool[] = [
  // Selection
  { id: "select", label: "Select", icon: "⎋", shortcut: "V", group: "select" },
  { id: "delete", label: "Delete", icon: "⌫", shortcut: "Del", group: "select" },

  // Route
  { id: "track", label: "Track", icon: "━", shortcut: "X", group: "route" },
  { id: "via", label: "Via", icon: "◉", shortcut: "V", group: "route" },

  // Draw
  { id: "zone", label: "Zone", icon: "▢", shortcut: "Z", group: "draw" },
  { id: "keepout", label: "Keepout", icon: "⊘", group: "draw" },
  { id: "line", label: "Line", icon: "╱", group: "draw" },
  { id: "arc", label: "Arc", icon: "⌒", group: "draw" },
  { id: "circle", label: "Circle", icon: "○", group: "draw" },
  { id: "text", label: "Text", icon: "T", group: "draw" },

  // Measure
  { id: "measure", label: "Measure", icon: "📏", shortcut: "M", group: "measure" },
  { id: "dimension", label: "Dimension", icon: "⟷", group: "measure" },
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

  toggleButton: {
    padding: "6px 12px",
    border: "none",
    borderRadius: 4,
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

interface PcbToolbarProps {
  onOpenLibrary?: () => void;
  onRunDrc?: () => void;
  onExportGerber?: () => void;
  onExport3d?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function PcbToolbar({
  onOpenLibrary,
  onRunDrc,
  onExportGerber,
  onExport3d,
}: PcbToolbarProps) {
  const activeTool = usePcbStore((s) => s.activeTool);
  const setTool = usePcbStore((s) => s.setTool);
  const undo = usePcbStore((s) => s.undo);
  const redo = usePcbStore((s) => s.redo);
  const canUndo = usePcbStore((s) => s.canUndo);
  const canRedo = usePcbStore((s) => s.canRedo);
  const toggleLibraryBrowser = usePcbStore((s) => s.toggleLibraryBrowser);
  const gridSize = usePcbStore((s) => s.gridSize);
  const setGridSize = usePcbStore((s) => s.setGridSize);
  const snapToGrid = usePcbStore((s) => s.snapToGrid);
  const toggleSnapToGrid = usePcbStore((s) => s.toggleSnapToGrid);
  const showRatsnest = usePcbStore((s) => s.showRatsnest);
  const toggleRatsnest = usePcbStore((s) => s.toggleRatsnest);
  const show3dView = usePcbStore((s) => s.show3dView);
  const toggle3dView = usePcbStore((s) => s.toggle3dView);
  const showDrcViolations = usePcbStore((s) => s.showDrcViolations);
  const toggleDrcViolations = usePcbStore((s) => s.toggleDrcViolations);
  const runDrc = usePcbStore((s) => s.runDrc);

  const [hoveredTool, setHoveredTool] = useState<string | null>(null);

  // Group tools
  const selectTools = TOOLS.filter((t) => t.group === "select");
  const routeTools = TOOLS.filter((t) => t.group === "route");
  const drawTools = TOOLS.filter((t) => t.group === "draw");
  const measureTools = TOOLS.filter((t) => t.group === "measure");

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
      onClick={() => setTool(tool.id)}
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
      {/* Undo/Redo */}
      <div style={styles.toolGroup}>
        <button
          style={{
            ...styles.toolButton,
            opacity: canUndo() ? 1 : 0.5,
          }}
          onClick={undo}
          disabled={!canUndo()}
          title="Undo (Ctrl+Z)"
        >
          <span>↶</span>
          <span style={styles.toolLabel}>Undo</span>
        </button>
        <button
          style={{
            ...styles.toolButton,
            opacity: canRedo() ? 1 : 0.5,
          }}
          onClick={redo}
          disabled={!canRedo()}
          title="Redo (Ctrl+Y)"
        >
          <span>↷</span>
          <span style={styles.toolLabel}>Redo</span>
        </button>
      </div>

      <div style={styles.divider} />

      {/* Select tools */}
      <div style={styles.toolGroup}>{selectTools.map(renderToolButton)}</div>

      <div style={styles.divider} />

      {/* Route tools */}
      <div style={styles.toolGroup}>{routeTools.map(renderToolButton)}</div>

      <div style={styles.divider} />

      {/* Draw tools */}
      <div style={styles.toolGroup}>{drawTools.map(renderToolButton)}</div>

      <div style={styles.divider} />

      {/* Measure tools */}
      <div style={styles.toolGroup}>{measureTools.map(renderToolButton)}</div>

      <div style={styles.divider} />

      {/* Footprint Library */}
      <button
        style={styles.actionButton}
        onClick={onOpenLibrary || toggleLibraryBrowser}
        title="Open Footprint Library (P)"
      >
        <span>📦</span>
        <span>Add Footprint</span>
      </button>

      <div style={styles.spacer} />

      {/* View toggles */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          style={{
            ...styles.toggleButton,
            backgroundColor: showRatsnest ? "rgba(100, 108, 255, 0.3)" : "rgba(255, 255, 255, 0.1)",
            color: showRatsnest ? "#fff" : "#aaa",
          }}
          onClick={toggleRatsnest}
          title="Toggle Ratsnest"
        >
          <span>🔗</span>
        </button>

        <button
          style={{
            ...styles.toggleButton,
            backgroundColor: showDrcViolations ? "rgba(255, 100, 100, 0.3)" : "rgba(255, 255, 255, 0.1)",
            color: showDrcViolations ? "#ff6b6b" : "#aaa",
          }}
          onClick={toggleDrcViolations}
          title="Toggle DRC Violations"
        >
          <span>⚠</span>
        </button>

        <button
          style={{
            ...styles.toggleButton,
            backgroundColor: show3dView ? "rgba(100, 255, 100, 0.3)" : "rgba(255, 255, 255, 0.1)",
            color: show3dView ? "#69db7c" : "#aaa",
          }}
          onClick={toggle3dView}
          title="Toggle 3D View"
        >
          <span>🎲</span>
        </button>
      </div>

      <div style={styles.divider} />

      {/* Grid settings */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          style={{
            ...styles.toggleButton,
            backgroundColor: snapToGrid ? "rgba(100, 108, 255, 0.3)" : "rgba(255, 255, 255, 0.1)",
            color: snapToGrid ? "#fff" : "#aaa",
          }}
          onClick={toggleSnapToGrid}
          title="Toggle Snap to Grid"
        >
          <span>⊞</span>
        </button>

        <select
          value={gridSize}
          onChange={(e) => setGridSize(Number(e.target.value))}
          style={{
            padding: "4px 8px",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "none",
            borderRadius: 4,
            color: "#aaa",
            fontSize: 12,
          }}
          title="Grid Size"
        >
          <option value={0.1}>0.1mm</option>
          <option value={0.25}>0.25mm</option>
          <option value={0.5}>0.5mm</option>
          <option value={1}>1mm</option>
        </select>
      </div>

      <div style={styles.divider} />

      {/* DRC / Export */}
      <button
        style={styles.actionButton}
        onClick={onRunDrc || runDrc}
        title="Run Design Rules Check"
      >
        <span>✓</span>
        <span>DRC</span>
      </button>

      <button
        style={styles.actionButton}
        onClick={onExportGerber}
        title="Export Gerber Files"
      >
        <span>📄</span>
        <span>Gerber</span>
      </button>

      <button
        style={styles.actionButton}
        onClick={onExport3d}
        title="Export 3D Model"
      >
        <span>📦</span>
        <span>3D</span>
      </button>
    </div>
  );
}

export default PcbToolbar;
