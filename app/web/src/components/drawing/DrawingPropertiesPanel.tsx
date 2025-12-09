/**
 * DrawingPropertiesPanel - Context-sensitive properties panel for drawings.
 *
 * Shows properties for selected views, dimensions, or annotations.
 */

import React, { useState } from "react";
import { useDrawingStore } from "../../store/drawing-store";
import type { ViewProjection, DrawingSheetSize as SheetSize } from "@vibecad/core";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    width: 240,
    height: "100%",
    backgroundColor: "#1a1a2e",
    borderLeft: "1px solid #333",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  header: {
    padding: "12px 16px",
    borderBottom: "1px solid #333",
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
  },
  content: {
    flex: 1,
    overflowY: "auto" as const,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: "#888",
    marginBottom: 8,
    textTransform: "uppercase" as const,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    color: "#888",
    marginBottom: 4,
    display: "block",
  },
  input: {
    width: "100%",
    padding: "6px 8px",
    backgroundColor: "#252545",
    border: "1px solid #333",
    borderRadius: 4,
    color: "#fff",
    fontSize: 12,
    outline: "none",
  },
  select: {
    width: "100%",
    padding: "6px 8px",
    backgroundColor: "#252545",
    border: "1px solid #333",
    borderRadius: 4,
    color: "#fff",
    fontSize: 12,
    outline: "none",
  },
  checkbox: {
    marginRight: 8,
  },
  checkboxLabel: {
    fontSize: 12,
    color: "#ccc",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  button: {
    width: "100%",
    padding: "8px 12px",
    backgroundColor: "#3a3a5a",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#fff",
    fontSize: 12,
    cursor: "pointer",
    transition: "background-color 0.15s",
    marginTop: 8,
  },
  row: {
    display: "flex",
    gap: 8,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "#666",
    fontSize: 12,
    textAlign: "center" as const,
    padding: 20,
  },
};

// ============================================================================
// Sheet Properties Component
// ============================================================================

function SheetProperties() {
  const drawing = useDrawingStore((s) => s.drawing);
  const setSheetSize = useDrawingStore((s) => s.setSheetSize);

  const sheetSizes: SheetSize[] = ["A4", "A3", "A2", "A1", "A0", "Letter", "Tabloid"];

  if (!drawing) return null;

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Sheet</div>

      <div style={styles.field}>
        <label style={styles.label}>Size</label>
        <select
          style={styles.select}
          value={drawing.sheet.size}
          onChange={(e) => setSheetSize(e.target.value as SheetSize)}
        >
          {sheetSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.row}>
        <div style={{ ...styles.field, flex: 1 }}>
          <label style={styles.label}>Width (mm)</label>
          <input style={styles.input} type="number" value={drawing.sheet.width} readOnly />
        </div>
        <div style={{ ...styles.field, flex: 1 }}>
          <label style={styles.label}>Height (mm)</label>
          <input style={styles.input} type="number" value={drawing.sheet.height} readOnly />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// View Properties Component
// ============================================================================

function ViewProperties() {
  const drawing = useDrawingStore((s) => s.drawing);
  const selectedViews = useDrawingStore((s) => s.selectedViews);
  const updateView = useDrawingStore((s) => s.updateView);

  if (!drawing || selectedViews.size === 0) return null;

  const viewId = Array.from(selectedViews)[0];
  const view = drawing.views.get(viewId);
  if (!view) return null;

  const projections: ViewProjection[] = [
    "front",
    "back",
    "top",
    "bottom",
    "left",
    "right",
    "isometric",
    "dimetric",
    "trimetric",
  ];

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>View: {view.name}</div>

      <div style={styles.field}>
        <label style={styles.label}>Name</label>
        <input
          style={styles.input}
          type="text"
          value={view.name}
          onChange={(e) => updateView(viewId, { name: e.target.value })}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Source File</label>
        <input style={styles.input} type="text" value={view.sourceRef.path} readOnly />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Projection</label>
        <select
          style={styles.select}
          value={view.projection}
          onChange={(e) => updateView(viewId, { projection: e.target.value as ViewProjection })}
        >
          {projections.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Scale (1:X)</label>
        <input
          style={styles.input}
          type="number"
          step={0.1}
          min={0.1}
          max={10}
          value={1 / view.scale}
          onChange={(e) => {
            const scaleInverse = parseFloat(e.target.value);
            if (scaleInverse > 0) {
              updateView(viewId, { scale: 1 / scaleInverse });
            }
          }}
        />
      </div>

      <div style={styles.row}>
        <div style={{ ...styles.field, flex: 1 }}>
          <label style={styles.label}>X Position</label>
          <input
            style={styles.input}
            type="number"
            value={view.position[0].toFixed(1)}
            onChange={(e) =>
              updateView(viewId, { position: [parseFloat(e.target.value), view.position[1]] })
            }
          />
        </div>
        <div style={{ ...styles.field, flex: 1 }}>
          <label style={styles.label}>Y Position</label>
          <input
            style={styles.input}
            type="number"
            value={view.position[1].toFixed(1)}
            onChange={(e) =>
              updateView(viewId, { position: [view.position[0], parseFloat(e.target.value)] })
            }
          />
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Rotation (deg)</label>
        <input
          style={styles.input}
          type="number"
          step={15}
          value={view.rotation}
          onChange={(e) => updateView(viewId, { rotation: parseFloat(e.target.value) })}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={view.showHiddenLines}
            onChange={(e) => updateView(viewId, { showHiddenLines: e.target.checked })}
          />
          Show Hidden Lines
        </label>
      </div>

      <div style={styles.field}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={view.showCenterLines}
            onChange={(e) => updateView(viewId, { showCenterLines: e.target.checked })}
          />
          Show Center Lines
        </label>
      </div>
    </div>
  );
}

// ============================================================================
// Dimension Properties Component
// ============================================================================

function DimensionProperties() {
  const drawing = useDrawingStore((s) => s.drawing);
  const selectedDimensions = useDrawingStore((s) => s.selectedDimensions);
  const updateDimension = useDrawingStore((s) => s.updateDimension);

  if (!drawing || selectedDimensions.size === 0) return null;

  const dimId = Array.from(selectedDimensions)[0];
  const dim = drawing.dimensions.get(dimId);
  if (!dim) return null;

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Dimension</div>

      <div style={styles.field}>
        <label style={styles.label}>Type</label>
        <input style={styles.input} type="text" value={dim.type} readOnly />
      </div>

      {dim.type === "linear" && (
        <div style={styles.field}>
          <label style={styles.label}>Direction</label>
          <select
            style={styles.select}
            value={dim.direction}
            onChange={(e) =>
              updateDimension(dimId, { direction: e.target.value as "horizontal" | "vertical" | "aligned" })
            }
          >
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
            <option value="aligned">Aligned</option>
          </select>
        </div>
      )}

      <div style={styles.field}>
        <label style={styles.label}>Offset</label>
        <input
          style={styles.input}
          type="number"
          value={dim.type === "linear" ? dim.offset : 0}
          onChange={(e) => {
            if (dim.type === "linear") {
              updateDimension(dimId, { offset: parseFloat(e.target.value) });
            }
          }}
        />
      </div>

      <div style={styles.row}>
        <div style={{ ...styles.field, flex: 1 }}>
          <label style={styles.label}>Label X Offset</label>
          <input
            style={styles.input}
            type="number"
            value={dim.labelOffset[0]}
            onChange={(e) =>
              updateDimension(dimId, { labelOffset: [parseFloat(e.target.value), dim.labelOffset[1]] })
            }
          />
        </div>
        <div style={{ ...styles.field, flex: 1 }}>
          <label style={styles.label}>Label Y Offset</label>
          <input
            style={styles.input}
            type="number"
            value={dim.labelOffset[1]}
            onChange={(e) =>
              updateDimension(dimId, { labelOffset: [dim.labelOffset[0], parseFloat(e.target.value)] })
            }
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Content Component (for use in tabbed sidebars)
// ============================================================================

export function DrawingPropertiesContent() {
  const selectedViews = useDrawingStore((s) => s.selectedViews);
  const selectedDimensions = useDrawingStore((s) => s.selectedDimensions);
  const selectedAnnotations = useDrawingStore((s) => s.selectedAnnotations);

  const hasViewSelection = selectedViews.size > 0;
  const hasDimensionSelection = selectedDimensions.size > 0;
  const hasAnnotationSelection = selectedAnnotations.size > 0;
  const hasSelection = hasViewSelection || hasDimensionSelection || hasAnnotationSelection;

  return (
    <>
      <style>
        {`
          .drawing-properties-scroll::-webkit-scrollbar {
            width: 8px;
          }
          .drawing-properties-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .drawing-properties-scroll::-webkit-scrollbar-thumb {
            background: #444;
            border-radius: 4px;
          }
          .drawing-properties-scroll::-webkit-scrollbar-thumb:hover {
            background: #555;
          }
        `}
      </style>
      <div
        className="drawing-properties-scroll"
        style={{
          padding: 16,
          flex: 1,
          minHeight: 0,
          scrollbarWidth: "thin",
          scrollbarColor: "#444 transparent",
        }}
      >
        {/* Always show sheet properties */}
        <SheetProperties />

        {/* Context-sensitive properties */}
        {hasViewSelection && <ViewProperties />}
        {hasDimensionSelection && <DimensionProperties />}

        {!hasSelection && (
          <div style={styles.emptyState}>
            <div>Select a view, dimension, or annotation to edit its properties.</div>
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================================
// Main Component (standalone panel with container/header)
// ============================================================================

export function DrawingPropertiesPanel() {
  const selectedViews = useDrawingStore((s) => s.selectedViews);
  const selectedDimensions = useDrawingStore((s) => s.selectedDimensions);
  const selectedAnnotations = useDrawingStore((s) => s.selectedAnnotations);

  const hasViewSelection = selectedViews.size > 0;
  const hasDimensionSelection = selectedDimensions.size > 0;
  const hasAnnotationSelection = selectedAnnotations.size > 0;

  const title = hasViewSelection
    ? "View Properties"
    : hasDimensionSelection
    ? "Dimension Properties"
    : hasAnnotationSelection
    ? "Annotation Properties"
    : "Drawing Properties";

  return (
    <div style={styles.container}>
      <div style={styles.header}>{title}</div>
      <div style={styles.content}>
        <DrawingPropertiesContent />
      </div>
    </div>
  );
}

export default DrawingPropertiesPanel;
