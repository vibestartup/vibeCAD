/**
 * PcbEditor Page - main PCB layout editor view.
 */

import React, { useEffect, useState, useCallback } from "react";
import { EditorLayout } from "../layouts/EditorLayout";
import { PcbCanvas } from "../components/PcbCanvas";
import { PcbToolbar } from "../components/PcbToolbar";
import { PcbLeftSidebar, PcbRightSidebar } from "../components/PcbSidebars";
import { usePcbStore } from "../store/pcb-store";
import { useLibraryStore } from "../store/library-store";

// ============================================================================
// Status Bar
// ============================================================================

function StatusBar() {
  const pcb = usePcbStore((s) => s.pcb);
  const selectedInstances = usePcbStore((s) => s.selectedInstances);
  const selectedTraces = usePcbStore((s) => s.selectedTraces);
  const selectedVias = usePcbStore((s) => s.selectedVias);
  const mode = usePcbStore((s) => s.mode);
  const activeLayer = usePcbStore((s) => s.activeLayer);
  const routing = usePcbStore((s) => s.routing);

  const totalSelected = selectedInstances.size + selectedTraces.size + selectedVias.size;
  const instanceCount = pcb?.instances.size ?? 0;
  const traceCount = pcb?.traces.size ?? 0;
  const viaCount = pcb?.vias.size ?? 0;
  const layer = activeLayer && pcb ? pcb.layers.get(activeLayer) : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%" }}>
      {/* Selection info */}
      <span>
        {totalSelected > 0
          ? `${totalSelected} item${totalSelected > 1 ? "s" : ""} selected`
          : "No selection"}
      </span>

      {/* Stats */}
      <span style={{ color: "#666" }}>
        {instanceCount} footprints · {traceCount} traces · {viaCount} vias
      </span>

      {/* Mode indicator */}
      {routing && (
        <span style={{ color: "#4dabf7" }}>
          Routing on {layer?.name || "?"}
        </span>
      )}

      {/* Active layer */}
      {layer && !routing && (
        <span style={{ color: "#888" }}>
          Layer: {layer.name}
        </span>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Controls hint */}
      <span style={{ fontFamily: "monospace" }}>
        Pan: Middle Mouse · Zoom: Scroll · Route: X · Via: V · Select: V
      </span>
    </div>
  );
}

// ============================================================================
// PCB Editor Page
// ============================================================================

export function PcbEditor() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const undo = usePcbStore((s) => s.undo);
  const redo = usePcbStore((s) => s.redo);
  const clearSelection = usePcbStore((s) => s.clearSelection);
  const deleteSelection = usePcbStore((s) => s.deleteSelection);
  const cancelRoute = usePcbStore((s) => s.cancelRoute);
  const cancelPlaceFootprint = usePcbStore((s) => s.cancelPlaceFootprint);
  const routing = usePcbStore((s) => s.routing);
  const pendingFootprint = usePcbStore((s) => s.pendingFootprint);
  const setTool = usePcbStore((s) => s.setTool);
  const switchRouteLayer = usePcbStore((s) => s.switchRouteLayer);
  const placeViaAndSwitchLayer = usePcbStore((s) => s.placeViaAndSwitchLayer);
  const runDrc = usePcbStore((s) => s.runDrc);
  const pcb = usePcbStore((s) => s.pcb);
  const initPcb = usePcbStore((s) => s.initPcb);

  // Initialize stores
  const initializeLibraries = useLibraryStore((s) => s.initializeLibraries);

  // Initialize PCB on mount
  useEffect(() => {
    initPcb();
  }, [initPcb]);

  // Initialize libraries after PCB is ready
  useEffect(() => {
    if (!pcb) return;

    // Get layer IDs from PCB
    const layers = pcb.layers;
    let topCopper: any = null;
    let topSilk: any = null;
    let topFab: any = null;
    let topCrtYd: any = null;

    for (const [layerId, layer] of layers) {
      if (layer.name === "F.Cu") topCopper = layerId;
      if (layer.name === "F.SilkS") topSilk = layerId;
      if (layer.name === "F.Fab") topFab = layerId;
      if (layer.name === "F.CrtYd") topCrtYd = layerId;
    }

    if (topCopper && topSilk && topFab && topCrtYd) {
      initializeLibraries({
        topCopper,
        topSilk,
        topFab,
        topCrtYd,
      });
    }
  }, [pcb, initializeLibraries]);

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
          undo();
        } else if (e.key === "y" || (e.shiftKey && e.key === "z")) {
          e.preventDefault();
          redo();
        } else if (e.key === "a") {
          e.preventDefault();
          usePcbStore.getState().selectAll();
        }
      }

      // Tool shortcuts
      if (e.key === "x" || e.key === "X") {
        setTool("track");
      } else if (e.key === "v" || e.key === "V") {
        if (routing) {
          // Place via during routing
          placeViaAndSwitchLayer();
        } else {
          setTool("select");
        }
      } else if (e.key === "p" || e.key === "P") {
        setLibraryOpen(true);
      } else if (e.key === " ") {
        // Space to switch layer during routing
        if (routing) {
          e.preventDefault();
          switchRouteLayer();
        }
      }

      // Delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelection();
      }

      // Escape handling
      if (e.key === "Escape") {
        if (routing) {
          cancelRoute();
        } else if (pendingFootprint) {
          cancelPlaceFootprint();
        } else {
          clearSelection();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    undo,
    redo,
    deleteSelection,
    clearSelection,
    cancelRoute,
    cancelPlaceFootprint,
    routing,
    pendingFootprint,
    setTool,
    switchRouteLayer,
    placeViaAndSwitchLayer,
  ]);

  // DRC handler
  const handleRunDrc = useCallback(() => {
    runDrc();
  }, [runDrc]);

  // Gerber export handler
  const handleExportGerber = useCallback(() => {
    // TODO: Implement Gerber export
    alert("Gerber export not yet implemented");
  }, []);

  // 3D export handler
  const handleExport3d = useCallback(() => {
    // TODO: Implement 3D export
    alert("3D export not yet implemented");
  }, []);

  return (
    <EditorLayout
      toolbar={
        <PcbToolbar
          onOpenLibrary={() => setLibraryOpen(true)}
          onRunDrc={handleRunDrc}
          onExportGerber={handleExportGerber}
          onExport3d={handleExport3d}
        />
      }
      leftPanel={<PcbLeftSidebar />}
      rightPanel={<PcbRightSidebar />}
      leftCollapsed={leftCollapsed}
      onToggleLeft={() => setLeftCollapsed((c) => !c)}
      rightCollapsed={rightCollapsed}
      onToggleRight={() => setRightCollapsed((c) => !c)}
      viewport={<PcbCanvas />}
      statusBar={<StatusBar />}
    />
  );
}

export default PcbEditor;
