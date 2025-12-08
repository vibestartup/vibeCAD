/**
 * ImageEditorSidebar - sidebar panel showing tool-specific settings
 * Tools are now in the toolbar, this only shows settings for the active tool
 */

import React from "react";
import {
  useImageEditorStore,
  fontFamilies,
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

  toolName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#ccc",
    marginBottom: 4,
  },

  toolDescription: {
    fontSize: 11,
    color: "#666",
    lineHeight: 1.5,
  },

  noSettings: {
    fontSize: 12,
    color: "#666",
    lineHeight: 1.6,
    padding: "8px 0",
  },
};

// Preset colors for quick selection
const presetColors = [
  "#ff0000", "#ff6600", "#ffcc00", "#00ff00", "#00ffcc",
  "#00ccff", "#0066ff", "#6600ff", "#ff00ff", "#ff0066",
  "#ffffff", "#cccccc", "#888888", "#444444", "#000000",
];

// Tool info for display
const toolInfo: Record<string, { name: string; description: string }> = {
  select: { name: "Select", description: "Click and drag to pan. Use scroll wheel to zoom." },
  pen: { name: "Pen", description: "Draw freehand lines with hard edges." },
  brush: { name: "Brush", description: "Paint with soft, customizable edges." },
  eraser: { name: "Eraser", description: "Remove parts of your drawing." },
  line: { name: "Line", description: "Draw straight lines between two points." },
  arrow: { name: "Arrow", description: "Draw arrows with customizable head size." },
  rectangle: { name: "Rectangle", description: "Draw rectangular shapes." },
  ellipse: { name: "Ellipse", description: "Draw ellipses and circles." },
  text: { name: "Text", description: "Click to add text. Press Enter to confirm, Escape to cancel." },
  eyedropper: { name: "Eyedropper", description: "Click on the image to pick a color." },
};

// ============================================================================
// Color Settings Component
// ============================================================================

function ColorSettings() {
  const {
    strokeColor,
    setStrokeColor,
    fillColor,
    setFillColor,
    fillEnabled,
    setFillEnabled,
    activeTool,
  } = useImageEditorStore();

  const [hoveredPreset, setHoveredPreset] = React.useState<string | null>(null);

  const showFillOptions = ["rectangle", "ellipse"].includes(activeTool);

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Color</div>

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

      {showFillOptions && (
        <div style={{ ...styles.colorRow, marginTop: 8 }}>
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
            Fill
          </label>
        </div>
      )}

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
    </div>
  );
}

// ============================================================================
// Stroke Settings Component
// ============================================================================

function StrokeSettings() {
  const {
    activeTool,
    strokeSize,
    setStrokeSize,
    opacity,
    setOpacity,
    brushHardness,
    setBrushHardness,
  } = useImageEditorStore();

  const showBrushHardness = activeTool === "brush";

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Stroke</div>

      <div style={styles.row}>
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
    </div>
  );
}

// ============================================================================
// Text Settings Component
// ============================================================================

function TextSettings() {
  const {
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
  } = useImageEditorStore();

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Text</div>

      <div style={styles.row}>
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
    </div>
  );
}

// ============================================================================
// Arrow Settings Component
// ============================================================================

function ArrowSettings() {
  const {
    arrowHeadSize,
    setArrowHeadSize,
  } = useImageEditorStore();

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Arrow</div>

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
          Undo
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
          Redo
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
        Clear All ({strokes.length})
      </button>
    </div>
  );
}

// ============================================================================
// Main Sidebar Component
// ============================================================================

export function ImageEditorSidebar() {
  const { activeTool } = useImageEditorStore();
  const info = toolInfo[activeTool] || { name: "Tool", description: "" };

  // Determine which settings to show based on active tool
  const showColorSettings = ["pen", "brush", "line", "arrow", "rectangle", "ellipse", "text"].includes(activeTool);
  const showStrokeSettings = ["pen", "brush", "eraser", "line", "arrow", "rectangle", "ellipse"].includes(activeTool);
  const showTextSettings = activeTool === "text";
  const showArrowSettings = activeTool === "arrow";
  const hasNoSettings = ["select", "eyedropper"].includes(activeTool);

  return (
    <div style={styles.container}>
      {/* Tool Info Header */}
      <div style={styles.section}>
        <div style={styles.toolName}>{info.name}</div>
        <div style={styles.toolDescription}>{info.description}</div>
      </div>

      {/* Tool-specific Settings */}
      {hasNoSettings && (
        <div style={styles.section}>
          <div style={styles.noSettings}>
            {activeTool === "select"
              ? "No settings available for the Select tool."
              : "Click on the image to pick a color. The color will be set as your stroke color."}
          </div>
        </div>
      )}

      {showColorSettings && <ColorSettings />}
      {showStrokeSettings && <StrokeSettings />}
      {showTextSettings && <TextSettings />}
      {showArrowSettings && <ArrowSettings />}

      {/* Actions */}
      <ActionsPanel />
    </div>
  );
}

export default ImageEditorSidebar;
