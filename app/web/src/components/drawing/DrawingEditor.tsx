/**
 * DrawingEditor - Main component for 2D technical drawing editing.
 *
 * Combines the canvas, toolbar, and properties panel into a complete editor.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useDrawingStore } from "../../store/drawing-store";
import { DrawingCanvas } from "./DrawingCanvas";
import { DrawingToolbar } from "./DrawingToolbar";
import { DrawingPropertiesPanel } from "./DrawingPropertiesPanel";
import type { ViewProjection } from "@vibecad/core";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: "flex",
    width: "100%",
    height: "100%",
    backgroundColor: "#0f0f1a",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  canvas: {
    flex: 1,
    overflow: "hidden",
  },
  statusBar: {
    height: 24,
    backgroundColor: "#1a1a2e",
    borderTop: "1px solid #333",
    display: "flex",
    alignItems: "center",
    padding: "0 12px",
    fontSize: 11,
    color: "#888",
    gap: 16,
  },
  statusItem: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  modal: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "#1a1a2e",
    border: "1px solid #444",
    borderRadius: 8,
    padding: 24,
    minWidth: 360,
    maxWidth: 480,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#fff",
    marginBottom: 16,
  },
  modalField: {
    marginBottom: 16,
  },
  modalLabel: {
    display: "block",
    fontSize: 12,
    color: "#888",
    marginBottom: 4,
  },
  modalInput: {
    width: "100%",
    padding: "8px 12px",
    backgroundColor: "#252545",
    border: "1px solid #333",
    borderRadius: 4,
    color: "#fff",
    fontSize: 13,
    outline: "none",
  },
  modalSelect: {
    width: "100%",
    padding: "8px 12px",
    backgroundColor: "#252545",
    border: "1px solid #333",
    borderRadius: 4,
    color: "#fff",
    fontSize: 13,
    outline: "none",
  },
  modalButtons: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 20,
  },
  modalButton: {
    padding: "8px 16px",
    borderRadius: 4,
    fontSize: 13,
    cursor: "pointer",
    border: "none",
  },
  modalButtonPrimary: {
    backgroundColor: "#646cff",
    color: "#fff",
  },
  modalButtonSecondary: {
    backgroundColor: "#333",
    color: "#ccc",
  },
};

// ============================================================================
// Add View Modal
// ============================================================================

interface AddViewModalProps {
  onClose: () => void;
  onConfirm: (sourcePath: string, projection: ViewProjection, scale: number) => void;
}

function AddViewModal({ onClose, onConfirm }: AddViewModalProps) {
  const [sourcePath, setSourcePath] = useState("./part.vibecad");
  const [projection, setProjection] = useState<ViewProjection>("front");
  const [scale, setScale] = useState(1);

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

  const handleConfirm = () => {
    onConfirm(sourcePath, projection, scale);
    onClose();
  };

  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalTitle}>Add View</div>

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Source File (relative path)</label>
          <input
            style={styles.modalInput}
            type="text"
            value={sourcePath}
            onChange={(e) => setSourcePath(e.target.value)}
            placeholder="./part.vibecad"
          />
        </div>

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Projection</label>
          <select
            style={styles.modalSelect}
            value={projection}
            onChange={(e) => setProjection(e.target.value as ViewProjection)}
          >
            {projections.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Scale (1:X)</label>
          <input
            style={styles.modalInput}
            type="number"
            step={0.5}
            min={0.1}
            max={100}
            value={1 / scale}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (val > 0) setScale(1 / val);
            }}
          />
        </div>

        <div style={styles.modalButtons}>
          <button style={{ ...styles.modalButton, ...styles.modalButtonSecondary }} onClick={onClose}>
            Cancel
          </button>
          <button style={{ ...styles.modalButton, ...styles.modalButtonPrimary }} onClick={handleConfirm}>
            Add View
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DrawingEditor() {
  const [showAddViewModal, setShowAddViewModal] = useState(false);

  const drawing = useDrawingStore((s) => s.drawing);
  const sheetZoom = useDrawingStore((s) => s.sheetZoom);
  const editorMode = useDrawingStore((s) => s.editorMode);
  const selectedViews = useDrawingStore((s) => s.selectedViews);
  const selectedDimensions = useDrawingStore((s) => s.selectedDimensions);
  const selectedAnnotations = useDrawingStore((s) => s.selectedAnnotations);
  const startViewPlacement = useDrawingStore((s) => s.startViewPlacement);
  const isRecomputing = useDrawingStore((s) => s.isRecomputing);
  const recomputeViews = useDrawingStore((s) => s.recomputeViews);
  const initDrawing = useDrawingStore((s) => s.initDrawing);

  // Initialize drawing on mount
  useEffect(() => {
    initDrawing();
  }, [initDrawing]);

  const handleAddView = useCallback(() => {
    setShowAddViewModal(true);
  }, []);

  const handleConfirmAddView = useCallback(
    (sourcePath: string, projection: ViewProjection, scale: number) => {
      startViewPlacement(sourcePath, projection, scale);
    },
    [startViewPlacement]
  );

  const handleRecompute = useCallback(() => {
    recomputeViews();
  }, [recomputeViews]);

  const totalSelected = selectedViews.size + selectedDimensions.size + selectedAnnotations.size;

  // Show loading state while drawing initializes
  if (!drawing) {
    return (
      <div style={{ ...styles.container, alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#888" }}>Loading drawing...</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Left toolbar */}
      <DrawingToolbar onAddView={handleAddView} onRecompute={handleRecompute} />

      {/* Main canvas area */}
      <div style={styles.main}>
        <div style={styles.canvas}>
          <DrawingCanvas />
        </div>

        {/* Status bar */}
        <div style={styles.statusBar}>
          <div style={styles.statusItem}>
            <span>Sheet:</span>
            <span style={{ color: "#fff" }}>
              {drawing.sheet.size} ({drawing.sheet.width} x {drawing.sheet.height} mm)
            </span>
          </div>
          <div style={styles.statusItem}>
            <span>Zoom:</span>
            <span style={{ color: "#fff" }}>{(sheetZoom * 100).toFixed(0)}%</span>
          </div>
          <div style={styles.statusItem}>
            <span>Views:</span>
            <span style={{ color: "#fff" }}>{drawing.views.size}</span>
          </div>
          <div style={styles.statusItem}>
            <span>Dimensions:</span>
            <span style={{ color: "#fff" }}>{drawing.dimensions.size}</span>
          </div>
          {totalSelected > 0 && (
            <div style={styles.statusItem}>
              <span style={{ color: "#646cff" }}>{totalSelected} selected</span>
            </div>
          )}
          {editorMode !== "select" && (
            <div style={styles.statusItem}>
              <span style={{ color: "#ffa500" }}>Mode: {editorMode}</span>
            </div>
          )}
          {isRecomputing && (
            <div style={styles.statusItem}>
              <span style={{ color: "#00ff00" }}>Recomputing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Right properties panel */}
      <DrawingPropertiesPanel />

      {/* Add View Modal */}
      {showAddViewModal && (
        <AddViewModal onClose={() => setShowAddViewModal(false)} onConfirm={handleConfirmAddView} />
      )}
    </div>
  );
}

export default DrawingEditor;
