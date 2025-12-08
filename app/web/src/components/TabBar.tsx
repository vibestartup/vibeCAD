/**
 * TabBar - horizontal tab bar at the bottom of the screen for switching between documents
 */

import React, { useState, useRef } from "react";
import { useTabsStore, type TabDocument, type DocumentType } from "../store/tabs-store";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    height: 36,
    backgroundColor: "#0f0f1a",
    borderTop: "1px solid #333",
    overflow: "visible",
    flexShrink: 0,
  } as React.CSSProperties,

  tabsWrapper: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  } as React.CSSProperties,

  tabsScroller: {
    display: "flex",
    alignItems: "center",
    overflowX: "auto",
    overflowY: "hidden",
    scrollbarWidth: "none" as const,
    msOverflowStyle: "none" as const,
  } as React.CSSProperties,

  tab: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "0 12px",
    height: 36,
    backgroundColor: "transparent",
    border: "none",
    borderRight: "1px solid #252545",
    color: "#888",
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    transition: "background-color 0.15s, color 0.15s",
    minWidth: 0,
    maxWidth: 180,
  } as React.CSSProperties,

  tabActive: {
    backgroundColor: "#1a1a2e",
    color: "#fff",
  } as React.CSSProperties,

  tabHover: {
    backgroundColor: "#1a1a2e",
    color: "#ccc",
  } as React.CSSProperties,

  tabIcon: {
    fontSize: 14,
    flexShrink: 0,
    opacity: 0.7,
  } as React.CSSProperties,

  tabName: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    flex: 1,
  } as React.CSSProperties,

  tabUnsaved: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    backgroundColor: "#ffa94d",
    flexShrink: 0,
  } as React.CSSProperties,

  closeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: "transparent",
    border: "none",
    color: "#666",
    fontSize: 12,
    cursor: "pointer",
    flexShrink: 0,
    transition: "background-color 0.15s, color 0.15s",
  } as React.CSSProperties,

  closeButtonHover: {
    backgroundColor: "#333",
    color: "#ff6b6b",
  } as React.CSSProperties,

  actions: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "0 8px",
    borderLeft: "1px solid #333",
    position: "relative" as const,
    overflow: "visible",
  } as React.CSSProperties,

  actionButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "transparent",
    border: "none",
    color: "#666",
    fontSize: 14,
    cursor: "pointer",
    transition: "background-color 0.15s, color 0.15s",
  } as React.CSSProperties,

  actionButtonHover: {
    backgroundColor: "#252545",
    color: "#fff",
  } as React.CSSProperties,

  emptyState: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#555",
    fontSize: 12,
    padding: "0 16px",
  } as React.CSSProperties,

  // Menu opens upward from bottom bar
  menu: {
    position: "absolute" as const,
    bottom: "100%",
    right: 0,
    marginBottom: 4,
    backgroundColor: "#1a1a2e",
    border: "1px solid #333",
    borderRadius: 6,
    padding: 4,
    minWidth: 180,
    boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.5)",
    zIndex: 1000,
  } as React.CSSProperties,

  menuItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "10px 12px",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: 4,
    color: "#ccc",
    fontSize: 13,
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "background-color 0.15s",
  } as React.CSSProperties,

  menuItemHover: {
    backgroundColor: "#252545",
    color: "#fff",
  } as React.CSSProperties,

  menuItemIcon: {
    width: 18,
    textAlign: "center" as const,
    fontSize: 14,
    opacity: 0.8,
  } as React.CSSProperties,

  menuDivider: {
    height: 1,
    backgroundColor: "#333",
    margin: "4px 0",
  } as React.CSSProperties,

  // Context menu also opens upward
  contextMenu: {
    position: "fixed" as const,
    backgroundColor: "#1a1a2e",
    border: "1px solid #333",
    borderRadius: 6,
    padding: 4,
    minWidth: 150,
    boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.5)",
    zIndex: 1000,
  } as React.CSSProperties,

  contextMenuItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "8px 12px",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: 4,
    color: "#ccc",
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left" as const,
  } as React.CSSProperties,

  contextMenuItemHover: {
    backgroundColor: "#252545",
    color: "#fff",
  } as React.CSSProperties,

  contextMenuItemDanger: {
    color: "#ff6b6b",
  } as React.CSSProperties,

  contextMenuDivider: {
    height: 1,
    backgroundColor: "#333",
    margin: "4px 0",
  } as React.CSSProperties,
};

// Approximate menu height for positioning above click point
const CONTEXT_MENU_HEIGHT = 170;

// ============================================================================
// Icon Helper
// ============================================================================

function getDocumentIcon(type: DocumentType): string {
  switch (type) {
    case "cad":
      return "\u2B22"; // Hexagon
    case "drawing":
      return "\u{1F4D0}"; // Triangular ruler (for technical drawing)
    case "image":
      return "\u{1F5BC}"; // Frame with picture
    case "text":
      return "\u{1F4DD}"; // Memo / text file
    case "pdf":
      return "\u{1F4D1}"; // Bookmark tabs / PDF
    case "markdown":
      return "\u24C2"; // M in circle for markdown
    case "video":
      return "\u{1F3AC}"; // Clapper board
    case "audio":
      return "\u{1F3B5}"; // Musical note
    case "model3d":
      return "\u{1F4E6}"; // Package / 3D box
    case "raw":
      return "\u{1F4C4}"; // Page facing up
    default:
      return "\u{1F4C1}"; // Folder
  }
}

// ============================================================================
// Tab Component
// ============================================================================

interface TabProps {
  tab: TabDocument;
  isActive: boolean;
  isRenaming: boolean;
  onActivate: () => void;
  onClose: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRenameSubmit: (newName: string) => void;
  onRenameCancel: () => void;
}

function Tab({
  tab,
  isActive,
  isRenaming,
  onActivate,
  onClose,
  onContextMenu,
  onRenameSubmit,
  onRenameCancel,
}: TabProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const [editName, setEditName] = useState(tab.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when renaming starts
  React.useEffect(() => {
    if (isRenaming && inputRef.current) {
      setEditName(tab.name);
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming, tab.name]);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  const handleMiddleClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onRenameSubmit(editName);
    } else if (e.key === "Escape") {
      onRenameCancel();
    }
  };

  return (
    <div
      style={{
        ...styles.tab,
        ...(isActive ? styles.tabActive : {}),
        ...(isHovered && !isActive ? styles.tabHover : {}),
      }}
      onClick={isRenaming ? undefined : onActivate}
      onMouseDown={isRenaming ? undefined : handleMiddleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={isRenaming ? undefined : onContextMenu}
      title={isRenaming ? undefined : tab.name}
    >
      <span style={styles.tabIcon}>{getDocumentIcon(tab.type)}</span>
      {isRenaming ? (
        <input
          ref={inputRef}
          style={{
            ...styles.tabName,
            backgroundColor: "#1a1a2e",
            border: "1px solid #646cff",
            borderRadius: 2,
            padding: "1px 4px",
            color: "#fff",
            fontSize: 12,
            outline: "none",
            minWidth: 60,
          }}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => onRenameSubmit(editName)}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span style={styles.tabName}>{tab.name}</span>
      )}
      {tab.unsaved && !isRenaming && <span style={styles.tabUnsaved} title="Unsaved changes" />}
      {!isRenaming && (
        <button
          style={{
            ...styles.closeButton,
            ...(closeHovered ? styles.closeButtonHover : {}),
            visibility: isHovered || isActive ? "visible" : "hidden",
          }}
          onClick={handleClose}
          onMouseEnter={() => setCloseHovered(true)}
          onMouseLeave={() => setCloseHovered(false)}
          title="Close"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Context Menu (opens upward)
// ============================================================================

interface ContextMenuProps {
  x: number;
  y: number;
  tabId: string;
  onClose: () => void;
  onRename: (tabId: string) => void;
}

function ContextMenu({ x, y, tabId, onClose, onRename }: ContextMenuProps) {
  const closeTab = useTabsStore((s) => s.closeTab);
  const closeOtherTabs = useTabsStore((s) => s.closeOtherTabs);
  const closeAllTabs = useTabsStore((s) => s.closeAllTabs);
  const tabs = useTabsStore((s) => s.tabs);

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Close on click outside
  React.useEffect(() => {
    const handleClick = () => onClose();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRename(tabId);
    onClose();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeTab(tabId);
    onClose();
  };

  const handleCloseOthers = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeOtherTabs(tabId);
    onClose();
  };

  const handleCloseAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeAllTabs();
    onClose();
  };

  // Position menu above the click point
  const menuY = y - CONTEXT_MENU_HEIGHT;

  return (
    <div
      style={{ ...styles.contextMenu, left: x, top: Math.max(8, menuY) }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        style={{
          ...styles.contextMenuItem,
          ...(hoveredItem === "rename" ? styles.contextMenuItemHover : {}),
        }}
        onClick={handleRename}
        onMouseEnter={() => setHoveredItem("rename")}
        onMouseLeave={() => setHoveredItem(null)}
      >
        Rename
      </button>
      <div style={styles.contextMenuDivider} />
      <button
        style={{
          ...styles.contextMenuItem,
          ...(hoveredItem === "close" ? styles.contextMenuItemHover : {}),
        }}
        onClick={handleClose}
        onMouseEnter={() => setHoveredItem("close")}
        onMouseLeave={() => setHoveredItem(null)}
      >
        Close
      </button>
      <button
        style={{
          ...styles.contextMenuItem,
          ...(hoveredItem === "closeOthers" ? styles.contextMenuItemHover : {}),
          ...(tabs.length <= 1 ? { opacity: 0.5, cursor: "not-allowed" } : {}),
        }}
        onClick={tabs.length > 1 ? handleCloseOthers : undefined}
        onMouseEnter={() => setHoveredItem("closeOthers")}
        onMouseLeave={() => setHoveredItem(null)}
        disabled={tabs.length <= 1}
      >
        Close Others
      </button>
      <div style={styles.contextMenuDivider} />
      <button
        style={{
          ...styles.contextMenuItem,
          ...styles.contextMenuItemDanger,
          ...(hoveredItem === "closeAll" ? styles.contextMenuItemHover : {}),
        }}
        onClick={handleCloseAll}
        onMouseEnter={() => setHoveredItem("closeAll")}
        onMouseLeave={() => setHoveredItem(null)}
      >
        Close All
      </button>
    </div>
  );
}

// ============================================================================
// Add Menu (opens upward from + button)
// ============================================================================

interface AddMenuProps {
  onClose: () => void;
  onNewPartStudio: () => void;
  onNewDrawing: () => void;
  onUploadFile: () => void;
  onOpenLibrary: () => void;
}

function AddMenu({ onClose, onNewPartStudio, onNewDrawing, onUploadFile, onOpenLibrary }: AddMenuProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Close on click outside
  React.useEffect(() => {
    const handleClick = () => onClose();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div style={styles.menu} onClick={(e) => e.stopPropagation()}>
      <button
        style={{
          ...styles.menuItem,
          ...(hoveredItem === "newPart" ? styles.menuItemHover : {}),
        }}
        onClick={() => {
          onNewPartStudio();
          onClose();
        }}
        onMouseEnter={() => setHoveredItem("newPart")}
        onMouseLeave={() => setHoveredItem(null)}
      >
        <span style={styles.menuItemIcon}>&#x2B22;</span>
        <span>New Part Studio</span>
      </button>
      <button
        style={{
          ...styles.menuItem,
          ...(hoveredItem === "newDrawing" ? styles.menuItemHover : {}),
        }}
        onClick={() => {
          onNewDrawing();
          onClose();
        }}
        onMouseEnter={() => setHoveredItem("newDrawing")}
        onMouseLeave={() => setHoveredItem(null)}
      >
        <span style={styles.menuItemIcon}>&#x1F4D0;</span>
        <span>New Drawing</span>
      </button>
      <button
        style={{
          ...styles.menuItem,
          ...(hoveredItem === "upload" ? styles.menuItemHover : {}),
        }}
        onClick={() => {
          onUploadFile();
          onClose();
        }}
        onMouseEnter={() => setHoveredItem("upload")}
        onMouseLeave={() => setHoveredItem(null)}
      >
        <span style={styles.menuItemIcon}>&#x2B71;</span>
        <span>Upload File</span>
      </button>
      <div style={styles.menuDivider} />
      <button
        style={{
          ...styles.menuItem,
          ...(hoveredItem === "library" ? styles.menuItemHover : {}),
        }}
        onClick={() => {
          onOpenLibrary();
          onClose();
        }}
        onMouseEnter={() => setHoveredItem("library")}
        onMouseLeave={() => setHoveredItem(null)}
      >
        <span style={styles.menuItemIcon}>&#x1F4DA;</span>
        <span>Open from Library</span>
      </button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface TabBarProps {
  onNewPartStudio?: () => void;
  onNewDrawing?: () => void;
  onUploadFile?: () => void;
  onOpenLibrary?: () => void;
  // Legacy props for backwards compatibility
  onNewCadDocument?: () => void;
  onOpenFile?: () => void;
}

export function TabBar({
  onNewPartStudio,
  onNewDrawing,
  onUploadFile,
  onOpenLibrary,
  onNewCadDocument,
  onOpenFile,
}: TabBarProps) {
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const updateTab = useTabsStore((s) => s.updateTab);

  // Use new props or fallback to legacy props
  const handleNewPartStudio = onNewPartStudio || onNewCadDocument || (() => {});
  const handleUploadFile = onUploadFile || onOpenFile || (() => {});
  const setActiveTab = useTabsStore((s) => s.setActiveTab);
  const closeTab = useTabsStore((s) => s.closeTab);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addButtonHovered, setAddButtonHovered] = useState(false);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const handleRename = (tabId: string) => {
    setRenamingTabId(tabId);
  };

  const handleRenameSubmit = (tabId: string, newName: string) => {
    if (newName.trim()) {
      updateTab(tabId, { name: newName.trim() });
    }
    setRenamingTabId(null);
  };

  const handleRenameCancel = () => {
    setRenamingTabId(null);
  };

  return (
    <div style={styles.container}>
      {/* Tabs */}
      <div style={styles.tabsWrapper}>
        {tabs.length === 0 ? (
          <div style={styles.emptyState}>No documents open</div>
        ) : (
          <div style={styles.tabsScroller}>
            {tabs.map((tab) => (
              <Tab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                isRenaming={renamingTabId === tab.id}
                onActivate={() => setActiveTab(tab.id)}
                onClose={() => closeTab(tab.id)}
                onContextMenu={(e) => handleContextMenu(e, tab.id)}
                onRenameSubmit={(newName) => handleRenameSubmit(tab.id, newName)}
                onRenameCancel={handleRenameCancel}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        <button
          style={{
            ...styles.actionButton,
            ...(addButtonHovered || showAddMenu ? styles.actionButtonHover : {}),
          }}
          onClick={(e) => {
            e.stopPropagation();
            setShowAddMenu(!showAddMenu);
          }}
          onMouseEnter={() => setAddButtonHovered(true)}
          onMouseLeave={() => setAddButtonHovered(false)}
          title="New / Open"
        >
          +
        </button>

        {/* Add Menu */}
        {showAddMenu && (
          <AddMenu
            onClose={() => setShowAddMenu(false)}
            onNewPartStudio={handleNewPartStudio}
            onNewDrawing={onNewDrawing || (() => {})}
            onUploadFile={handleUploadFile}
            onOpenLibrary={onOpenLibrary || (() => {})}
          />
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tabId={contextMenu.tabId}
          onClose={() => setContextMenu(null)}
          onRename={handleRename}
        />
      )}
    </div>
  );
}

export default TabBar;
