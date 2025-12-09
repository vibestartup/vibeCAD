import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { TabBar } from "./components/TabBar";
import { AppLayout } from "./layouts/AppLayout";
import {
  useTabsStore,
  createCadTab,
  createDrawingTab,
  createSchematicTab,
  createPcbTab,
  createImageTabFromFile,
  createRawTabFromFile,
  createTextTabFromFile,
  createPdfTabFromFile,
  createMarkdownTabFromFile,
  createVideoTabFromFile,
  createAudioTabFromFile,
  createModel3dTabFromFile,
  getDocumentTypeFromFile,
  type ImageDocument,
  type TextDocument,
  type PdfDocument,
  type MarkdownDocument,
  type VideoDocument,
  type AudioDocument,
  type Model3dDocument,
  type RawDocument,
  type CadDocument,
  type DrawingDocument,
} from "./store/tabs-store";
import { useCadStore } from "./store/cad-store";
import { useDrawingStore } from "./store/drawing-store";
import { useSchematicStore } from "./store/schematic-store";
import { usePcbStore } from "./store/pcb-store";
import { useDocumentViewStore } from "./store/document-view-store";
import { useLibraryStore } from "./store/library-store";
// Import as namespace to avoid module initialization timing issues
import * as VibeCadCore from "@vibecad/core";
import type { TabDefinition } from "./components/TabbedSidebar";

// Import viewers
import { ImageViewer } from "./components/ImageViewer";
import { TextViewer } from "./components/TextViewer";
import { PdfViewer } from "./components/PdfViewer";
import { MarkdownViewer } from "./components/MarkdownViewer";
import { VideoViewer } from "./components/VideoViewer";
import { AudioViewer } from "./components/AudioViewer";
import { Model3dViewer } from "./components/Model3dViewer";
import { RawFileViewer } from "./components/RawFileViewer";

// Import CAD components
import { Toolbar, Viewport, SketchCanvas } from "./components";
import { SettingsModal } from "./components/SettingsModal";
import { AboutModal } from "./components/AboutModal";
import { MyLibrary } from "./components/MyLibrary";
import { OpTimelineContent } from "./components/OpTimeline";
import { PropertiesContent, ParametersContent, RenderContent } from "./components/PropertiesPanel";
import { ImageEditorSidebar } from "./components/ImageEditorSidebar";

// Import Drawing components
import { DrawingCanvas } from "./components/drawing/DrawingCanvas";
import { DrawingToolbar } from "./components/drawing/DrawingToolbar";
import {
  DrawingViewsContent,
  DrawingDimensionsContent,
  DrawingSheetContent,
  DrawingPropertiesContent,
} from "./components/drawing/DrawingSidebars";

// Import Schematic components
import { SchematicCanvas } from "./components/SchematicCanvas";
import { SchematicToolbar } from "./components/SchematicToolbar";
import {
  SchematicComponentsContent,
  SchematicNetsContent,
  SchematicSheetsContent,
  SchematicPropertiesContent,
  SchematicLibraryContent,
  SchematicInfoContent,
} from "./components/SchematicSidebars";

// Import PCB components
import { PcbCanvas } from "./components/PcbCanvas";
import { PcbToolbar } from "./components/PcbToolbar";
import {
  PcbComponentsContent,
  PcbLayersContent,
  PcbNetsContent,
  PcbPropertiesContent,
  PcbDrcContent,
  PcbBoardInfoContent,
} from "./components/PcbSidebars";

import { captureThumbnail } from "./utils/viewport-capture";
import { serializeDocument, downloadFile, useFileStore } from "./store/file-store";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    backgroundColor: "#0f0f1a",
  },

  main: {
    flex: 1,
    overflow: "hidden",
    position: "relative" as const,
  },

  emptyState: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f1a",
    color: "#555",
  },

  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.5,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "#666",
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 13,
    color: "#555",
    marginBottom: 24,
    textAlign: "center" as const,
    maxWidth: 300,
  },

  viewerContainer: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
};

// ============================================================================
// CAD Status Bar
// ============================================================================

function CadStatusBar() {
  const objectSelection = useCadStore((s) => s.objectSelection);
  const rebuildError = useCadStore((s) => s.rebuildError);
  const isRebuilding = useCadStore((s) => s.isRebuilding);
  const editorMode = useCadStore((s) => s.editorMode);
  const studio = useCadStore((s) => s.studio);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%" }}>
      <span>
        {objectSelection.size > 0
          ? `${objectSelection.size} object${objectSelection.size > 1 ? "s" : ""} selected`
          : "No selection"}
      </span>
      {studio && (
        <span style={{ color: "#666" }}>{studio.opOrder.length} operations</span>
      )}
      {isRebuilding && <span style={{ color: "#4dabf7" }}>Rebuilding...</span>}
      {rebuildError && <span style={{ color: "#ff6b6b" }}>{rebuildError}</span>}
      <div style={{ flex: 1 }} />
      {editorMode !== "select-plane" && (
        <span style={{ fontFamily: "monospace" }}>
          Orbit: Left Mouse | Pan: Right Mouse | Zoom: Scroll
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Schematic Status Bar
// ============================================================================

function SchematicStatusBar() {
  const schematic = useSchematicStore((s) => s.schematic);
  const selectedInstances = useSchematicStore((s) => s.selectedInstances);
  const selectedWires = useSchematicStore((s) => s.selectedWires);
  const mode = useSchematicStore((s) => s.mode);
  const wireDrawing = useSchematicStore((s) => s.wireDrawing);

  const totalSelected = selectedInstances.size + selectedWires.size;
  const componentCount = schematic?.symbolInstances.size ?? 0;
  const netCount = schematic?.nets.size ?? 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%" }}>
      <span>
        {totalSelected > 0
          ? `${totalSelected} item${totalSelected > 1 ? "s" : ""} selected`
          : "No selection"}
      </span>
      <span style={{ color: "#666" }}>
        {componentCount} components · {netCount} nets
      </span>
      {wireDrawing && (
        <span style={{ color: "#4dabf7" }}>Drawing Wire</span>
      )}
      <div style={{ flex: 1 }} />
      <span style={{ fontFamily: "monospace" }}>
        Pan: Middle Mouse · Zoom: Scroll · Wire: W · Select: V
      </span>
    </div>
  );
}

// ============================================================================
// PCB Status Bar
// ============================================================================

function PcbStatusBar() {
  const pcb = usePcbStore((s) => s.pcb);
  const selectedInstances = usePcbStore((s) => s.selectedInstances);
  const selectedTraces = usePcbStore((s) => s.selectedTraces);
  const selectedVias = usePcbStore((s) => s.selectedVias);
  const activeLayer = usePcbStore((s) => s.activeLayer);
  const routing = usePcbStore((s) => s.routing);

  const totalSelected = selectedInstances.size + selectedTraces.size + selectedVias.size;
  const instanceCount = pcb?.instances.size ?? 0;
  const traceCount = pcb?.traces.size ?? 0;
  const viaCount = pcb?.vias.size ?? 0;
  const layer = activeLayer && pcb ? pcb.layers.get(activeLayer) : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%" }}>
      <span>
        {totalSelected > 0
          ? `${totalSelected} item${totalSelected > 1 ? "s" : ""} selected`
          : "No selection"}
      </span>
      <span style={{ color: "#666" }}>
        {instanceCount} footprints · {traceCount} traces · {viaCount} vias
      </span>
      {routing && layer && (
        <span style={{ color: "#4dabf7" }}>
          Routing on {layer.name}
        </span>
      )}
      {layer && !routing && (
        <span style={{ color: "#888" }}>
          Layer: {layer.name}
        </span>
      )}
      <div style={{ flex: 1 }} />
      <span style={{ fontFamily: "monospace" }}>
        Pan: Middle Mouse · Zoom: Scroll · Route: X · Via: V · Select: V
      </span>
    </div>
  );
}

// ============================================================================
// Drawing Status Bar
// ============================================================================

function DrawingStatusBar() {
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
      <span>
        Sheet: {drawing.sheet.size} ({drawing.sheet.width} x {drawing.sheet.height} mm)
      </span>
      <span style={{ color: "#666" }}>Zoom: {(sheetZoom * 100).toFixed(0)}%</span>
      <span style={{ color: "#666" }}>
        {drawing.views.size} views · {drawing.dimensions.size} dimensions
      </span>
      {totalSelected > 0 && (
        <span style={{ color: "#646cff" }}>{totalSelected} selected</span>
      )}
      {editorMode !== "select" && (
        <span style={{ color: "#ffa500" }}>Mode: {editorMode}</span>
      )}
      {isRecomputing && (
        <span style={{ color: "#00ff00" }}>Recomputing...</span>
      )}
      <div style={{ flex: 1 }} />
      <span style={{ fontFamily: "monospace" }}>
        Pan: Middle Mouse · Zoom: Scroll
      </span>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
  onNewCadDocument?: () => void;
  onOpenFile?: () => void;
}

function EmptyState({ onNewCadDocument, onOpenFile }: EmptyStateProps) {
  const [primaryHovered, setPrimaryHovered] = React.useState(false);
  const [secondaryHovered, setSecondaryHovered] = React.useState(false);

  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>&#x2B22;</div>
      <div style={styles.emptyTitle}>Welcome to vibeCAD</div>
      <div style={styles.emptyText}>
        Create a new CAD document or open an existing file to get started.
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {onNewCadDocument && (
          <button
            style={{
              padding: "10px 20px",
              borderRadius: 6,
              border: "none",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              backgroundColor: "#646cff",
              color: "#fff",
              ...(primaryHovered ? { transform: "translateY(-1px)" } : {}),
            }}
            onClick={onNewCadDocument}
            onMouseEnter={() => setPrimaryHovered(true)}
            onMouseLeave={() => setPrimaryHovered(false)}
          >
            + New CAD Document
          </button>
        )}
        {onOpenFile && (
          <button
            style={{
              padding: "10px 20px",
              borderRadius: 6,
              border: "1px solid #333",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              backgroundColor: secondaryHovered ? "#333" : "#252545",
              color: "#ccc",
            }}
            onClick={onOpenFile}
            onMouseEnter={() => setSecondaryHovered(true)}
            onMouseLeave={() => setSecondaryHovered(false)}
          >
            Open File
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ViewCube constants
// ============================================================================

const TOOLBAR_HEIGHT = 48;
const RIGHT_PANEL_WIDTH = 280;
const PANEL_MARGIN = 12;
const VIEWCUBE_GAP = 12;

// ============================================================================
// App Component
// ============================================================================

export const App: React.FC = () => {
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const openTab = useTabsStore((s) => s.openTab);
  const getTab = useTabsStore((s) => s.getTab);

  const setStudio = useCadStore((s) => s.setStudio);
  const studio = useCadStore((s) => s.studio);
  const resetDocument = useCadStore((s) => s.resetDocument);
  const fileStore = useFileStore();

  // Modal state
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);

  // Sidebar collapse state (for ViewCube positioning)
  const [rightCollapsed, setRightCollapsed] = React.useState(false);

  // Get active tab
  const activeTab = activeTabId ? getTab(activeTabId) : null;

  // Document view store for per-document state
  const docViewStore = useDocumentViewStore();
  const activeDocumentId = useDocumentViewStore((s) => s.activeDocumentId);

  // Track the last studio ID we loaded to avoid save-after-load loop
  const lastLoadedStudioIdRef = useRef<string | null>(null);

  // When active tab changes to a CAD document, switch the studio and restore view state
  useEffect(() => {
    // Get fresh tab data
    const tab = activeTabId ? getTab(activeTabId) : null;
    if (!tab) return;
    if (tab.type !== "cad") return;

    const cadTab = tab as CadDocument;
    const cadDocId = cadTab.cadDocumentId;

    // If this CAD document is already active, no need to switch
    if (activeDocumentId === cadDocId) return;

    console.log(`[App] Switching from ${activeDocumentId} to ${cadDocId}`);

    // Save current studio state before switching (if we have one loaded)
    const currentStudio = useCadStore.getState().studio;
    const cadStore = useCadStore.getState();
    if (activeDocumentId && currentStudio) {
      console.log(`[App] Saving document state for ${activeDocumentId}`);
      docViewStore.updateStudio(activeDocumentId, currentStudio);
      // Save other cad-store state to document view store
      docViewStore.updateTimelinePosition(cadStore.timelinePosition);
      docViewStore.updateEditorMode(cadStore.editorMode);
      docViewStore.updateActiveSketch(cadStore.activeSketchId);
      docViewStore.updateObjectSelection(cadStore.objectSelection);
      docViewStore.updateOpSelection(cadStore.opSelection);
    }

    // Set the new active document
    docViewStore.setActiveDocument(cadDocId);

    // Try to load from document view store
    const docState = docViewStore.getDocumentState(cadDocId);
    if (docState) {
      console.log(`[App] Loading document state for ${cadDocId}`);
      // Track that we're loading this studio ID - prevents save-after-load loop
      lastLoadedStudioIdRef.current = docState.studio.id;
      setStudio(docState.studio);
      // Restore view state to cad-store
      useCadStore.getState().setTimelinePosition(docState.timelinePosition);
      useCadStore.getState().setEditorMode(docState.editorMode);
      useCadStore.getState().setActiveSketch(docState.activeSketchId);
      useCadStore.getState().setObjectSelection(docState.objectSelection);
      useCadStore.getState().setOpSelection(docState.opSelection);
    } else {
      // Document not in store - this shouldn't happen normally since we add when creating
      // But handle it gracefully by creating a new one
      console.warn(`[App] CAD document ${cadDocId} not found in store, creating new`);
      const newStudio = VibeCadCore.createPartStudioWithCube(cadTab.name);
      // Track that we're loading this studio ID
      lastLoadedStudioIdRef.current = newStudio.id;
      docViewStore.initDocument(cadDocId, newStudio);
      setStudio(newStudio);
    }
  }, [activeTabId, getTab, setStudio, activeDocumentId, docViewStore]);

  // Keep document view store in sync with current studio changes
  // Using a ref to track the previous studio to avoid unnecessary updates
  const prevStudioRef = useRef<{ id: string; modifiedAt: number } | null>(null);

  useEffect(() => {
    if (!activeDocumentId || !studio) return;

    // Skip if we just loaded this studio (prevents infinite loop)
    if (lastLoadedStudioIdRef.current === studio.id) {
      lastLoadedStudioIdRef.current = null;
      prevStudioRef.current = { id: studio.id, modifiedAt: studio.meta.modifiedAt };
      return;
    }

    // Only update if the studio actually changed (compare by modifiedAt timestamp)
    if (
      prevStudioRef.current &&
      prevStudioRef.current.id === studio.id &&
      prevStudioRef.current.modifiedAt === studio.meta.modifiedAt
    ) {
      return;
    }

    prevStudioRef.current = { id: studio.id, modifiedAt: studio.meta.modifiedAt };
    docViewStore.updateStudio(activeDocumentId, studio);
  }, [studio, activeDocumentId, docViewStore]);

  // Initialize schematic when switching to schematic tab
  useEffect(() => {
    const tab = activeTabId ? getTab(activeTabId) : null;
    if (!tab || tab.type !== "schematic") return;

    // Initialize schematic store if needed
    useSchematicStore.getState().initSchematic();

    // Initialize library store with dummy layer IDs for schematic
    useLibraryStore.getState().initializeLibraries({
      topCopper: "layer_topCu" as any,
      topSilk: "layer_topSilk" as any,
      topFab: "layer_topFab" as any,
      topCrtYd: "layer_topCrtYd" as any,
    });
  }, [activeTabId, getTab]);

  // Initialize PCB when switching to PCB tab
  useEffect(() => {
    const tab = activeTabId ? getTab(activeTabId) : null;
    if (!tab || tab.type !== "pcb") return;

    // Initialize PCB store if needed
    usePcbStore.getState().initPcb();

    // Initialize library store with PCB layers
    const pcb = usePcbStore.getState().pcb;
    if (pcb) {
      let topCopper: any = null;
      let topSilk: any = null;
      let topFab: any = null;
      let topCrtYd: any = null;

      for (const [layerId, layer] of pcb.layers) {
        if (layer.name === "F.Cu") topCopper = layerId;
        if (layer.name === "F.SilkS") topSilk = layerId;
        if (layer.name === "F.Fab") topFab = layerId;
        if (layer.name === "F.CrtYd") topCrtYd = layerId;
      }

      if (topCopper && topSilk && topFab && topCrtYd) {
        useLibraryStore.getState().initializeLibraries({
          topCopper,
          topSilk,
          topFab,
          topCrtYd,
        });
      }
    }
  }, [activeTabId, getTab]);

  // Initialize Drawing when switching to drawing tab
  useEffect(() => {
    const tab = activeTabId ? getTab(activeTabId) : null;
    if (!tab || tab.type !== "drawing") return;

    // Initialize drawing store if needed
    useDrawingStore.getState().initDrawing();
  }, [activeTabId, getTab]);

  // Create new CAD document
  const handleNewCadDocument = useCallback(() => {
    // Save current document state before switching
    const cadStore = useCadStore.getState();
    if (activeDocumentId && cadStore.studio) {
      docViewStore.updateStudio(activeDocumentId, cadStore.studio);
      docViewStore.updateTimelinePosition(cadStore.timelinePosition);
      docViewStore.updateEditorMode(cadStore.editorMode);
      docViewStore.updateActiveSketch(cadStore.activeSketchId);
      docViewStore.updateObjectSelection(cadStore.objectSelection);
      docViewStore.updateOpSelection(cadStore.opSelection);
    }

    const newStudio = VibeCadCore.createPartStudioWithCube("Untitled");
    const tab = createCadTab(newStudio.name, newStudio.id);

    // Initialize document in view store
    docViewStore.initDocument(newStudio.id, newStudio);
    docViewStore.setActiveDocument(newStudio.id);

    setStudio(newStudio);
    openTab(tab);
  }, [setStudio, openTab, activeDocumentId, docViewStore]);

  // Create new Drawing
  const handleNewDrawing = useCallback(() => {
    const newDrawing = VibeCadCore.createDrawing("Untitled Drawing");
    const tab = createDrawingTab(newDrawing.name, newDrawing.id, []);

    // Set drawing in drawing store
    useDrawingStore.getState().setDrawing(newDrawing);

    openTab(tab);
  }, [openTab]);

  // Create new Schematic
  const handleNewSchematic = useCallback(() => {
    // Initialize the schematic store (it will create a new schematic if null)
    useSchematicStore.getState().initSchematic();
    const schematic = useSchematicStore.getState().schematic;
    if (schematic) {
      const tab = createSchematicTab(schematic.name, schematic.id);
      openTab(tab);
    }
  }, [openTab]);

  // Create new PCB
  const handleNewPcb = useCallback(() => {
    // Initialize the PCB store (it will create a new PCB if null)
    usePcbStore.getState().initPcb();
    const pcb = usePcbStore.getState().pcb;
    if (pcb) {
      const tab = createPcbTab(pcb.name, pcb.id);
      openTab(tab);
    }
  }, [openTab]);

  // Open file dialog
  const handleOpenFile = useCallback(async () => {
    const input = window.document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = [
      ".vibecad,.vibecad.json",
      ".png,.jpg,.jpeg,.gif,.webp,.svg,.bmp",
      ".txt,.js,.jsx,.ts,.tsx,.json,.xml,.html,.htm,.css,.scss,.less,.py,.rb,.rs,.go,.java,.c,.cpp,.h,.hpp,.cs,.php,.sh,.yaml,.yml,.toml,.ini,.conf,.sql,.graphql,.gql,.svelte,.vue",
      ".pdf",
      ".md,.markdown,.mdown,.mkd",
      ".mp4,.webm,.ogg,.ogv,.mov,.avi,.mkv",
      ".mp3,.wav,.ogg,.oga,.aac,.flac,.m4a",
      ".stl,.obj,.gltf,.glb",
      "*",
    ].join(",");

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      for (const file of Array.from(files)) {
        const docType = getDocumentTypeFromFile(file);

        try {
          switch (docType) {
            case "cad": {
              // Save current document state before switching
              const cadStore = useCadStore.getState();
              const currentActiveDocId = useDocumentViewStore.getState().activeDocumentId;
              if (currentActiveDocId && cadStore.studio) {
                useDocumentViewStore.getState().updateStudio(currentActiveDocId, cadStore.studio);
              }

              const newStudio = VibeCadCore.createPartStudioWithCube(
                file.name.replace(/\.vibecad\.json$/, "").replace(/\.json$/, "").replace(/\.vibecad$/, "")
              );
              const tab = createCadTab(newStudio.name, newStudio.id);

              // Initialize document in view store
              useDocumentViewStore.getState().initDocument(newStudio.id, newStudio);
              useDocumentViewStore.getState().setActiveDocument(newStudio.id);

              setStudio(newStudio);
              openTab(tab);
              break;
            }
            case "image": {
              const tab = await createImageTabFromFile(file);
              openTab(tab);
              break;
            }
            case "text": {
              const tab = await createTextTabFromFile(file);
              openTab(tab);
              break;
            }
            case "pdf": {
              const tab = await createPdfTabFromFile(file);
              openTab(tab);
              break;
            }
            case "markdown": {
              const tab = await createMarkdownTabFromFile(file);
              openTab(tab);
              break;
            }
            case "video": {
              const tab = await createVideoTabFromFile(file);
              openTab(tab);
              break;
            }
            case "audio": {
              const tab = await createAudioTabFromFile(file);
              openTab(tab);
              break;
            }
            case "model3d": {
              const tab = await createModel3dTabFromFile(file);
              openTab(tab);
              break;
            }
            case "raw":
            default: {
              const tab = await createRawTabFromFile(file);
              openTab(tab);
              break;
            }
          }
        } catch (err) {
          console.error("Failed to open file:", file.name, err);
        }
      }
    };

    input.click();
  }, [setStudio, openTab, studio]);

  // Save project
  const handleSaveProject = useCallback(async () => {
    const thumbnail = captureThumbnail(200, 150, 0.7);
    await fileStore.savePartStudio(studio, { thumbnail: thumbnail ?? undefined });
  }, [studio, fileStore]);

  // Download project
  const handleDownloadProject = useCallback(() => {
    const content = JSON.stringify(serializeDocument(studio), null, 2);
    const filename = studio.name.replace(/\s+/g, "_") + ".vibecad";
    downloadFile(content, filename);
  }, [studio]);

  // Auto-create a tab for the initial studio if none exist
  useEffect(() => {
    if (tabs.length === 0 && studio) {
      const tab = createCadTab(studio.name, studio.id);
      // Initialize document in view store
      docViewStore.initDocument(studio.id, studio);
      docViewStore.setActiveDocument(studio.id);
      openTab(tab);
    }
  }, [tabs.length, studio, openTab, docViewStore]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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

      if (e.key === "Delete" || e.key === "Backspace") {
        const { objectSelection } = useCadStore.getState();
        if (objectSelection.size > 0) {
          e.preventDefault();
          console.log("Delete selection (not implemented)");
        }
      }

      if (e.key === "Escape" && !settingsOpen && !libraryOpen && !aboutOpen) {
        const store = useCadStore.getState();
        store.clearObjectSelection();
        store.clearOpSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveProject, settingsOpen, libraryOpen, aboutOpen]);

  // Determine content and sidebar tabs based on active tab type
  const isCadDocument = activeTab?.type === "cad";
  const isSchematicDocument = activeTab?.type === "schematic";
  const isPcbDocument = activeTab?.type === "pcb";
  const isDrawingDocument = activeTab?.type === "drawing";

  // ViewCube positioning
  const viewCubeTopOffset = TOOLBAR_HEIGHT + VIEWCUBE_GAP;
  const viewCubeRightOffset = rightCollapsed
    ? VIEWCUBE_GAP
    : PANEL_MARGIN + RIGHT_PANEL_WIDTH + VIEWCUBE_GAP;

  // Build left sidebar extra tabs based on document type (flat structure)
  const leftExtraTabs = useMemo<TabDefinition[]>(() => {
    if (!activeTab) return [];

    switch (activeTab.type) {
      case "cad":
        return [
          { id: "operations", label: "Ops", content: <OpTimelineContent /> },
        ];
      case "schematic":
        return [
          { id: "sch-components", label: "Components", content: <SchematicComponentsContent /> },
          { id: "sch-nets", label: "Nets", content: <SchematicNetsContent /> },
          { id: "sch-sheets", label: "Sheets", content: <SchematicSheetsContent /> },
        ];
      case "pcb":
        return [
          { id: "pcb-components", label: "Components", content: <PcbComponentsContent /> },
          { id: "pcb-layers", label: "Layers", content: <PcbLayersContent /> },
          { id: "pcb-nets", label: "Nets", content: <PcbNetsContent /> },
        ];
      case "drawing":
        return [
          { id: "drawing-views", label: "Views", content: <DrawingViewsContent /> },
          { id: "drawing-dims", label: "Dims", content: <DrawingDimensionsContent /> },
          { id: "drawing-sheet", label: "Sheet", content: <DrawingSheetContent /> },
        ];
      default:
        return [];
    }
  }, [activeTab]);

  // Build right sidebar tabs based on document type (flat structure)
  const rightTabs = useMemo<TabDefinition[]>(() => {
    if (!activeTab) return [];

    switch (activeTab.type) {
      case "cad":
        return [
          { id: "properties", label: "Properties", content: <PropertiesContent /> },
          { id: "parameters", label: "Params", content: <ParametersContent /> },
          { id: "render", label: "Render", content: <RenderContent /> },
        ];
      case "schematic":
        return [
          { id: "sch-props", label: "Properties", content: <SchematicPropertiesContent /> },
          { id: "sch-library", label: "Library", content: <SchematicLibraryContent /> },
          { id: "sch-info", label: "Info", content: <SchematicInfoContent /> },
        ];
      case "pcb":
        return [
          { id: "pcb-props", label: "Properties", content: <PcbPropertiesContent /> },
          { id: "pcb-drc", label: "DRC", content: <PcbDrcContent /> },
          { id: "pcb-info", label: "Info", content: <PcbBoardInfoContent /> },
        ];
      case "drawing":
        return [
          { id: "drawing-props", label: "Properties", content: <DrawingPropertiesContent /> },
        ];
      case "image":
        return [
          { id: "draw", label: "Draw", content: <ImageEditorSidebar /> },
        ];
      default:
        return [];
    }
  }, [activeTab]);

  // Render content based on active tab
  const renderContent = () => {
    if (!activeTab) {
      return <EmptyState onNewCadDocument={handleNewCadDocument} onOpenFile={handleOpenFile} />;
    }

    switch (activeTab.type) {
      case "cad":
        return (
          <>
            <Viewport
              viewCubeTopOffset={viewCubeTopOffset}
              viewCubeRightOffset={viewCubeRightOffset}
            />
            <SketchCanvas />
          </>
        );
      case "drawing":
        // Just render the canvas - sidebars/toolbar handled by AppLayout
        return <DrawingCanvas />;
      case "schematic":
        // Just render the canvas - sidebars/toolbar handled by AppLayout
        return <SchematicCanvas />;
      case "pcb":
        // Just render the canvas - sidebars/toolbar handled by AppLayout
        return <PcbCanvas />;
      case "image":
        return <ImageViewer document={activeTab as ImageDocument} />;
      case "text":
        return <TextViewer document={activeTab as TextDocument} />;
      case "pdf":
        return <PdfViewer document={activeTab as PdfDocument} />;
      case "markdown":
        return <MarkdownViewer document={activeTab as MarkdownDocument} />;
      case "video":
        return <VideoViewer document={activeTab as VideoDocument} />;
      case "audio":
        return <AudioViewer document={activeTab as AudioDocument} />;
      case "model3d":
        return <Model3dViewer document={activeTab as Model3dDocument} />;
      case "raw":
        return <RawFileViewer document={activeTab as RawDocument} />;
      default:
        return <EmptyState onNewCadDocument={handleNewCadDocument} onOpenFile={handleOpenFile} />;
    }
  };

  // Render toolbar based on document type
  const renderToolbar = () => {
    if (!activeTab) {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#aaa" }}>vibeCAD</span>
        </div>
      );
    }

    switch (activeTab.type) {
      case "cad":
        return (
          <Toolbar
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenLibrary={() => setLibraryOpen(true)}
            onSaveProject={handleSaveProject}
            onDownloadProject={handleDownloadProject}
            onNewProject={handleNewCadDocument}
            onNewDrawing={handleNewDrawing}
            onNewSchematic={handleNewSchematic}
            onNewPcb={handleNewPcb}
            onOpenAbout={() => setAboutOpen(true)}
          />
        );
      case "schematic":
        return (
          <SchematicToolbar
            onOpenLibrary={() => setLibraryOpen(true)}
            onRunErc={() => {
              // TODO: Implement ERC
              alert("ERC not yet implemented");
            }}
            onExportNetlist={() => {
              // TODO: Implement netlist export
              alert("Netlist export not yet implemented");
            }}
          />
        );
      case "pcb":
        return (
          <PcbToolbar
            onOpenLibrary={() => setLibraryOpen(true)}
            onRunDrc={() => usePcbStore.getState().runDrc()}
            onExportGerber={() => {
              // TODO: Implement Gerber export
              alert("Gerber export not yet implemented");
            }}
            onExport3d={() => {
              // TODO: Implement 3D export
              alert("3D export not yet implemented");
            }}
          />
        );
      case "drawing":
        return (
          <DrawingToolbar
            onAddView={() => {
              // TODO: Open add view modal
              alert("Add view modal not yet integrated");
            }}
            onRecompute={() => useDrawingStore.getState().recomputeViews()}
          />
        );
      default:
        // Minimal toolbar for other document types (just app-level actions)
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#aaa" }}>vibeCAD</span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setSettingsOpen(true)}
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                border: "1px solid #333",
                backgroundColor: "transparent",
                color: "#888",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Settings
            </button>
          </div>
        );
    }
  };

  // Render status bar
  const renderStatusBar = () => {
    if (!activeTab) return null;

    switch (activeTab.type) {
      case "cad":
        return <CadStatusBar />;
      case "schematic":
        return <SchematicStatusBar />;
      case "pcb":
        return <PcbStatusBar />;
      case "drawing":
        return <DrawingStatusBar />;
      default:
        // Generic status for other document types
        return <span>{activeTab.name}</span>;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.main}>
        <AppLayout
          toolbar={renderToolbar()}
          statusBar={renderStatusBar()}
          leftExtraTabs={leftExtraTabs}
          rightTabs={rightTabs}
        >
          <div style={styles.viewerContainer}>{renderContent()}</div>
        </AppLayout>
      </div>

      {/* Tab bar at bottom */}
      <TabBar
        onNewPartStudio={handleNewCadDocument}
        onNewDrawing={handleNewDrawing}
        onNewSchematic={handleNewSchematic}
        onNewPcb={handleNewPcb}
        onUploadFile={handleOpenFile}
        onOpenLibrary={() => setLibraryOpen(true)}
      />

      {/* Modals */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <MyLibrary isOpen={libraryOpen} onClose={() => setLibraryOpen(false)} />
      <AboutModal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
};

export default App;
