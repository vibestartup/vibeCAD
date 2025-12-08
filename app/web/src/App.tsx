import React, { useCallback, useEffect, useMemo } from "react";
import { TabBar } from "./components/TabBar";
import { AppLayout } from "./layouts/AppLayout";
import {
  useTabsStore,
  createCadTab,
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
} from "./store/tabs-store";
import { useCadStore } from "./store/cad-store";
import { createPartStudioWithCube } from "@vibecad/core";
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

  // Create new CAD document
  const handleNewCadDocument = useCallback(() => {
    const newStudio = createPartStudioWithCube("Untitled");
    setStudio(newStudio);
    const tab = createCadTab(newStudio.name, newStudio.id);
    openTab(tab);
  }, [setStudio, openTab]);

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
              const newStudio = createPartStudioWithCube(
                file.name.replace(/\.vibecad\.json$/, "").replace(/\.json$/, "").replace(/\.vibecad$/, "")
              );
              setStudio(newStudio);
              const tab = createCadTab(newStudio.name, newStudio.id);
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
  }, [setStudio, openTab]);

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
      openTab(tab);
    }
  }, [tabs.length, studio, openTab]);

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

  // ViewCube positioning
  const viewCubeTopOffset = TOOLBAR_HEIGHT + VIEWCUBE_GAP;
  const viewCubeRightOffset = rightCollapsed
    ? VIEWCUBE_GAP
    : PANEL_MARGIN + RIGHT_PANEL_WIDTH + VIEWCUBE_GAP;

  // Build left sidebar extra tabs (Operations for CAD)
  const leftExtraTabs = useMemo<TabDefinition[]>(() => {
    if (isCadDocument) {
      return [
        {
          id: "operations",
          label: "Operations",
          content: <OpTimelineContent />,
        },
      ];
    }
    return [];
  }, [isCadDocument]);

  // Build right sidebar tabs based on document type
  const rightTabs = useMemo<TabDefinition[]>(() => {
    if (!activeTab) return [];

    switch (activeTab.type) {
      case "cad":
        return [
          { id: "properties", label: "Properties", content: <PropertiesContent /> },
          { id: "parameters", label: "Parameters", content: <ParametersContent /> },
          { id: "render", label: "Render", content: <RenderContent /> },
        ];
      case "image":
        return [
          { id: "draw", label: "Draw", content: <ImageEditorSidebar /> },
        ];
      // Other viewers can add their tabs here
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
    // For now, only CAD documents have a toolbar
    // Other viewers can have their tools in the toolbar later
    if (isCadDocument) {
      return (
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
      );
    }
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
  };

  // Render status bar
  const renderStatusBar = () => {
    if (isCadDocument) {
      return <CadStatusBar />;
    }
    // Generic status for other document types
    if (activeTab) {
      return <span>{activeTab.name}</span>;
    }
    return null;
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
      <TabBar onNewCadDocument={handleNewCadDocument} onOpenFile={handleOpenFile} />

      {/* Modals */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <MyLibrary isOpen={libraryOpen} onClose={() => setLibraryOpen(false)} />
      <AboutModal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
};

export default App;
