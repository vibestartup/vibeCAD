/**
 * DrawingEditor - Main component for 2D technical drawing editing.
 *
 * Uses EditorLayout for consistent UI with other editor modes.
 */

import React, { useState, useCallback, useEffect } from "react";
import { EditorLayout } from "../../layouts/EditorLayout";
import { useDrawingStore } from "../../store/drawing-store";
import { DrawingCanvas } from "./DrawingCanvas";
import { DrawingToolbar } from "./DrawingToolbar";
import { DrawingLeftSidebar, DrawingRightSidebar } from "./DrawingSidebars";
import type { ViewProjection } from "@vibecad/core";

// ============================================================================
// Status Bar
// ============================================================================

function StatusBar() {
  const drawing = useDrawingStore((s) => s.drawing);
  const sheetZoom = useDrawingStore((s) => s.sheetZoom);
  const editorMode = useDrawingStore((s) => s.editorMode);
  const selectedViews = useDrawingStore((s) => s.selectedViews);
  const selectedDimensions = useDrawingStore((s) => s.selectedDimensions);
  const selectedAnnotations = useDrawingStore((s) => s.selectedAnnotations);
  const isRecomputing = useDrawingStore((s) => s.isRecomputing);

  const totalSelected = selectedViews.size + selectedDimensions.size + selectedAnnotations.size;

  if (!drawing) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%" }}>
      {/* Sheet info */}
      <span>
        Sheet: {drawing.sheet.size} ({drawing.sheet.width} x {drawing.sheet.height} mm)
      </span>

      {/* Zoom */}
      <span style={{ color: "#666" }}>Zoom: {(sheetZoom * 100).toFixed(0)}%</span>

      {/* Counts */}
      <span style={{ color: "#666" }}>
        {drawing.views.size} views · {drawing.dimensions.size} dimensions
      </span>

      {/* Selection */}
      {totalSelected > 0 && (
        <span style={{ color: "#646cff" }}>
          {totalSelected} selected
        </span>
      )}

      {/* Mode */}
      {editorMode !== "select" && (
        <span style={{ color: "#ffa500" }}>Mode: {editorMode}</span>
      )}

      {/* Recomputing */}
      {isRecomputing && (
        <span style={{ color: "#00ff00" }}>Recomputing...</span>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Controls hint */}
      <span style={{ fontFamily: "monospace" }}>
        Pan: Middle Mouse · Zoom: Scroll
      </span>
    </div>
  );
}

// ============================================================================
// Add View Modal
// ============================================================================

interface AddViewModalProps {
  onClose: () => void;
  onConfirm: (sourcePath: string, projection: ViewProjection, scale: number) => void;
}

const modalStyles = {
  overlay: {
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
  content: {
    backgroundColor: "#1a1a2e",
    border: "1px solid #444",
    borderRadius: 8,
    padding: 24,
    minWidth: 360,
    maxWidth: 480,
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: "#fff",
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 12,
    color: "#888",
    marginBottom: 4,
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    backgroundColor: "#252545",
    border: "1px solid #333",
    borderRadius: 4,
    color: "#fff",
    fontSize: 13,
    outline: "none",
  },
  select: {
    width: "100%",
    padding: "8px 12px",
    backgroundColor: "#252545",
    border: "1px solid #333",
    borderRadius: 4,
    color: "#fff",
    fontSize: 13,
    outline: "none",
  },
  buttons: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 20,
  },
  button: {
    padding: "8px 16px",
    borderRadius: 4,
    fontSize: 13,
    cursor: "pointer",
    border: "none",
  },
  buttonPrimary: {
    backgroundColor: "#646cff",
    color: "#fff",
  },
  buttonSecondary: {
    backgroundColor: "#333",
    color: "#ccc",
  },
};

function AddViewModal({ onClose, onConfirm }: AddViewModalProps) {
  const [sourcePath, setSourcePath] = useState("./part.vibecad");
  const [projection, setProjection] = useState<ViewProjection>("front");
  const [scale, setScale] = useState(1);

  const projections: ViewProjection[] = [
    "front", "back", "top", "bottom", "left", "right",
    "isometric", "dimetric", "trimetric",
  ];

  const handleConfirm = () => {
    onConfirm(sourcePath, projection, scale);
    onClose();
  };

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.content} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.title}>Add View</div>

        <div style={modalStyles.field}>
          <label style={modalStyles.label}>Source File (relative path)</label>
          <input
            style={modalStyles.input}
            type="text"
            value={sourcePath}
            onChange={(e) => setSourcePath(e.target.value)}
            placeholder="./part.vibecad"
          />
        </div>

        <div style={modalStyles.field}>
          <label style={modalStyles.label}>Projection</label>
          <select
            style={modalStyles.select}
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

        <div style={modalStyles.field}>
          <label style={modalStyles.label}>Scale (1:X)</label>
          <input
            style={modalStyles.input}
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

        <div style={modalStyles.buttons}>
          <button style={{ ...modalStyles.button, ...modalStyles.buttonSecondary }} onClick={onClose}>
            Cancel
          </button>
          <button style={{ ...modalStyles.button, ...modalStyles.buttonPrimary }} onClick={handleConfirm}>
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
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [showAddViewModal, setShowAddViewModal] = useState(false);

  const drawing = useDrawingStore((s) => s.drawing);
  const startViewPlacement = useDrawingStore((s) => s.startViewPlacement);
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

  // Show loading state while drawing initializes
  if (!drawing) {
    return (
      <div style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f0f1a",
        color: "#888",
      }}>
        Loading drawing...
      </div>
    );
  }

  return (
    <>
      <EditorLayout
        toolbar={
          <DrawingToolbar
            onAddView={handleAddView}
            onRecompute={handleRecompute}
          />
        }
        leftPanel={<DrawingLeftSidebar />}
        rightPanel={<DrawingRightSidebar />}
        leftCollapsed={leftCollapsed}
        onToggleLeft={() => setLeftCollapsed((c) => !c)}
        rightCollapsed={rightCollapsed}
        onToggleRight={() => setRightCollapsed((c) => !c)}
        viewport={<DrawingCanvas />}
        statusBar={<StatusBar />}
      />

      {/* Add View Modal */}
      {showAddViewModal && (
        <AddViewModal
          onClose={() => setShowAddViewModal(false)}
          onConfirm={handleConfirmAddView}
        />
      )}
    </>
  );
}

export default DrawingEditor;
