/**
 * Editor Page - main CAD editor view.
 */

import React, { useEffect, useState } from "react";
import { EditorLayout } from "../layouts/EditorLayout";
import { Toolbar, Viewport, OpTimeline, PropertiesPanel, SketchCanvas } from "../components";
import { SettingsModal } from "../components/SettingsModal";
import { MyLibrary } from "../components/MyLibrary";
import { useCadStore } from "../store";
import { useProjectStore } from "../store/project-store";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const document = useCadStore((s) => s.document);
  const saveProject = useProjectStore((s) => s.saveProject);
  const downloadProject = useProjectStore((s) => s.downloadProject);

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
          saveProject(document);
        } else if (e.key === "o") {
          e.preventDefault();
          setLibraryOpen(true);
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

      // Escape to clear selection (unless a modal is open)
      if (e.key === "Escape" && !settingsOpen && !libraryOpen) {
        useCadStore.getState().setSelection(new Set());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [document, saveProject, settingsOpen, libraryOpen]);

  return (
    <>
      <EditorLayout
        toolbar={
          <Toolbar
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenLibrary={() => setLibraryOpen(true)}
            onSaveProject={() => saveProject(document)}
            onDownloadProject={() => downloadProject(document)}
          />
        }
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

      {/* Modals */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <MyLibrary
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
      />
    </>
  );
}

export default Editor;
