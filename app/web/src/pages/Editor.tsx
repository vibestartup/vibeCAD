/**
 * Editor Page - main CAD editor view.
 */

import React, { useEffect } from "react";
import { EditorLayout } from "../layouts/EditorLayout";
import { useCadStore, selectIsRebuilding } from "../store";

// Placeholder components until @vibecad/react is fully integrated
const Viewport3D = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#1a1a2e",
      color: "#666",
    }}
  >
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>&#x1F4D0;</div>
      <div>3D Viewport</div>
      <div style={{ fontSize: 12, color: "#444", marginTop: 8 }}>
        Three.js integration pending
      </div>
    </div>
  </div>
);

const FeatureTree = () => {
  const studio = useCadStore((s) => {
    const id = s.activeStudioId;
    return id ? s.document.partStudios.get(id) : null;
  });

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>
        {studio?.name ?? "No Studio"}
      </div>
      <div style={{ color: "#666", fontSize: 12 }}>
        {studio?.opOrder.length ?? 0} operations
      </div>
    </div>
  );
};

const ParamPanel = () => {
  const params = useCadStore((s) => s.document.params);
  const paramCount = params.params.size;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>Parameters</div>
      <div style={{ color: "#666", fontSize: 12 }}>{paramCount} parameters</div>
    </div>
  );
};

// ============================================================================
// Toolbar
// ============================================================================

function Toolbar() {
  const canUndo = useCadStore((s) => s.canUndo());
  const canRedo = useCadStore((s) => s.canRedo());
  const undo = useCadStore((s) => s.undo);
  const redo = useCadStore((s) => s.redo);
  const isRebuilding = useCadStore(selectIsRebuilding);

  const buttonStyle: React.CSSProperties = {
    padding: "6px 12px",
    border: "1px solid #333",
    borderRadius: 4,
    backgroundColor: "#2d2d4a",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    marginRight: 8,
  };

  const disabledStyle: React.CSSProperties = {
    ...buttonStyle,
    opacity: 0.5,
    cursor: "not-allowed",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* Logo */}
      <div
        style={{
          fontWeight: 700,
          fontSize: 16,
          color: "#646cff",
          marginRight: 24,
        }}
      >
        vibeCAD
      </div>

      {/* Undo/Redo */}
      <button
        onClick={undo}
        disabled={!canUndo}
        style={canUndo ? buttonStyle : disabledStyle}
        title="Undo (Ctrl+Z)"
      >
        ↩️ Undo
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        style={canRedo ? buttonStyle : disabledStyle}
        title="Redo (Ctrl+Y)"
      >
        ↪️ Redo
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Rebuild indicator */}
      {isRebuilding && (
        <div style={{ color: "#888", fontSize: 12 }}>Rebuilding...</div>
      )}
    </div>
  );
}

// ============================================================================
// Status Bar
// ============================================================================

function StatusBar() {
  const selection = useCadStore((s) => s.selection);
  const rebuildError = useCadStore((s) => s.rebuildError);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <span>
        {selection.size > 0
          ? `${selection.size} selected`
          : "No selection"}
      </span>

      {rebuildError && (
        <span style={{ color: "#ff6b6b" }}>Error: {rebuildError}</span>
      )}

      <div style={{ flex: 1 }} />

      <span>vibeCAD v0.0.1</span>
    </div>
  );
}

// ============================================================================
// Editor Page
// ============================================================================

export function Editor() {
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          useCadStore.getState().undo();
        } else if (e.key === "y" || (e.shiftKey && e.key === "z")) {
          e.preventDefault();
          useCadStore.getState().redo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <EditorLayout
      toolbar={<Toolbar />}
      leftPanel={<FeatureTree />}
      rightPanel={<ParamPanel />}
      viewport={<Viewport3D />}
      statusBar={<StatusBar />}
    />
  );
}

export default Editor;
