/**
 * Editor Page - main CAD editor view.
 */

import React, { useEffect, useState, useCallback } from "react";
import { EditorLayout } from "../layouts/EditorLayout";
import { Toolbar, Viewport, LeftSidebar, RightSidebar, SketchCanvas } from "../components";
import { SettingsModal } from "../components/SettingsModal";
import { AboutModal } from "../components/AboutModal";
import { MyLibrary } from "../components/MyLibrary";
import { useCadStore } from "../store";
import { useFileStore, serializeDocument, downloadFile } from "../store/file-store";
import { captureThumbnail } from "../utils/viewport-capture";

// ============================================================================
// Status Bar
// ============================================================================

function StatusBar() {
  const objectSelection = useCadStore((s) => s.objectSelection);
  const rebuildError = useCadStore((s) => s.rebuildError);
  const isRebuilding = useCadStore((s) => s.isRebuilding);
  const editorMode = useCadStore((s) => s.editorMode);

  const studio = useCadStore((s) => s.studio);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%" }}>
      {/* Selection info */}
      <span>
        {objectSelection.size > 0
          ? `${objectSelection.size} object${objectSelection.size > 1 ? 's' : ''} selected`
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

      {/* Camera controls hint (right side) */}
      {editorMode !== "select-plane" && (
        <span style={{ fontFamily: "monospace" }}>
          Orbit: Left Mouse · Pan: Right Mouse · Zoom: Scroll
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Editor Page
// ============================================================================

// Layout constants (must match EditorLayout)
const TOOLBAR_HEIGHT = 48;
const RIGHT_PANEL_WIDTH = 280;
const PANEL_MARGIN = 12;
const VIEWCUBE_GAP = 12;

export function Editor() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const studioForSave = useCadStore((s) => s.studio);
  const fileStore = useFileStore();
  const resetDocument = useCadStore((s) => s.resetDocument);

  // Save project with thumbnail capture
  const handleSaveProject = useCallback(async () => {
    // Capture thumbnail from viewport
    const thumbnail = captureThumbnail(200, 150, 0.7);
    // Save with thumbnail
    await fileStore.savePartStudio(studioForSave, { thumbnail: thumbnail ?? undefined });
  }, [studioForSave, fileStore]);

  // Download project as file
  const handleDownloadProject = useCallback(() => {
    const content = JSON.stringify(serializeDocument(studioForSave), null, 2);
    const filename = studioForSave.name.replace(/\s+/g, "_") + ".vibecad";
    downloadFile(content, filename);
  }, [studioForSave]);

  // ViewCube positioning (accounts for toolbar and right panel collapse state)
  const viewCubeTopOffset = TOOLBAR_HEIGHT + VIEWCUBE_GAP;
  const viewCubeRightOffset = rightCollapsed
    ? VIEWCUBE_GAP
    : PANEL_MARGIN + RIGHT_PANEL_WIDTH + VIEWCUBE_GAP;

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
          handleSaveProject();
        } else if (e.key === "o") {
          e.preventDefault();
          setLibraryOpen(true);
        }
      }

      // Delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        const { objectSelection } = useCadStore.getState();
        if (objectSelection.size > 0) {
          e.preventDefault();
          console.log("Delete selection (not implemented)");
        }
      }

      // Escape to clear both selections (unless a modal is open)
      if (e.key === "Escape" && !settingsOpen && !libraryOpen && !aboutOpen) {
        const store = useCadStore.getState();
        store.clearObjectSelection();
        store.clearOpSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveProject, settingsOpen, libraryOpen, aboutOpen]);

  return (
    <>
      <EditorLayout
        toolbar={
          <Toolbar
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenLibrary={() => setLibraryOpen(true)}
            onSaveProject={handleSaveProject}
            onDownloadProject={handleDownloadProject}
            onNewProject={() => {
              if (confirm("Create a new project? Unsaved changes will be lost.")) {
                resetDocument();
              }
            }}
            onOpenAbout={() => setAboutOpen(true)}
          />
        }
        leftPanel={<LeftSidebar />}
        rightPanel={<RightSidebar />}
        leftCollapsed={leftCollapsed}
        onToggleLeft={() => setLeftCollapsed((c) => !c)}
        rightCollapsed={rightCollapsed}
        onToggleRight={() => setRightCollapsed((c) => !c)}
        viewport={
          <>
            <Viewport
              viewCubeTopOffset={viewCubeTopOffset}
              viewCubeRightOffset={viewCubeRightOffset}
            />
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
      <AboutModal
        isOpen={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />
    </>
  );
}

export default Editor;
