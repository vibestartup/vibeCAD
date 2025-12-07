import React, { useCallback, useEffect } from "react";
import { Editor } from "./pages/Editor";
import { TabBar } from "./components/TabBar";
import { DocumentContainer } from "./components/DocumentContainer";
import {
  useTabsStore,
  createCadTab,
  createImageTabFromFile,
  createRawTabFromFile,
  getDocumentTypeFromFile,
  type CadDocument,
} from "./store/tabs-store";
import { useCadStore } from "./store/cad-store";
import { createPartStudioWithCube } from "@vibecad/core";

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
};

// ============================================================================
// App Component
// ============================================================================

export const App: React.FC = () => {
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const openTab = useTabsStore((s) => s.openTab);
  const setActiveTab = useTabsStore((s) => s.setActiveTab);
  const getTab = useTabsStore((s) => s.getTab);

  const setStudio = useCadStore((s) => s.setStudio);
  const studio = useCadStore((s) => s.studio);

  // Get active tab
  const activeTab = activeTabId ? getTab(activeTabId) : null;

  // Create new CAD document (now creates a single PartStudio)
  const handleNewCadDocument = useCallback(() => {
    const newStudio = createPartStudioWithCube("Untitled");
    setStudio(newStudio);

    // Create and open tab
    const tab = createCadTab(newStudio.name, newStudio.id);
    openTab(tab);
  }, [setStudio, openTab]);

  // Open file dialog
  const handleOpenFile = useCallback(async () => {
    const input = window.document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".vibecad.json,.json,.png,.jpg,.jpeg,.gif,.webp,.svg,.step,.stp,.iges,.igs,*";

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      for (const file of Array.from(files)) {
        const docType = getDocumentTypeFromFile(file);

        try {
          if (docType === "cad") {
            // Load CAD file as PartStudio
            const text = await file.text();
            const data = JSON.parse(text);
            // TODO: Use deserializePartStudio from file-store for proper loading
            // For now, create a new studio with the file name
            const newStudio = createPartStudioWithCube(file.name.replace(/\.vibecad\.json$/, "").replace(/\.json$/, "").replace(/\.vibecad$/, ""));
            setStudio(newStudio);
            const tab = createCadTab(newStudio.name, newStudio.id);
            openTab(tab);
          } else if (docType === "image") {
            const tab = await createImageTabFromFile(file);
            openTab(tab);
          } else {
            const tab = await createRawTabFromFile(file);
            openTab(tab);
          }
        } catch (err) {
          console.error("Failed to open file:", file.name, err);
        }
      }
    };

    input.click();
  }, [setStudio, openTab]);

  // When active CAD tab changes, sync the CAD store
  useEffect(() => {
    if (activeTab?.type === "cad") {
      // The CAD document is already in the store, just make sure it's active
      // In a more complete implementation, we'd load the document by ID here
    }
  }, [activeTab]);

  // Auto-create a tab for the initial studio if none exist
  useEffect(() => {
    if (tabs.length === 0 && studio) {
      const tab = createCadTab(studio.name, studio.id);
      openTab(tab);
    }
  }, [tabs.length, studio, openTab]);

  // Check if active tab is a CAD document
  const showCadEditor = activeTab?.type === "cad";

  return (
    <div style={styles.container}>
      {/* Main content area */}
      <div style={styles.main}>
        <DocumentContainer
          cadEditor={showCadEditor ? <Editor /> : undefined}
          onNewCadDocument={handleNewCadDocument}
          onOpenFile={handleOpenFile}
        />
      </div>

      {/* Tab bar at bottom */}
      <TabBar
        onNewCadDocument={handleNewCadDocument}
        onOpenFile={handleOpenFile}
      />
    </div>
  );
};

export default App;
