/**
 * SchematicToolbar - top toolbar for schematic editor.
 */

import React, { useState, useCallback } from "react";
import { useSchematicStore } from "../store/schematic-store";
import { useLibraryStore } from "../store/library-store";
import type { SchematicTool } from "../store/schematic-store";

// ============================================================================
// Tool Definitions
// ============================================================================

interface Tool {
  id: SchematicTool;
  label: string;
  icon: string;
  shortcut?: string;
  group: "select" | "draw" | "place" | "edit";
}

const TOOLS: Tool[] = [
  // Selection
  { id: "select", label: "Select", icon: "⎋", shortcut: "V", group: "select" },
  { id: "delete", label: "Delete", icon: "⌫", shortcut: "Del", group: "select" },

  // Draw
  { id: "wire", label: "Wire", icon: "━", shortcut: "W", group: "draw" },
  { id: "bus", label: "Bus", icon: "≡", shortcut: "B", group: "draw" },
  { id: "line", label: "Line", icon: "╱", group: "draw" },

  // Place
  { id: "net-label", label: "Net Label", icon: "▭", shortcut: "N", group: "place" },
  { id: "global-label", label: "Global Label", icon: "◇", group: "place" },
  { id: "port", label: "Port", icon: "▷", group: "place" },
  { id: "no-connect", label: "No Connect", icon: "✕", shortcut: "X", group: "place" },
  { id: "junction", label: "Junction", icon: "●", shortcut: "J", group: "place" },

  // Edit
  { id: "text", label: "Text", icon: "T", group: "edit" },
];

// ============================================================================
// Primitive Components (Quick Place)
// ============================================================================

interface PrimitiveComponent {
  id: string;
  label: string;
  icon: string;
  searchName: string;
}

// Primitive components that are placed from the library
const PRIMITIVE_COMPONENTS: PrimitiveComponent[] = [
  { id: "resistor", label: "R", icon: "Ω", searchName: "resistor" },
  { id: "capacitor", label: "C", icon: "⫴", searchName: "capacitor" },
  { id: "inductor", label: "L", icon: "⌇", searchName: "inductor" },
  { id: "diode", label: "D", icon: "▷|", searchName: "diode" },
  { id: "led", label: "LED", icon: "◐", searchName: "led" },
  { id: "gnd", label: "GND", icon: "⏚", searchName: "gnd" },
  { id: "vcc", label: "VCC", icon: "△", searchName: "vcc" },
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

  primitiveButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 6px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    color: "#aaa",
    cursor: "pointer",
    minWidth: 36,
    fontSize: 14,
    transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
  } as React.CSSProperties,

  primitiveButtonHover: {
    backgroundColor: "rgba(100, 108, 255, 0.2)",
    borderColor: "rgba(100, 108, 255, 0.4)",
    color: "#fff",
  } as React.CSSProperties,

  primitiveLabel: {
    fontSize: 8,
    marginTop: 1,
    opacity: 0.8,
  } as React.CSSProperties,
};

// ============================================================================
// Props
// ============================================================================

interface SchematicToolbarProps {
  onOpenLibrary?: () => void;
  onRunErc?: () => void;
  onExportNetlist?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function SchematicToolbar({
  onOpenLibrary,
  onRunErc,
  onExportNetlist,
}: SchematicToolbarProps) {
  const activeTool = useSchematicStore((s) => s.activeTool);
  const setTool = useSchematicStore((s) => s.setTool);
  const undo = useSchematicStore((s) => s.undo);
  const redo = useSchematicStore((s) => s.redo);
  const canUndo = useSchematicStore((s) => s.canUndo);
  const canRedo = useSchematicStore((s) => s.canRedo);
  const toggleLibraryBrowser = useSchematicStore((s) => s.toggleLibraryBrowser);
  const gridSize = useSchematicStore((s) => s.gridSize);
  const setGridSize = useSchematicStore((s) => s.setGridSize);
  const snapToGrid = useSchematicStore((s) => s.snapToGrid);
  const toggleSnapToGrid = useSchematicStore((s) => s.toggleSnapToGrid);
  const addSymbolAndStartPlace = useSchematicStore((s) => s.addSymbolAndStartPlace);

  // Library store for finding primitive symbols
  const libraryStore = useLibraryStore();

  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  const [hoveredPrimitive, setHoveredPrimitive] = useState<string | null>(null);

  // Handle primitive component placement
  const handlePlacePrimitive = useCallback(
    (primitive: PrimitiveComponent) => {
      // Find the component in the library
      const allComponents = libraryStore.getAllComponents();
      const match = allComponents.find(({ component }) => {
        const name = component.name.toLowerCase();
        return (
          name === primitive.searchName ||
          name.includes(primitive.searchName) ||
          (primitive.searchName === "gnd" && name === "gnd") ||
          (primitive.searchName === "vcc" && name === "vcc")
        );
      });

      if (match && match.component.symbols.length > 0 && match.library.symbols) {
        const symbolId = match.component.symbols[0];
        const symbol = match.library.symbols.get(symbolId);
        if (symbol) {
          addSymbolAndStartPlace(symbol as any);
        }
      }
    },
    [libraryStore, addSymbolAndStartPlace]
  );

  // Group tools
  const selectTools = TOOLS.filter((t) => t.group === "select");
  const drawTools = TOOLS.filter((t) => t.group === "draw");
  const placeTools = TOOLS.filter((t) => t.group === "place");
  const editTools = TOOLS.filter((t) => t.group === "edit");

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

      {/* Draw tools */}
      <div style={styles.toolGroup}>{drawTools.map(renderToolButton)}</div>

      <div style={styles.divider} />

      {/* Place tools */}
      <div style={styles.toolGroup}>{placeTools.map(renderToolButton)}</div>

      <div style={styles.divider} />

      {/* Edit tools */}
      <div style={styles.toolGroup}>{editTools.map(renderToolButton)}</div>

      <div style={styles.divider} />

      {/* Quick Place Primitives */}
      <div style={styles.toolGroup}>
        {PRIMITIVE_COMPONENTS.map((primitive) => (
          <button
            key={primitive.id}
            style={{
              ...styles.primitiveButton,
              ...(hoveredPrimitive === primitive.id ? styles.primitiveButtonHover : {}),
            }}
            onClick={() => handlePlacePrimitive(primitive)}
            onMouseEnter={() => setHoveredPrimitive(primitive.id)}
            onMouseLeave={() => setHoveredPrimitive(null)}
            title={`Place ${primitive.searchName} (click to add)`}
          >
            <span>{primitive.icon}</span>
            <span style={styles.primitiveLabel}>{primitive.label}</span>
          </button>
        ))}
      </div>

      <div style={styles.divider} />

      {/* Component Library */}
      <button
        style={styles.actionButton}
        onClick={onOpenLibrary || toggleLibraryBrowser}
        title="Open Component Library (P)"
      >
        <span>📦</span>
        <span>Add Symbol</span>
      </button>

      <div style={styles.spacer} />

      {/* Grid settings */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          style={{
            ...styles.actionButton,
            backgroundColor: snapToGrid ? "rgba(100, 108, 255, 0.3)" : "rgba(255, 255, 255, 0.1)",
          }}
          onClick={toggleSnapToGrid}
          title="Toggle Snap to Grid"
        >
          <span>⊞</span>
          <span>Snap</span>
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
          <option value={25}>25 mils</option>
          <option value={50}>50 mils</option>
          <option value={100}>100 mils</option>
        </select>
      </div>

      <div style={styles.divider} />

      {/* ERC / Export */}
      <button
        style={styles.actionButton}
        onClick={onRunErc}
        title="Run Electrical Rules Check"
      >
        <span>⚡</span>
        <span>ERC</span>
      </button>

      <button
        style={styles.actionButton}
        onClick={onExportNetlist}
        title="Export Netlist"
      >
        <span>📄</span>
        <span>Netlist</span>
      </button>
    </div>
  );
}

export default SchematicToolbar;
