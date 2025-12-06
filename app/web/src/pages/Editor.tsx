/**
 * Editor Page - main CAD editor view.
 */

import React, { useEffect } from "react";
import { EditorLayout } from "../layouts/EditorLayout";
import { Toolbar, Viewport, OpTimeline, PropertiesPanel, SketchCanvas } from "../components";
import { useCadStore } from "../store";

// ============================================================================
// Status Bar
// ============================================================================

function StatusBar() {
  const selection = useCadStore((s) => s.selection);
  const rebuildError = useCadStore((s) => s.rebuildError);
  const isRebuilding = useCadStore((s) => s.isRebuilding);

  const studio = useCadStore((s) =>
    s.activeStudioId ? s.document.partStudios.get(s.activeStudioId) : null
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%" }}>
      {/* Selection info */}
      <span>
        {selection.size > 0
          ? `${selection.size} selected`
          : "No selection"}
      </span>

      {/* Op count */}
      {studio && (
        <span style={{ color: "#666" }}>
          {studio.opOrder.length} operations
        </span>
      )}

      {/* Rebuild status */}
      {isRebuilding && (
        <span style={{ color: "#4dabf7" }}>⟳ Rebuilding...</span>
      )}

      {/* Error display */}
      {rebuildError && (
        <span style={{ color: "#ff6b6b" }}>⚠ {rebuildError}</span>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Version */}
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
      // Don't handle if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          useCadStore.getState().undo();
        } else if (e.key === "y" || (e.shiftKey && e.key === "z")) {
          e.preventDefault();
          useCadStore.getState().redo();
        } else if (e.key === "s") {
          e.preventDefault();
          console.log("Save (not implemented)");
        }
      }

      // Delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        const { selection } = useCadStore.getState();
        if (selection.size > 0) {
          e.preventDefault();
          console.log("Delete selection (not implemented)");
        }
      }

      // Escape to clear selection
      if (e.key === "Escape") {
        useCadStore.getState().setSelection(new Set());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <EditorLayout
      toolbar={<Toolbar />}
      leftPanel={<OpTimeline />}
      rightPanel={<PropertiesPanel />}
      viewport={
        <>
          <Viewport />
          <SketchCanvas />
        </>
      }
      statusBar={<StatusBar />}
    />
  );
}

export default Editor;
