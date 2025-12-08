/**
 * ImageEditorSidebar - sidebar panel for image editor tool settings
 * Uses TabbedSidebar for consistency with the rest of the app
 */

import React from "react";
import {
  useImageEditorStore,
  drawingTools,
  fontFamilies,
  type DrawingTool,
} from "../store/image-editor-store";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    backgroundColor: "transparent",
  },

  section: {
    padding: 12,
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
  },

  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: "#666",
    textTransform: "uppercase" as const,
    marginBottom: 10,
  },

  toolGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 4,
  },

  toolButton: {
    width: "100%",
    aspectRatio: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    border: "1px solid #333",
    backgroundColor: "transparent",
    color: "#888",
    fontSize: 14,
    cursor: "pointer",
    transition: "all 0.15s",
  },

  toolButtonHover: {
    backgroundColor: "#252545",
    borderColor: "#444",
    color: "#fff",
  },

  toolButtonActive: {
    backgroundColor: "#646cff",
    borderColor: "#646cff",
    color: "#fff",
  },

  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  label: {
    fontSize: 12,
    color: "#888",
    minWidth: 70,
  },

  slider: {
    flex: 1,
    height: 4,
    appearance: "none" as const,
    backgroundColor: "#333",
    borderRadius: 2,
    cursor: "pointer",
    outline: "none",
  },

  value: {
    fontSize: 11,
    color: "#666",
    minWidth: 35,
    textAlign: "right" as const,
  },

  colorRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 4,
    border: "2px solid #444",
    cursor: "pointer",
    position: "relative" as const,
    overflow: "hidden",
  },

  colorInput: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "pointer",
  },

  select: {
    flex: 1,
    padding: "6px 8px",
    borderRadius: 4,
    border: "1px solid #333",
    backgroundColor: "#1a1a2e",
    color: "#ccc",
    fontSize: 12,
    outline: "none",
    cursor: "pointer",
  },

  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    fontSize: 12,
    color: "#888",
  },

  checkboxInput: {
    width: 16,
    height: 16,
    accentColor: "#646cff",
  },

  button: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 4,
    border: "1px solid #333",
    backgroundColor: "#252545",
    color: "#888",
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.15s",
    marginTop: 4,
  },

  buttonHover: {
    backgroundColor: "#333",
    color: "#fff",
  },

  buttonDanger: {
    borderColor: "#ff4444",
    color: "#ff4444",
  },

  presetColors: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 4,
    marginTop: 8,
  },

  presetColor: {
    width: 20,
    height: 20,
    borderRadius: 3,
    border: "1px solid #444",
    cursor: "pointer",
  },

  undoRedoRow: {
    display: "flex",
    gap: 8,
    marginTop: 8,
  },

  undoRedoButton: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 4,
    border: "1px solid #333",
    backgroundColor: "transparent",
    color: "#888",
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.15s",
  },

  disabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
};

// Preset colors for quick selection
const presetColors = [
  "#ff0000", "#ff6600", "#ffcc00", "#00ff00", "#00ffcc",
  "#00ccff", "#0066ff", "#6600ff", "#ff00ff", "#ff0066",
  "#ffffff", "#cccccc", "#888888", "#444444", "#000000",
];

// ============================================================================
// Tool Settings Panel
// ============================================================================

function ToolSettingsPanel() {
  const {
    activeTool,
    strokeColor,
    setStrokeColor,
    fillColor,
    setFillColor,
    strokeSize,
    setStrokeSize,
    opacity,
    setOpacity,
    brushHardness,
    setBrushHardness,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    fillEnabled,
    setFillEnabled,
    strokeEnabled,
    setStrokeEnabled,
    arrowHeadSize,
    setArrowHeadSize,
  } = useImageEditorStore();

  const [hoveredPreset, setHoveredPreset] = React.useState<string | null>(null);

  // Show different settings based on active tool
  const showStrokeColor = ["pen", "brush", "line", "arrow", "rectangle", "ellipse", "text"].includes(activeTool);
  const showFillColor = ["rectangle", "ellipse"].includes(activeTool);
  const showStrokeSize = ["pen", "brush", "eraser", "line", "arrow", "rectangle", "ellipse"].includes(activeTool);
  const showOpacity = ["pen", "brush", "eraser", "line", "arrow", "rectangle", "ellipse", "text"].includes(activeTool);
  const showBrushHardness = activeTool === "brush";
  const showFontSettings = activeTool === "text";
  const showShapeSettings = ["rectangle", "ellipse"].includes(activeTool);
  const showArrowSettings = activeTool === "arrow";

  if (activeTool === "select" || activeTool === "eyedropper") {
    return (
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          {activeTool === "select" ? "Selection" : "Eyedropper"}
        </div>
        <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
          {activeTool === "select"
            ? "Click and drag to select annotations. Use Delete to remove selected items."
            : "Click anywhere on the image to pick a color."}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Tool Settings</div>

      {/* Stroke Color */}
      {showStrokeColor && (
        <>
          <div style={styles.colorRow}>
            <span style={styles.label}>Stroke</span>
            <div style={{ ...styles.colorSwatch, backgroundColor: strokeColor }}>
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                style={styles.colorInput}
              />
            </div>
            <span style={{ ...styles.value, flex: 1, textAlign: "left" as const }}>{strokeColor}</span>
          </div>
          <div style={styles.presetColors}>
            {presetColors.map((color) => (
              <div
                key={color}
                style={{
                  ...styles.presetColor,
                  backgroundColor: color,
                  borderColor: hoveredPreset === color ? "#646cff" : "#444",
                  transform: hoveredPreset === color ? "scale(1.2)" : "scale(1)",
                }}
                onClick={() => setStrokeColor(color)}
                onMouseEnter={() => setHoveredPreset(color)}
                onMouseLeave={() => setHoveredPreset(null)}
              />
            ))}
          </div>
        </>
      )}

      {/* Fill Color */}
      {showFillColor && (
        <div style={{ marginTop: 12 }}>
          <div style={styles.colorRow}>
            <span style={styles.label}>Fill</span>
            <div style={{ ...styles.colorSwatch, backgroundColor: fillEnabled ? fillColor : "transparent" }}>
              <input
                type="color"
                value={fillColor}
                onChange={(e) => setFillColor(e.target.value)}
                style={styles.colorInput}
                disabled={!fillEnabled}
              />
            </div>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={fillEnabled}
                onChange={(e) => setFillEnabled(e.target.checked)}
                style={styles.checkboxInput}
              />
              Enable Fill
            </label>
          </div>
        </div>
      )}

      {/* Stroke Size */}
      {showStrokeSize && (
        <div style={{ ...styles.row, marginTop: 12 }}>
          <span style={styles.label}>Size</span>
          <input
            type="range"
            min="1"
            max="100"
            value={strokeSize}
            onChange={(e) => setStrokeSize(parseInt(e.target.value))}
            style={styles.slider}
          />
          <span style={styles.value}>{strokeSize}px</span>
        </div>
      )}

      {/* Opacity */}
      {showOpacity && (
        <div style={styles.row}>
          <span style={styles.label}>Opacity</span>
          <input
            type="range"
            min="0"
            max="100"
            value={opacity}
            onChange={(e) => setOpacity(parseInt(e.target.value))}
            style={styles.slider}
          />
          <span style={styles.value}>{opacity}%</span>
        </div>
      )}

      {/* Brush Hardness */}
      {showBrushHardness && (
        <div style={styles.row}>
          <span style={styles.label}>Hardness</span>
          <input
            type="range"
            min="0"
            max="100"
            value={brushHardness}
            onChange={(e) => setBrushHardness(parseInt(e.target.value))}
            style={styles.slider}
          />
          <span style={styles.value}>{brushHardness}%</span>
        </div>
      )}

      {/* Font Settings */}
      {showFontSettings && (
        <>
          <div style={{ ...styles.row, marginTop: 12 }}>
            <span style={styles.label}>Font</span>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              style={styles.select}
            >
              {fontFamilies.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Size</span>
            <input
              type="range"
              min="8"
              max="200"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              style={styles.slider}
            />
            <span style={styles.value}>{fontSize}px</span>
          </div>
        </>
      )}

      {/* Shape Settings */}
      {showShapeSettings && (
        <div style={{ marginTop: 12 }}>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={strokeEnabled}
              onChange={(e) => setStrokeEnabled(e.target.checked)}
              style={styles.checkboxInput}
            />
            Show Stroke
          </label>
        </div>
      )}

      {/* Arrow Settings */}
      {showArrowSettings && (
        <div style={styles.row}>
          <span style={styles.label}>Head Size</span>
          <input
            type="range"
            min="4"
            max="50"
            value={arrowHeadSize}
            onChange={(e) => setArrowHeadSize(parseInt(e.target.value))}
            style={styles.slider}
          />
          <span style={styles.value}>{arrowHeadSize}px</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tools Panel
// ============================================================================

function ToolsPanel() {
  const { activeTool, setActiveTool } = useImageEditorStore();
  const [hoveredTool, setHoveredTool] = React.useState<string | null>(null);

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Drawing Tools</div>
      <div style={styles.toolGrid}>
        {drawingTools.map((tool) => (
          <button
            key={tool.id}
            style={{
              ...styles.toolButton,
              ...(hoveredTool === tool.id && activeTool !== tool.id ? styles.toolButtonHover : {}),
              ...(activeTool === tool.id ? styles.toolButtonActive : {}),
            }}
            onClick={() => setActiveTool(tool.id)}
            onMouseEnter={() => setHoveredTool(tool.id)}
            onMouseLeave={() => setHoveredTool(null)}
            title={`${tool.label} (${tool.shortcut})\n${tool.description}`}
          >
            {tool.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Actions Panel
// ============================================================================

function ActionsPanel() {
  const { strokes, undoStack, redoStack, undo, redo, clearStrokes } = useImageEditorStore();
  const [hoveredButton, setHoveredButton] = React.useState<string | null>(null);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const hasStrokes = strokes.length > 0;

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Actions</div>

      <div style={styles.undoRedoRow}>
        <button
          style={{
            ...styles.undoRedoButton,
            ...(hoveredButton === "undo" && canUndo ? styles.buttonHover : {}),
            ...(!canUndo ? styles.disabled : {}),
          }}
          onClick={undo}
          disabled={!canUndo}
          onMouseEnter={() => setHoveredButton("undo")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Undo (Ctrl+Z)"
        >
          ↩ Undo
        </button>
        <button
          style={{
            ...styles.undoRedoButton,
            ...(hoveredButton === "redo" && canRedo ? styles.buttonHover : {}),
            ...(!canRedo ? styles.disabled : {}),
          }}
          onClick={redo}
          disabled={!canRedo}
          onMouseEnter={() => setHoveredButton("redo")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↪ Redo
        </button>
      </div>

      <button
        style={{
          ...styles.button,
          ...(hoveredButton === "clear" && hasStrokes ? { ...styles.buttonHover, ...styles.buttonDanger } : {}),
          ...(!hasStrokes ? styles.disabled : {}),
        }}
        onClick={clearStrokes}
        disabled={!hasStrokes}
        onMouseEnter={() => setHoveredButton("clear")}
        onMouseLeave={() => setHoveredButton(null)}
      >
        Clear All Annotations ({strokes.length})
      </button>
    </div>
  );
}

// ============================================================================
// Main Sidebar Component
// ============================================================================

export function ImageEditorSidebar() {
  return (
    <div style={styles.container}>
      <ToolsPanel />
      <ToolSettingsPanel />
      <ActionsPanel />
    </div>
  );
}

export default ImageEditorSidebar;
