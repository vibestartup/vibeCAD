/**
 * Toolbar - top bar with tools and actions.
 */

import React from "react";
import { useCadStore, selectIsRebuilding } from "../store";

// Tool categories
type ToolCategory = "select" | "sketch" | "primitive" | "operation" | "modify";

interface Tool {
  id: string;
  label: string;
  icon: string;
  category: ToolCategory;
  shortcut?: string;
}

const TOOLS: Tool[] = [
  // Selection
  { id: "select", label: "Select", icon: "◇", category: "select", shortcut: "V" },

  // Sketch tools
  { id: "sketch", label: "New Sketch", icon: "□", category: "sketch", shortcut: "S" },
  { id: "line", label: "Line", icon: "╱", category: "sketch", shortcut: "L" },
  { id: "rect", label: "Rectangle", icon: "▢", category: "sketch", shortcut: "R" },
  { id: "circle", label: "Circle", icon: "○", category: "sketch", shortcut: "C" },
  { id: "arc", label: "Arc", icon: "◠", category: "sketch" },

  // 3D Primitives
  { id: "box", label: "Box", icon: "◻", category: "primitive" },
  { id: "cylinder", label: "Cylinder", icon: "⬭", category: "primitive" },
  { id: "sphere", label: "Sphere", icon: "●", category: "primitive" },

  // Operations
  { id: "extrude", label: "Extrude", icon: "⬆", category: "operation", shortcut: "E" },
  { id: "revolve", label: "Revolve", icon: "↻", category: "operation" },
  { id: "sweep", label: "Sweep", icon: "⤴", category: "operation" },
  { id: "loft", label: "Loft", icon: "⧫", category: "operation" },

  // Modify
  { id: "fillet", label: "Fillet", icon: "◜", category: "modify", shortcut: "F" },
  { id: "chamfer", label: "Chamfer", icon: "◿", category: "modify" },
  { id: "shell", label: "Shell", icon: "◻", category: "modify" },
  { id: "union", label: "Union", icon: "∪", category: "modify" },
  { id: "subtract", label: "Subtract", icon: "−", category: "modify" },
  { id: "intersect", label: "Intersect", icon: "∩", category: "modify" },
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
  const createNewSketch = useCadStore((s) => s.createNewSketch);
  const createExtrude = useCadStore((s) => s.createExtrude);

  const canUndo = useCadStore((s) => s.canUndo());
  const canRedo = useCadStore((s) => s.canRedo());
  const undo = useCadStore((s) => s.undo);
  const redo = useCadStore((s) => s.redo);
  const isRebuilding = useCadStore(selectIsRebuilding);

  // Handle tool click - some tools trigger immediate actions
  const handleToolClick = React.useCallback((toolId: string) => {
    switch (toolId) {
      case "sketch":
        // Create a new sketch on the XY plane
        createNewSketch();
        setActiveTool("line"); // Switch to line tool after creating sketch
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
  }, [activeSketchId, createNewSketch, createExtrude, setActiveTool]);

  const toolsByCategory = React.useMemo(() => {
    const groups: Record<ToolCategory, Tool[]> = {
      select: [],
      sketch: [],
      primitive: [],
      operation: [],
      modify: [],
    };
    for (const tool of TOOLS) {
      groups[tool.category].push(tool);
    }
    return groups;
  }, []);

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

      {/* Selection Tools */}
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

      <div style={styles.divider} />

      {/* Sketch Tools */}
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

      <div style={styles.divider} />

      {/* Operation Tools */}
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

      <div style={styles.divider} />

      {/* Modify Tools */}
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
