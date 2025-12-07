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
    overflow: "hidden",
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

  contextMenu: {
    position: "fixed" as const,
    backgroundColor: "#1a1a2e",
    border: "1px solid #333",
    borderRadius: 4,
    padding: 4,
    minWidth: 150,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
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
    borderRadius: 3,
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

// ============================================================================
// Icon Helper
// ============================================================================

function getDocumentIcon(type: DocumentType): string {
  switch (type) {
    case "cad":
      return "\u2B22"; // Hexagon
    case "image":
      return "\u{1F5BC}"; // Frame with picture
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
  onActivate: () => void;
  onClose: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function Tab({ tab, isActive, onActivate, onClose, onContextMenu }: TabProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);

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

  return (
    <div
      style={{
        ...styles.tab,
        ...(isActive ? styles.tabActive : {}),
        ...(isHovered && !isActive ? styles.tabHover : {}),
      }}
      onClick={onActivate}
      onMouseDown={handleMiddleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={onContextMenu}
      title={tab.name}
    >
      <span style={styles.tabIcon}>{getDocumentIcon(tab.type)}</span>
      <span style={styles.tabName}>{tab.name}</span>
      {tab.unsaved && <span style={styles.tabUnsaved} title="Unsaved changes" />}
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
    </div>
  );
}

// ============================================================================
// Context Menu
// ============================================================================

interface ContextMenuProps {
  x: number;
  y: number;
  tabId: string;
  onClose: () => void;
}

function ContextMenu({ x, y, tabId, onClose }: ContextMenuProps) {
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

  return (
    <div
      style={{ ...styles.contextMenu, left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
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
// Main Component
// ============================================================================

interface TabBarProps {
  onNewCadDocument?: () => void;
  onOpenFile?: () => void;
}

export function TabBar({ onNewCadDocument, onOpenFile }: TabBarProps) {
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const setActiveTab = useTabsStore((s) => s.setActiveTab);
  const closeTab = useTabsStore((s) => s.closeTab);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  const [newButtonHovered, setNewButtonHovered] = useState(false);
  const [openButtonHovered, setOpenButtonHovered] = useState(false);

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
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
                onActivate={() => setActiveTab(tab.id)}
                onClose={() => closeTab(tab.id)}
                onContextMenu={(e) => handleContextMenu(e, tab.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        {onNewCadDocument && (
          <button
            style={{
              ...styles.actionButton,
              ...(newButtonHovered ? styles.actionButtonHover : {}),
            }}
            onClick={onNewCadDocument}
            onMouseEnter={() => setNewButtonHovered(true)}
            onMouseLeave={() => setNewButtonHovered(false)}
            title="New CAD Document"
          >
            +
          </button>
        )}
        {onOpenFile && (
          <button
            style={{
              ...styles.actionButton,
              ...(openButtonHovered ? styles.actionButtonHover : {}),
            }}
            onClick={onOpenFile}
            onMouseEnter={() => setOpenButtonHovered(true)}
            onMouseLeave={() => setOpenButtonHovered(false)}
            title="Open File"
          >
            &#x1F4C2;
          </button>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tabId={contextMenu.tabId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

export default TabBar;
