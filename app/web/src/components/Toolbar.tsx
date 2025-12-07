/**
 * Toolbar - top bar with tools and actions.
 */

import React from "react";
import { useCadStore, selectIsRebuilding, selectExportMeshes, selectExportShapeHandles } from "../store";
import { exportSTL } from "../utils/stl-export";
import { exportOBJ } from "../utils/obj-export";
import { exportGLTF } from "../utils/gltf-export";
import { exportSTEP } from "../utils/step-export";
import { getOcc } from "@vibecad/kernel";

// Tool categories
type ToolCategory = "select" | "sketch" | "sketch-draw" | "primitive" | "operation" | "modify";

// Which mode the tool is available in
type ToolMode = "object" | "sketch" | "both";

interface Tool {
  id: string;
  label: string;
  icon: string;
  category: ToolCategory;
  shortcut?: string;
  mode: ToolMode;
}

const TOOLS: Tool[] = [
  // Selection (available in both modes)
  { id: "select", label: "Select", icon: "⎋", category: "select", shortcut: "V", mode: "both" },

  // Object mode: create new sketch
  { id: "sketch", label: "New Sketch", icon: "✎", category: "sketch", shortcut: "S", mode: "object" },

  // Sketch mode: drawing tools
  { id: "line", label: "Line", icon: "⁄", category: "sketch-draw", shortcut: "L", mode: "sketch" },
  { id: "rect", label: "Rectangle", icon: "▭", category: "sketch-draw", shortcut: "R", mode: "sketch" },
  { id: "circle", label: "Circle", icon: "◯", category: "sketch-draw", shortcut: "C", mode: "sketch" },
  { id: "arc", label: "Arc", icon: "⌒", category: "sketch-draw", mode: "sketch" },

  // 3D Primitives (object mode)
  { id: "box", label: "Box", icon: "⬡", category: "primitive", mode: "object" },
  { id: "cylinder", label: "Cylinder", icon: "⏣", category: "primitive", mode: "object" },
  { id: "sphere", label: "Sphere", icon: "◉", category: "primitive", mode: "object" },

  // Operations (object mode)
  { id: "extrude", label: "Extrude", icon: "⏶", category: "operation", shortcut: "E", mode: "object" },
  { id: "revolve", label: "Revolve", icon: "⟳", category: "operation", mode: "object" },
  { id: "sweep", label: "Sweep", icon: "↝", category: "operation", mode: "object" },
  { id: "loft", label: "Loft", icon: "⋈", category: "operation", mode: "object" },

  // Modify (object mode)
  { id: "fillet", label: "Fillet", icon: "⌓", category: "modify", shortcut: "F", mode: "object" },
  { id: "chamfer", label: "Chamfer", icon: "⌔", category: "modify", mode: "object" },
  { id: "shell", label: "Shell", icon: "▢", category: "modify", mode: "object" },
  { id: "union", label: "Union", icon: "⊕", category: "modify", mode: "object" },
  { id: "subtract", label: "Subtract", icon: "⊖", category: "modify", mode: "object" },
  { id: "intersect", label: "Intersect", icon: "⊗", category: "modify", mode: "object" },
];

const styles = {
  toolbarContainer: {
    display: "flex",
    alignItems: "center",
    height: "100%",
    width: "100%",
  } as React.CSSProperties,

  toolbarScrollable: {
    display: "flex",
    alignItems: "center",
    height: "100%",
    gap: 8,
    padding: "0 12px",
    overflowX: "auto",
    overflowY: "hidden",
    flexWrap: "nowrap",
    scrollbarWidth: "thin",
    scrollbarColor: "#444 transparent",
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  toolbarFixed: {
    display: "flex",
    alignItems: "center",
    height: "100%",
    padding: "0 12px",
    borderLeft: "1px solid #333",
    flexShrink: 0,
  } as React.CSSProperties,

  logo: {
    fontWeight: 700,
    fontSize: 16,
    color: "#646cff",
    marginRight: 16,
    userSelect: "none",
    flexShrink: 0,
  } as React.CSSProperties,

  divider: {
    width: 1,
    height: 24,
    backgroundColor: "#333",
    margin: "0 8px",
    flexShrink: 0,
  } as React.CSSProperties,

  toolGroup: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  } as React.CSSProperties,

  toolButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 8px",
    border: "none",
    borderRadius: 4,
    backgroundColor: "transparent",
    color: "#aaa",
    cursor: "pointer",
    minWidth: 40,
    fontSize: 16,
    transition: "background-color 0.15s, color 0.15s",
    flexShrink: 0,
  } as React.CSSProperties,

  toolButtonActive: {
    backgroundColor: "#646cff",
    color: "#fff",
  } as React.CSSProperties,

  toolButtonHover: {
    backgroundColor: "#333",
    color: "#fff",
  } as React.CSSProperties,

  toolLabel: {
    fontSize: 9,
    marginTop: 2,
    opacity: 0.7,
  } as React.CSSProperties,

  iconButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    border: "none",
    borderRadius: 4,
    backgroundColor: "transparent",
    color: "#aaa",
    cursor: "pointer",
    fontSize: 14,
    flexShrink: 0,
  } as React.CSSProperties,

  iconButtonDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  } as React.CSSProperties,

  spacer: {
    flex: 1,
    minWidth: 8,
  } as React.CSSProperties,

  statusText: {
    fontSize: 12,
    color: "#888",
    flexShrink: 0,
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  profileButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    border: "none",
    borderRadius: "50%",
    backgroundColor: "#333",
    color: "#aaa",
    cursor: "pointer",
    fontSize: 18,
    transition: "background-color 0.15s, color 0.15s",
  } as React.CSSProperties,

  profileButtonHover: {
    backgroundColor: "#646cff",
    color: "#fff",
  } as React.CSSProperties,

  menuContainer: {
    position: "relative",
    display: "inline-block",
  } as React.CSSProperties,

  menu: {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: 8,
    backgroundColor: "#252530",
    border: "1px solid #333",
    borderRadius: 6,
    minWidth: 200,
    zIndex: 1000,
    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    overflow: "hidden",
  } as React.CSSProperties,

  menuItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "10px 14px",
    border: "none",
    backgroundColor: "transparent",
    color: "#ccc",
    cursor: "pointer",
    fontSize: 13,
    textAlign: "left",
    transition: "background-color 0.15s",
    position: "relative",
  } as React.CSSProperties,

  menuItemHover: {
    backgroundColor: "#333",
    color: "#fff",
  } as React.CSSProperties,

  menuItemDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  } as React.CSSProperties,

  menuItemIcon: {
    width: 18,
    textAlign: "center",
    fontSize: 14,
    opacity: 0.8,
  } as React.CSSProperties,

  menuDivider: {
    height: 1,
    backgroundColor: "#333",
    margin: "4px 0",
  } as React.CSSProperties,

  submenuArrow: {
    marginLeft: "auto",
    fontSize: 10,
    opacity: 0.6,
  } as React.CSSProperties,

  submenu: {
    position: "absolute",
    left: "100%",
    top: -1,
    marginLeft: -4,
    paddingLeft: 8,
    backgroundColor: "transparent",
  } as React.CSSProperties,

  submenuInner: {
    backgroundColor: "#252530",
    border: "1px solid #333",
    borderRadius: 6,
    minWidth: 160,
    zIndex: 1001,
    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    overflow: "hidden",
  } as React.CSSProperties,
};

interface ToolButtonProps {
  tool: Tool;
  isActive: boolean;
  onClick: () => void;
}

function ToolButton({ tool, isActive, onClick }: ToolButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      style={{
        ...styles.toolButton,
        ...(isActive ? styles.toolButtonActive : {}),
        ...(isHovered && !isActive ? styles.toolButtonHover : {}),
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ""}`}
    >
      <span>{tool.icon}</span>
      <span style={styles.toolLabel}>{tool.label}</span>
    </button>
  );
}

// Profile Menu Component
interface ProfileMenuProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onDownload: () => void;
  onImport: (format: string) => void;
  onExport: (format: string) => void;
  onSettings: () => void;
  onAbout: () => void;
  hasGeometry: boolean;
  hasShapeHandles: boolean;
}

function ProfileMenu({
  onNew,
  onOpen,
  onSave,
  onDownload,
  onImport,
  onExport,
  onSettings,
  onAbout,
  hasGeometry,
  hasShapeHandles,
}: ProfileMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);
  const [showImportSubmenu, setShowImportSubmenu] = React.useState(false);
  const [showExportSubmenu, setShowExportSubmenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowImportSubmenu(false);
        setShowExportSubmenu(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleMenuItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
    setShowImportSubmenu(false);
    setShowExportSubmenu(false);
  };

  const importFormats = [
    { id: "stl", label: "STL", icon: "▲" },
    { id: "step", label: "STEP", icon: "◆" },
    { id: "obj", label: "OBJ", icon: "◇" },
  ];

  const exportFormats = [
    { id: "stl", label: "STL", extension: ".stl", needsMesh: true },
    { id: "step", label: "STEP", extension: ".step", needsMesh: false },
    { id: "obj", label: "OBJ", extension: ".obj", needsMesh: true },
    { id: "gltf", label: "glTF", extension: ".gltf", needsMesh: true },
  ];

  return (
    <div style={styles.menuContainer} ref={menuRef}>
      <button
        style={{
          ...styles.profileButton,
          ...(isHovered || isOpen ? styles.profileButtonHover : {}),
        }}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title="Menu"
      >
        &#x2630;
      </button>

      {isOpen && (
        <div style={styles.menu}>
          {/* New */}
          <button
            style={{
              ...styles.menuItem,
              ...(hoveredItem === "new" ? styles.menuItemHover : {}),
            }}
            onClick={() => handleMenuItemClick(onNew)}
            onMouseEnter={() => {
              setHoveredItem("new");
              setShowImportSubmenu(false);
              setShowExportSubmenu(false);
            }}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <span style={styles.menuItemIcon}>+</span>
            <span>New</span>
          </button>

          <div style={styles.menuDivider} />

          {/* Open */}
          <button
            style={{
              ...styles.menuItem,
              ...(hoveredItem === "open" ? styles.menuItemHover : {}),
            }}
            onClick={() => handleMenuItemClick(onOpen)}
            onMouseEnter={() => {
              setHoveredItem("open");
              setShowImportSubmenu(false);
              setShowExportSubmenu(false);
            }}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <span style={styles.menuItemIcon}>&#x1F4C1;</span>
            <span>Open</span>
          </button>

          {/* Save */}
          <button
            style={{
              ...styles.menuItem,
              ...(hoveredItem === "save" ? styles.menuItemHover : {}),
            }}
            onClick={() => handleMenuItemClick(onSave)}
            onMouseEnter={() => {
              setHoveredItem("save");
              setShowImportSubmenu(false);
              setShowExportSubmenu(false);
            }}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <span style={styles.menuItemIcon}>&#x1F4BE;</span>
            <span>Save</span>
          </button>

          {/* Download */}
          <button
            style={{
              ...styles.menuItem,
              ...(hoveredItem === "download" ? styles.menuItemHover : {}),
            }}
            onClick={() => handleMenuItemClick(onDownload)}
            onMouseEnter={() => {
              setHoveredItem("download");
              setShowImportSubmenu(false);
              setShowExportSubmenu(false);
            }}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <span style={styles.menuItemIcon}>&#x2B73;</span>
            <span>Download Project</span>
          </button>

          <div style={styles.menuDivider} />

          {/* Import with submenu */}
          <div
            style={{ position: "relative" }}
            onMouseEnter={() => {
              setHoveredItem("import");
              setShowImportSubmenu(true);
              setShowExportSubmenu(false);
            }}
            onMouseLeave={() => {
              setHoveredItem(null);
            }}
          >
            <button
              style={{
                ...styles.menuItem,
                ...(hoveredItem === "import" ? styles.menuItemHover : {}),
              }}
            >
              <span style={styles.menuItemIcon}>&#x2B06;</span>
              <span>Import</span>
              <span style={styles.submenuArrow}>▶</span>
            </button>
            {showImportSubmenu && (
              <div style={styles.submenu}>
                <div style={styles.submenuInner}>
                  {importFormats.map((format) => (
                    <button
                      key={format.id}
                      style={{
                        ...styles.menuItem,
                        ...(hoveredItem === `import-${format.id}` ? styles.menuItemHover : {}),
                      }}
                      onClick={() => handleMenuItemClick(() => onImport(format.id))}
                      onMouseEnter={() => setHoveredItem(`import-${format.id}`)}
                      onMouseLeave={() => setHoveredItem("import")}
                    >
                      <span style={styles.menuItemIcon}>{format.icon}</span>
                      <span>{format.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Export with submenu */}
          <div
            style={{ position: "relative" }}
            onMouseEnter={() => {
              setHoveredItem("export");
              setShowExportSubmenu(true);
              setShowImportSubmenu(false);
            }}
            onMouseLeave={() => {
              setHoveredItem(null);
            }}
          >
            <button
              style={{
                ...styles.menuItem,
                ...(hoveredItem === "export" ? styles.menuItemHover : {}),
              }}
            >
              <span style={styles.menuItemIcon}>&#x2B07;</span>
              <span>Export</span>
              <span style={styles.submenuArrow}>▶</span>
            </button>
            {showExportSubmenu && (
              <div style={styles.submenu}>
                <div style={styles.submenuInner}>
                  {exportFormats.map((format) => {
                    const hasData = format.needsMesh ? hasGeometry : hasShapeHandles;
                    const isDisabled = !hasData;
                    return (
                      <button
                        key={format.id}
                        style={{
                          ...styles.menuItem,
                          ...(hoveredItem === `export-${format.id}` && !isDisabled
                            ? styles.menuItemHover
                            : {}),
                          ...(isDisabled ? styles.menuItemDisabled : {}),
                        }}
                        onClick={() => {
                          if (!isDisabled) {
                            handleMenuItemClick(() => onExport(format.id));
                          }
                        }}
                        onMouseEnter={() => setHoveredItem(`export-${format.id}`)}
                        onMouseLeave={() => setHoveredItem("export")}
                        disabled={isDisabled}
                        title={isDisabled ? "No geometry to export" : `Export as ${format.label}`}
                      >
                        <span style={{ fontWeight: 500 }}>{format.label}</span>
                        <span style={{ color: "#666", fontSize: 11 }}>{format.extension}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={styles.menuDivider} />

          {/* Settings */}
          <button
            style={{
              ...styles.menuItem,
              ...(hoveredItem === "settings" ? styles.menuItemHover : {}),
            }}
            onClick={() => handleMenuItemClick(onSettings)}
            onMouseEnter={() => {
              setHoveredItem("settings");
              setShowImportSubmenu(false);
              setShowExportSubmenu(false);
            }}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <span style={styles.menuItemIcon}>&#x2699;</span>
            <span>Settings</span>
          </button>

          {/* About */}
          <button
            style={{
              ...styles.menuItem,
              ...(hoveredItem === "about" ? styles.menuItemHover : {}),
            }}
            onClick={() => handleMenuItemClick(onAbout)}
            onMouseEnter={() => {
              setHoveredItem("about");
              setShowImportSubmenu(false);
              setShowExportSubmenu(false);
            }}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <span style={styles.menuItemIcon}>&#x2139;</span>
            <span>About</span>
          </button>
        </div>
      )}
    </div>
  );
}

interface ToolbarProps {
  onOpenSettings?: () => void;
  onOpenLibrary?: () => void;
  onSaveProject?: () => void;
  onDownloadProject?: () => void;
  onNewProject?: () => void;
  onImport?: (format: string) => void;
  onOpenAbout?: () => void;
}

export function Toolbar({
  onOpenSettings,
  onOpenLibrary,
  onSaveProject,
  onDownloadProject,
  onNewProject,
  onImport,
  onOpenAbout,
}: ToolbarProps) {
  // Use store for active tool instead of local state
  const activeTool = useCadStore((s) => s.activeTool);
  const setActiveTool = useCadStore((s) => s.setActiveTool);
  const editorMode = useCadStore((s) => s.editorMode);
  const enterPlaneSelectionMode = useCadStore((s) => s.enterPlaneSelectionMode);
  const cancelPlaneSelection = useCadStore((s) => s.cancelPlaneSelection);
  const exitSketchMode = useCadStore((s) => s.exitSketchMode);
  const exportMeshes = useCadStore(selectExportMeshes);
  const exportShapeHandles = useCadStore(selectExportShapeHandles);
  const documentName = useCadStore((s) => s.document.name);

  const canUndo = useCadStore((s) => s.canUndo());
  const canRedo = useCadStore((s) => s.canRedo());
  const undo = useCadStore((s) => s.undo);
  const redo = useCadStore((s) => s.redo);
  const isRebuilding = useCadStore(selectIsRebuilding);
  const gridSnappingEnabled = useCadStore((s) => s.gridSnappingEnabled);
  const toggleGridSnapping = useCadStore((s) => s.toggleGridSnapping);
  const startExtrude = useCadStore((s) => s.startExtrude);
  const cancelExtrude = useCadStore((s) => s.cancelExtrude);
  const pendingExtrude = useCadStore((s) => s.pendingExtrude);
  const faceSelectionTarget = useCadStore((s) => s.faceSelectionTarget);
  const exitFaceSelectionMode = useCadStore((s) => s.exitFaceSelectionMode);

  // New operation workflows
  const startRevolve = useCadStore((s) => s.startRevolve);
  const cancelRevolve = useCadStore((s) => s.cancelRevolve);
  const pendingRevolve = useCadStore((s) => s.pendingRevolve);
  const startFillet = useCadStore((s) => s.startFillet);
  const cancelFillet = useCadStore((s) => s.cancelFillet);
  const pendingFillet = useCadStore((s) => s.pendingFillet);
  const startBoolean = useCadStore((s) => s.startBoolean);
  const cancelBoolean = useCadStore((s) => s.cancelBoolean);
  const pendingBoolean = useCadStore((s) => s.pendingBoolean);

  // Handle tool click - some tools trigger immediate actions
  const handleToolClick = React.useCallback((toolId: string) => {
    console.log("[Toolbar] handleToolClick:", toolId);
    switch (toolId) {
      case "sketch":
        // Enter plane selection mode - user clicks on a plane to create sketch
        enterPlaneSelectionMode();
        break;
      case "extrude":
        // Start the extrude workflow
        startExtrude();
        break;
      case "revolve":
        startRevolve();
        break;
      case "fillet":
        startFillet();
        break;
      case "union":
        startBoolean("union");
        break;
      case "subtract":
        startBoolean("subtract");
        break;
      case "intersect":
        startBoolean("intersect");
        break;
      default:
        setActiveTool(toolId);
        break;
    }
  }, [enterPlaneSelectionMode, startExtrude, startRevolve, startFillet, startBoolean, setActiveTool]);

  // Handle export for all formats
  const handleExport = React.useCallback((formatId: string) => {
    const filename = documentName.replace(/\s+/g, "_") || "model";

    switch (formatId) {
      case "stl":
        if (exportMeshes.length === 0) {
          console.warn("[Toolbar] No meshes available for STL export");
          return;
        }
        exportSTL(exportMeshes, filename, true);
        console.log("[Toolbar] Exported STL:", filename);
        break;

      case "obj":
        if (exportMeshes.length === 0) {
          console.warn("[Toolbar] No meshes available for OBJ export");
          return;
        }
        exportOBJ(exportMeshes, filename);
        console.log("[Toolbar] Exported OBJ:", filename);
        break;

      case "gltf":
        if (exportMeshes.length === 0) {
          console.warn("[Toolbar] No meshes available for glTF export");
          return;
        }
        exportGLTF(exportMeshes, filename);
        console.log("[Toolbar] Exported glTF:", filename);
        break;

      case "step":
        if (exportShapeHandles.length === 0) {
          console.warn("[Toolbar] No shapes available for STEP export");
          return;
        }
        const occApi = getOcc();
        if (!occApi) {
          console.error("[Toolbar] OCC API not available for STEP export");
          return;
        }
        exportSTEP(occApi, exportShapeHandles, filename);
        console.log("[Toolbar] Exported STEP:", filename);
        break;

      default:
        console.warn("[Toolbar] Unknown export format:", formatId);
    }
  }, [exportMeshes, exportShapeHandles, documentName]);

  // Handle import (stub)
  const handleImport = React.useCallback((formatId: string) => {
    if (onImport) {
      onImport(formatId);
    } else {
      console.log("[Toolbar] Import not implemented:", formatId);
      alert(`Import ${formatId.toUpperCase()} coming soon!`);
    }
  }, [onImport]);

  // Filter tools based on current mode
  const visibleTools = React.useMemo(() => {
    return TOOLS.filter(tool => {
      if (tool.mode === "both") return true;
      return tool.mode === editorMode;
    });
  }, [editorMode]);

  const toolsByCategory = React.useMemo(() => {
    const groups: Record<ToolCategory, Tool[]> = {
      select: [],
      sketch: [],
      "sketch-draw": [],
      primitive: [],
      operation: [],
      modify: [],
    };
    for (const tool of visibleTools) {
      groups[tool.category].push(tool);
    }
    return groups;
  }, [visibleTools]);

  return (
    <div style={styles.toolbarContainer}>
      {/* Scrollable toolbar content */}
      <div style={styles.toolbarScrollable}>
        {/* Logo */}
        <div style={styles.logo}>vibeCAD</div>

        {/* Undo/Redo */}
        <button
          style={{
            ...styles.iconButton,
            ...(canUndo ? {} : styles.iconButtonDisabled),
          }}
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          ↩
        </button>
        <button
          style={{
            ...styles.iconButton,
            ...(canRedo ? {} : styles.iconButtonDisabled),
          }}
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          ↪
        </button>

        <div style={styles.divider} />

        {/* Mode indicator */}
        {editorMode === "select-plane" && (
          <div style={{
            backgroundColor: "#ffa94d",
            color: "#000",
            padding: "4px 12px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
          }}>
            SELECT PLANE
          </div>
        )}
        {editorMode === "select-face" && (
          <div style={{
            backgroundColor: "#da77f2",
            color: "#000",
            padding: "4px 12px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
          }}>
            {faceSelectionTarget?.type === "extrude-profile" ? "SELECT SKETCH" : "SELECT FACE"}
          </div>
        )}
        {editorMode === "sketch" && (
          <div style={{
            backgroundColor: "#4dabf7",
            color: "#000",
            padding: "4px 12px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
          }}>
            SKETCH MODE
          </div>
        )}

        {/* Selection Tools */}
        {toolsByCategory.select.length > 0 && (
          <div style={styles.toolGroup}>
            {toolsByCategory.select.map((tool) => (
              <ToolButton
                key={tool.id}
                tool={tool}
                isActive={activeTool === tool.id}
                onClick={() => handleToolClick(tool.id)}
              />
            ))}
          </div>
        )}

        {/* Object Mode: Sketch creation */}
        {toolsByCategory.sketch.length > 0 && (
          <>
            <div style={styles.divider} />
            <div style={styles.toolGroup}>
              {toolsByCategory.sketch.map((tool) => (
                <ToolButton
                  key={tool.id}
                  tool={tool}
                  isActive={activeTool === tool.id}
                  onClick={() => handleToolClick(tool.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Sketch Mode: Drawing tools */}
        {toolsByCategory["sketch-draw"].length > 0 && (
          <>
            <div style={styles.divider} />
            <div style={styles.toolGroup}>
              {toolsByCategory["sketch-draw"].map((tool) => (
                <ToolButton
                  key={tool.id}
                  tool={tool}
                  isActive={activeTool === tool.id}
                  onClick={() => handleToolClick(tool.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Object Mode: Operation Tools */}
        {toolsByCategory.operation.length > 0 && (
          <>
            <div style={styles.divider} />
            <div style={styles.toolGroup}>
              {toolsByCategory.operation.map((tool) => (
                <ToolButton
                  key={tool.id}
                  tool={tool}
                  isActive={activeTool === tool.id}
                  onClick={() => handleToolClick(tool.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Object Mode: Modify Tools */}
        {toolsByCategory.modify.length > 0 && (
          <>
            <div style={styles.divider} />
            <div style={styles.toolGroup}>
              {toolsByCategory.modify.map((tool) => (
                <ToolButton
                  key={tool.id}
                  tool={tool}
                  isActive={activeTool === tool.id}
                  onClick={() => handleToolClick(tool.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Cancel Plane Selection button */}
        {editorMode === "select-plane" && (
          <>
            <div style={styles.divider} />
            <button
              style={{
                ...styles.iconButton,
                backgroundColor: "#ff6b6b",
                color: "#fff",
                padding: "4px 12px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                width: "auto",
              }}
              onClick={cancelPlaneSelection}
              title="Cancel (ESC)"
            >
              Cancel
            </button>
          </>
        )}

        {/* Face Selection Mode controls */}
        {editorMode === "select-face" && (
          <>
            <div style={styles.divider} />
            <button
              style={{
                ...styles.iconButton,
                backgroundColor: "#ff6b6b",
                color: "#fff",
                padding: "4px 12px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                width: "auto",
              }}
              onClick={() => {
                if (pendingExtrude) {
                  cancelExtrude();
                } else if (pendingRevolve) {
                  cancelRevolve();
                } else if (pendingFillet) {
                  cancelFillet();
                } else if (pendingBoolean) {
                  cancelBoolean();
                } else {
                  exitFaceSelectionMode();
                }
              }}
              title="Cancel (ESC)"
            >
              Cancel
            </button>
          </>
        )}

        {/* Sketch Mode controls */}
        {editorMode === "sketch" && (
          <>
            <div style={styles.divider} />
            {/* Grid Snap Toggle */}
            <button
              style={{
                ...styles.iconButton,
                backgroundColor: gridSnappingEnabled ? "#4dabf7" : "#333",
                color: gridSnappingEnabled ? "#000" : "#888",
                padding: "4px 12px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 500,
                width: "auto",
              }}
              onClick={toggleGridSnapping}
              title={`Grid Snapping: ${gridSnappingEnabled ? "ON" : "OFF"}`}
            >
              ⊞ Snap
            </button>
            <button
              style={{
                ...styles.iconButton,
                backgroundColor: "#ff6b6b",
                color: "#fff",
                padding: "4px 12px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                width: "auto",
              }}
              onClick={exitSketchMode}
              title="Exit Sketch Mode (ESC)"
            >
              Exit Sketch
            </button>
          </>
        )}

        {/* Spacer */}
        <div style={styles.spacer} />

        {/* Status */}
        {isRebuilding && (
          <span style={styles.statusText}>⟳ Rebuilding...</span>
        )}
      </div>

      {/* Fixed right section with profile menu */}
      <div style={styles.toolbarFixed}>
        <ProfileMenu
          onNew={onNewProject || (() => {
            console.log("[Toolbar] New project not implemented");
            alert("New project coming soon!");
          })}
          onOpen={onOpenLibrary || (() => {
            console.log("[Toolbar] Open library not implemented");
          })}
          onSave={onSaveProject || (() => {
            console.log("[Toolbar] Save project not implemented");
          })}
          onDownload={onDownloadProject || (() => {
            console.log("[Toolbar] Download project not implemented");
          })}
          onImport={handleImport}
          onExport={handleExport}
          onSettings={onOpenSettings || (() => {
            console.log("[Toolbar] Settings not implemented");
          })}
          onAbout={onOpenAbout || (() => {
            console.log("[Toolbar] About not implemented");
          })}
          hasGeometry={exportMeshes.length > 0}
          hasShapeHandles={exportShapeHandles.length > 0}
        />
      </div>
    </div>
  );
}

export default Toolbar;
