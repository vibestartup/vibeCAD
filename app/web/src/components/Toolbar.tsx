/**
 * Toolbar - top bar with tools and actions.
 */

import React from "react";
import { useCadStore, selectIsRebuilding } from "../store";

// Tool categories
type ToolCategory = "select" | "sketch" | "sketch-draw" | "primitive" | "operation" | "modify";

// Which mode the tool is available in
type ToolMode = "object" | "sketch" | "both";

interface Tool {
  id: string;
  label: string;
  icon: string;
  category: ToolCategory;
  shortcut?: string;
  mode: ToolMode;
}

const TOOLS: Tool[] = [
  // Selection (available in both modes)
  { id: "select", label: "Select", icon: "⎋", category: "select", shortcut: "V", mode: "both" },

  // Object mode: create new sketch
  { id: "sketch", label: "New Sketch", icon: "✎", category: "sketch", shortcut: "S", mode: "object" },

  // Sketch mode: drawing tools
  { id: "line", label: "Line", icon: "⁄", category: "sketch-draw", shortcut: "L", mode: "sketch" },
  { id: "rect", label: "Rectangle", icon: "▭", category: "sketch-draw", shortcut: "R", mode: "sketch" },
  { id: "circle", label: "Circle", icon: "◯", category: "sketch-draw", shortcut: "C", mode: "sketch" },
  { id: "arc", label: "Arc", icon: "⌒", category: "sketch-draw", mode: "sketch" },

  // 3D Primitives (object mode)
  { id: "box", label: "Box", icon: "⬡", category: "primitive", mode: "object" },
  { id: "cylinder", label: "Cylinder", icon: "⏣", category: "primitive", mode: "object" },
  { id: "sphere", label: "Sphere", icon: "◉", category: "primitive", mode: "object" },

  // Operations (object mode)
  { id: "extrude", label: "Extrude", icon: "⏶", category: "operation", shortcut: "E", mode: "object" },
  { id: "revolve", label: "Revolve", icon: "⟳", category: "operation", mode: "object" },
  { id: "sweep", label: "Sweep", icon: "↝", category: "operation", mode: "object" },
  { id: "loft", label: "Loft", icon: "⋈", category: "operation", mode: "object" },

  // Modify (object mode)
  { id: "fillet", label: "Fillet", icon: "⌓", category: "modify", shortcut: "F", mode: "object" },
  { id: "chamfer", label: "Chamfer", icon: "⌔", category: "modify", mode: "object" },
  { id: "shell", label: "Shell", icon: "▢", category: "modify", mode: "object" },
  { id: "union", label: "Union", icon: "⊕", category: "modify", mode: "object" },
  { id: "subtract", label: "Subtract", icon: "⊖", category: "modify", mode: "object" },
  { id: "intersect", label: "Intersect", icon: "⊗", category: "modify", mode: "object" },
];

const styles = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    height: "100%",
    gap: 8,
    padding: "0 12px",
  } as React.CSSProperties,

  logo: {
    fontWeight: 700,
    fontSize: 16,
    color: "#646cff",
    marginRight: 16,
    userSelect: "none",
  } as React.CSSProperties,

  divider: {
    width: 1,
    height: 24,
    backgroundColor: "#333",
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

  toolButtonHover: {
    backgroundColor: "#333",
    color: "#fff",
  } as React.CSSProperties,

  toolLabel: {
    fontSize: 9,
    marginTop: 2,
    opacity: 0.7,
  } as React.CSSProperties,

  iconButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    border: "none",
    borderRadius: 4,
    backgroundColor: "transparent",
    color: "#aaa",
    cursor: "pointer",
    fontSize: 14,
  } as React.CSSProperties,

  iconButtonDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  } as React.CSSProperties,

  spacer: {
    flex: 1,
  } as React.CSSProperties,

  statusText: {
    fontSize: 12,
    color: "#888",
  } as React.CSSProperties,
};

interface ToolButtonProps {
  tool: Tool;
  isActive: boolean;
  onClick: () => void;
}

function ToolButton({ tool, isActive, onClick }: ToolButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      style={{
        ...styles.toolButton,
        ...(isActive ? styles.toolButtonActive : {}),
        ...(isHovered && !isActive ? styles.toolButtonHover : {}),
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ""}`}
    >
      <span>{tool.icon}</span>
      <span style={styles.toolLabel}>{tool.label}</span>
    </button>
  );
}

export function Toolbar() {
  // Use store for active tool instead of local state
  const activeTool = useCadStore((s) => s.activeTool);
  const setActiveTool = useCadStore((s) => s.setActiveTool);
  const activeSketchId = useCadStore((s) => s.activeSketchId);
  const editorMode = useCadStore((s) => s.editorMode);
  const enterPlaneSelectionMode = useCadStore((s) => s.enterPlaneSelectionMode);
  const cancelPlaneSelection = useCadStore((s) => s.cancelPlaneSelection);
  const createExtrude = useCadStore((s) => s.createExtrude);
  const exitSketchMode = useCadStore((s) => s.exitSketchMode);

  const canUndo = useCadStore((s) => s.canUndo());
  const canRedo = useCadStore((s) => s.canRedo());
  const undo = useCadStore((s) => s.undo);
  const redo = useCadStore((s) => s.redo);
  const isRebuilding = useCadStore(selectIsRebuilding);
  const gridSnappingEnabled = useCadStore((s) => s.gridSnappingEnabled);
  const toggleGridSnapping = useCadStore((s) => s.toggleGridSnapping);

  // Handle tool click - some tools trigger immediate actions
  const handleToolClick = React.useCallback((toolId: string) => {
    console.log("[Toolbar] handleToolClick:", toolId);
    switch (toolId) {
      case "sketch":
        // Enter plane selection mode - user clicks on a plane to create sketch
        enterPlaneSelectionMode();
        break;
      case "extrude":
        // Extrude the active sketch if one is selected
        if (activeSketchId) {
          createExtrude(activeSketchId, 100);
          setActiveTool("select");
        } else {
          console.log("Select a sketch to extrude");
          setActiveTool(toolId);
        }
        break;
      default:
        setActiveTool(toolId);
        break;
    }
  }, [activeSketchId, enterPlaneSelectionMode, createExtrude, setActiveTool]);

  // Filter tools based on current mode
  const visibleTools = React.useMemo(() => {
    return TOOLS.filter(tool => {
      if (tool.mode === "both") return true;
      return tool.mode === editorMode;
    });
  }, [editorMode]);

  const toolsByCategory = React.useMemo(() => {
    const groups: Record<ToolCategory, Tool[]> = {
      select: [],
      sketch: [],
      "sketch-draw": [],
      primitive: [],
      operation: [],
      modify: [],
    };
    for (const tool of visibleTools) {
      groups[tool.category].push(tool);
    }
    return groups;
  }, [visibleTools]);

  return (
    <div style={styles.toolbar}>
      {/* Logo */}
      <div style={styles.logo}>vibeCAD</div>

      {/* Undo/Redo */}
      <button
        style={{
          ...styles.iconButton,
          ...(canUndo ? {} : styles.iconButtonDisabled),
        }}
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        ↩
      </button>
      <button
        style={{
          ...styles.iconButton,
          ...(canRedo ? {} : styles.iconButtonDisabled),
        }}
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
      >
        ↪
      </button>

      <div style={styles.divider} />

      {/* Mode indicator */}
      {editorMode === "select-plane" && (
        <div style={{
          backgroundColor: "#ffa94d",
          color: "#000",
          padding: "4px 12px",
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
        }}>
          SELECT PLANE
        </div>
      )}
      {editorMode === "sketch" && (
        <div style={{
          backgroundColor: "#4dabf7",
          color: "#000",
          padding: "4px 12px",
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
        }}>
          SKETCH MODE
        </div>
      )}

      {/* Selection Tools */}
      {toolsByCategory.select.length > 0 && (
        <div style={styles.toolGroup}>
          {toolsByCategory.select.map((tool) => (
            <ToolButton
              key={tool.id}
              tool={tool}
              isActive={activeTool === tool.id}
              onClick={() => handleToolClick(tool.id)}
            />
          ))}
        </div>
      )}

      {/* Object Mode: Sketch creation */}
      {toolsByCategory.sketch.length > 0 && (
        <>
          <div style={styles.divider} />
          <div style={styles.toolGroup}>
            {toolsByCategory.sketch.map((tool) => (
              <ToolButton
                key={tool.id}
                tool={tool}
                isActive={activeTool === tool.id}
                onClick={() => handleToolClick(tool.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* Sketch Mode: Drawing tools */}
      {toolsByCategory["sketch-draw"].length > 0 && (
        <>
          <div style={styles.divider} />
          <div style={styles.toolGroup}>
            {toolsByCategory["sketch-draw"].map((tool) => (
              <ToolButton
                key={tool.id}
                tool={tool}
                isActive={activeTool === tool.id}
                onClick={() => handleToolClick(tool.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* Object Mode: Operation Tools */}
      {toolsByCategory.operation.length > 0 && (
        <>
          <div style={styles.divider} />
          <div style={styles.toolGroup}>
            {toolsByCategory.operation.map((tool) => (
              <ToolButton
                key={tool.id}
                tool={tool}
                isActive={activeTool === tool.id}
                onClick={() => handleToolClick(tool.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* Object Mode: Modify Tools */}
      {toolsByCategory.modify.length > 0 && (
        <>
          <div style={styles.divider} />
          <div style={styles.toolGroup}>
            {toolsByCategory.modify.map((tool) => (
              <ToolButton
                key={tool.id}
                tool={tool}
                isActive={activeTool === tool.id}
                onClick={() => handleToolClick(tool.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* Cancel Plane Selection button */}
      {editorMode === "select-plane" && (
        <>
          <div style={styles.divider} />
          <button
            style={{
              ...styles.iconButton,
              backgroundColor: "#ff6b6b",
              color: "#fff",
              padding: "4px 12px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              width: "auto",
            }}
            onClick={cancelPlaneSelection}
            title="Cancel (ESC)"
          >
            Cancel
          </button>
        </>
      )}

      {/* Sketch Mode controls */}
      {editorMode === "sketch" && (
        <>
          <div style={styles.divider} />
          {/* Grid Snap Toggle */}
          <button
            style={{
              ...styles.iconButton,
              backgroundColor: gridSnappingEnabled ? "#4dabf7" : "#333",
              color: gridSnappingEnabled ? "#000" : "#888",
              padding: "4px 12px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              width: "auto",
            }}
            onClick={toggleGridSnapping}
            title={`Grid Snapping: ${gridSnappingEnabled ? "ON" : "OFF"}`}
          >
            ⊞ Snap
          </button>
          <button
            style={{
              ...styles.iconButton,
              backgroundColor: "#ff6b6b",
              color: "#fff",
              padding: "4px 12px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              width: "auto",
            }}
            onClick={exitSketchMode}
            title="Exit Sketch Mode (ESC)"
          >
            Exit Sketch
          </button>
        </>
      )}

      {/* Spacer */}
      <div style={styles.spacer} />

      {/* Status */}
      {isRebuilding && (
        <span style={styles.statusText}>⟳ Rebuilding...</span>
      )}
    </div>
  );
}

export default Toolbar;
