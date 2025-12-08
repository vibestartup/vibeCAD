/**
 * SchematicEditor Page - main schematic editor view.
 */

import React, { useEffect, useState, useCallback } from "react";
import { EditorLayout } from "../layouts/EditorLayout";
import { SchematicCanvas } from "../components/SchematicCanvas";
import { SchematicToolbar } from "../components/SchematicToolbar";
import { SchematicLeftSidebar, SchematicRightSidebar } from "../components/SchematicSidebars";
import { useSchematicStore } from "../store/schematic-store";
import { useLibraryStore } from "../store/library-store";

// ============================================================================
// Status Bar
// ============================================================================

function StatusBar() {
  const schematic = useSchematicStore((s) => s.schematic);
  const selectedInstances = useSchematicStore((s) => s.selectedInstances);
  const selectedWires = useSchematicStore((s) => s.selectedWires);
  const mode = useSchematicStore((s) => s.mode);
  const activeTool = useSchematicStore((s) => s.activeTool);

  const totalSelected = selectedInstances.size + selectedWires.size;
  const componentCount = schematic.symbolInstances.size;
  const netCount = schematic.nets.size;

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
        {componentCount} components · {netCount} nets
      </span>

      {/* Mode indicator */}
      <span style={{ color: "#4dabf7" }}>
        {mode === "draw-wire" ? "Drawing Wire" : mode === "place-symbol" ? "Placing Symbol" : ""}
      </span>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Controls hint */}
      <span style={{ fontFamily: "monospace" }}>
        Pan: Middle Mouse · Zoom: Scroll · Wire: W · Select: V
      </span>
    </div>
  );
}

// ============================================================================
// Schematic Editor Page
// ============================================================================

export function SchematicEditor() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const undo = useSchematicStore((s) => s.undo);
  const redo = useSchematicStore((s) => s.redo);
  const clearSelection = useSchematicStore((s) => s.clearSelection);
  const deleteSelection = useSchematicStore((s) => s.deleteSelection);
  const cancelWire = useSchematicStore((s) => s.cancelWire);
  const cancelPlaceSymbol = useSchematicStore((s) => s.cancelPlaceSymbol);
  const wireDrawing = useSchematicStore((s) => s.wireDrawing);
  const pendingSymbol = useSchematicStore((s) => s.pendingSymbol);
  const setTool = useSchematicStore((s) => s.setTool);

  // Initialize library store
  const initializeLibraries = useLibraryStore((s) => s.initializeLibraries);

  useEffect(() => {
    // Initialize with dummy layer IDs for now (schematic doesn't need PCB layers)
    initializeLibraries({
      topCopper: "layer_topCu" as any,
      topSilk: "layer_topSilk" as any,
      topFab: "layer_topFab" as any,
      topCrtYd: "layer_topCrtYd" as any,
    });
  }, [initializeLibraries]);

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
          useSchematicStore.getState().selectAll();
        }
      }

      // Tool shortcuts
      if (e.key === "w" || e.key === "W") {
        setTool("wire");
      } else if (e.key === "v" || e.key === "V") {
        setTool("select");
      } else if (e.key === "p" || e.key === "P") {
        setLibraryOpen(true);
      }

      // Delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelection();
      }

      // Escape handling
      if (e.key === "Escape") {
        if (wireDrawing) {
          cancelWire();
        } else if (pendingSymbol) {
          cancelPlaceSymbol();
        } else {
          clearSelection();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, deleteSelection, clearSelection, cancelWire, cancelPlaceSymbol, wireDrawing, pendingSymbol, setTool]);

  // ERC handler
  const handleRunErc = useCallback(() => {
    // TODO: Implement ERC
    alert("ERC not yet implemented");
  }, []);

  // Netlist export handler
  const handleExportNetlist = useCallback(() => {
    // TODO: Implement netlist export
    alert("Netlist export not yet implemented");
  }, []);

  return (
    <EditorLayout
      toolbar={
        <SchematicToolbar
          onOpenLibrary={() => setLibraryOpen(true)}
          onRunErc={handleRunErc}
          onExportNetlist={handleExportNetlist}
        />
      }
      leftPanel={<SchematicLeftSidebar />}
      rightPanel={<SchematicRightSidebar />}
      leftCollapsed={leftCollapsed}
      onToggleLeft={() => setLeftCollapsed((c) => !c)}
      rightCollapsed={rightCollapsed}
      onToggleRight={() => setRightCollapsed((c) => !c)}
      viewport={<SchematicCanvas />}
      statusBar={<StatusBar />}
    />
  );
}

export default SchematicEditor;
