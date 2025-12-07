/**
 * FileExplorer - VS Code-like file explorer sidebar component.
 * Shows file/folder tree with context menu for operations.
 */

import React, { useEffect, useState, useRef } from "react";
import { useFileStore, type FileEntry, initializeFileSystem } from "../store/file-store";
import { path } from "@vibecad/fs";
import { useCadStore } from "../store";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    fontSize: 12,
  } as React.CSSProperties,

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    flexShrink: 0,
  } as React.CSSProperties,

  headerTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    color: "#888",
  } as React.CSSProperties,

  headerActions: {
    display: "flex",
    gap: 4,
  } as React.CSSProperties,

  headerButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    height: 20,
    borderRadius: 3,
    backgroundColor: "transparent",
    border: "none",
    color: "#888",
    fontSize: 14,
    cursor: "pointer",
    transition: "background-color 0.15s, color 0.15s",
  } as React.CSSProperties,

  headerButtonHover: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "#fff",
  } as React.CSSProperties,

  tree: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "4px 0",
  } as React.CSSProperties,

  treeItem: {
    display: "flex",
    alignItems: "center",
    padding: "4px 8px",
    cursor: "pointer",
    userSelect: "none" as const,
    transition: "background-color 0.1s",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  treeItemHover: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  } as React.CSSProperties,

  treeItemActive: {
    backgroundColor: "rgba(100, 108, 255, 0.2)",
  } as React.CSSProperties,

  treeItemSelected: {
    backgroundColor: "rgba(100, 108, 255, 0.3)",
  } as React.CSSProperties,

  chevron: {
    width: 16,
    height: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    color: "#666",
    flexShrink: 0,
    transition: "transform 0.15s",
  } as React.CSSProperties,

  chevronExpanded: {
    transform: "rotate(90deg)",
  } as React.CSSProperties,

  icon: {
    width: 16,
    height: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    flexShrink: 0,
    marginRight: 6,
  } as React.CSSProperties,

  name: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    color: "#ccc",
  } as React.CSSProperties,

  nameEditing: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    border: "1px solid #646cff",
    borderRadius: 2,
    padding: "1px 4px",
    color: "#fff",
    fontSize: 12,
    outline: "none",
  } as React.CSSProperties,

  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    color: "#666",
    textAlign: "center" as const,
    gap: 8,
  } as React.CSSProperties,

  emptyIcon: {
    fontSize: 32,
    opacity: 0.5,
  } as React.CSSProperties,

  contextMenu: {
    position: "fixed" as const,
    backgroundColor: "#1a1a2e",
    border: "1px solid #333",
    borderRadius: 6,
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
    borderRadius: 4,
    color: "#ccc",
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left" as const,
  } as React.CSSProperties,

  contextMenuItemHover: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
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

  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    color: "#666",
  } as React.CSSProperties,
};

// ============================================================================
// Icons
// ============================================================================

function FolderIcon({ expanded }: { expanded?: boolean }) {
  return <span style={{ color: expanded ? "#ffd43b" : "#fab005" }}>{expanded ? "\u{1F4C2}" : "\u{1F4C1}"}</span>;
}

function FileIcon({ name }: { name: string }) {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".vibecad" || ext === ".json") {
    return <span style={{ color: "#646cff" }}>{"\u2B22"}</span>; // Hexagon for CAD files
  }
  return <span style={{ color: "#868e96" }}>{"\u{1F4C4}"}</span>; // Document
}

// ============================================================================
// Context Menu
// ============================================================================

interface ContextMenuProps {
  x: number;
  y: number;
  entry: FileEntry | null; // null = background context menu
  onClose: () => void;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onNewFolder: () => void;
  onNewFile: () => void;
}

function ContextMenu({
  x,
  y,
  entry,
  onClose,
  onOpen,
  onRename,
  onDelete,
  onNewFolder,
  onNewFile,
}: ContextMenuProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  useEffect(() => {
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

  // Adjust position to stay within viewport
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newX = x;
      let newY = y;
      if (x + rect.width > window.innerWidth - 8) {
        newX = window.innerWidth - rect.width - 8;
      }
      if (y + rect.height > window.innerHeight - 8) {
        newY = window.innerHeight - rect.height - 8;
      }
      setAdjustedPos({ x: newX, y: newY });
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      style={{ ...styles.contextMenu, left: adjustedPos.x, top: adjustedPos.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {entry ? (
        <>
          <button
            style={{
              ...styles.contextMenuItem,
              ...(hoveredItem === "open" ? styles.contextMenuItemHover : {}),
            }}
            onClick={() => {
              onOpen();
              onClose();
            }}
            onMouseEnter={() => setHoveredItem("open")}
            onMouseLeave={() => setHoveredItem(null)}
          >
            {entry.isDirectory ? "Open Folder" : "Open File"}
          </button>
          <button
            style={{
              ...styles.contextMenuItem,
              ...(hoveredItem === "rename" ? styles.contextMenuItemHover : {}),
            }}
            onClick={() => {
              onRename();
              onClose();
            }}
            onMouseEnter={() => setHoveredItem("rename")}
            onMouseLeave={() => setHoveredItem(null)}
          >
            Rename
          </button>
          <div style={styles.contextMenuDivider} />
          <button
            style={{
              ...styles.contextMenuItem,
              ...styles.contextMenuItemDanger,
              ...(hoveredItem === "delete" ? styles.contextMenuItemHover : {}),
            }}
            onClick={() => {
              onDelete();
              onClose();
            }}
            onMouseEnter={() => setHoveredItem("delete")}
            onMouseLeave={() => setHoveredItem(null)}
          >
            Delete
          </button>
        </>
      ) : (
        <>
          <button
            style={{
              ...styles.contextMenuItem,
              ...(hoveredItem === "newFile" ? styles.contextMenuItemHover : {}),
            }}
            onClick={() => {
              onNewFile();
              onClose();
            }}
            onMouseEnter={() => setHoveredItem("newFile")}
            onMouseLeave={() => setHoveredItem(null)}
          >
            New Part Studio
          </button>
          <button
            style={{
              ...styles.contextMenuItem,
              ...(hoveredItem === "newFolder" ? styles.contextMenuItemHover : {}),
            }}
            onClick={() => {
              onNewFolder();
              onClose();
            }}
            onMouseEnter={() => setHoveredItem("newFolder")}
            onMouseLeave={() => setHoveredItem(null)}
          >
            New Folder
          </button>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Tree Item
// ============================================================================

interface TreeItemProps {
  entry: FileEntry;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isRenaming: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRenameSubmit: (newName: string) => void;
  onRenameCancel: () => void;
}

function TreeItem({
  entry,
  depth,
  isExpanded,
  isSelected,
  isRenaming,
  onToggle,
  onSelect,
  onOpen,
  onContextMenu,
  onRenameSubmit,
  onRenameCancel,
}: TreeItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [editName, setEditName] = useState(entry.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onRenameSubmit(editName);
    } else if (e.key === "Escape") {
      onRenameCancel();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (entry.isDirectory) {
      onToggle();
    } else {
      onSelect();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpen();
  };

  return (
    <div
      style={{
        ...styles.treeItem,
        paddingLeft: 8 + depth * 12,
        ...(isHovered && !isSelected ? styles.treeItemHover : {}),
        ...(isSelected ? styles.treeItemSelected : {}),
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Chevron for folders */}
      <span
        style={{
          ...styles.chevron,
          ...(isExpanded ? styles.chevronExpanded : {}),
          visibility: entry.isDirectory ? "visible" : "hidden",
        }}
      >
        {"\u25B6"}
      </span>

      {/* Icon */}
      <span style={styles.icon}>
        {entry.isDirectory ? (
          <FolderIcon expanded={isExpanded} />
        ) : (
          <FileIcon name={entry.name} />
        )}
      </span>

      {/* Name or input */}
      {isRenaming ? (
        <input
          ref={inputRef}
          style={styles.nameEditing}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => onRenameSubmit(editName)}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span style={styles.name}>{entry.name}</span>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface ExpandedFolders {
  [path: string]: boolean;
}

interface FolderContents {
  [path: string]: FileEntry[];
}

export function FileExplorer() {
  const fileStore = useFileStore();
  const setStudio = useCadStore((s) => s.setStudio);
  const cadStudio = useCadStore((s) => s.studio);

  const [expandedFolders, setExpandedFolders] = useState<ExpandedFolders>({ "/": true });
  const [folderContents, setFolderContents] = useState<FolderContents>({});
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry | null;
    parentPath: string;
  } | null>(null);

  const [headerButtonHovered, setHeaderButtonHovered] = useState<string | null>(null);

  // Initialize filesystem and load root
  useEffect(() => {
    const init = async () => {
      await initializeFileSystem();
      await loadFolder("/");
    };
    init();
  }, []);

  // Load folder contents
  const loadFolder = async (folderPath: string) => {
    const fs = (await import("../store/file-store")).getFs();
    try {
      const entries = await fs.list(folderPath);
      // Get extended metadata for thumbnails
      const entriesWithMeta: FileEntry[] = await Promise.all(
        entries.map(async (e) => {
          if (!e.isDirectory) {
            const ext = await fs.statExtended(e.path);
            return { ...e, thumbnail: ext?.thumbnail };
          }
          return e;
        })
      );
      // Sort: folders first, then alphabetically
      entriesWithMeta.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      setFolderContents((prev) => ({ ...prev, [folderPath]: entriesWithMeta }));
    } catch (err) {
      console.error("[FileExplorer] Failed to load folder:", folderPath, err);
    }
  };

  // Toggle folder expansion
  const toggleFolder = async (folderPath: string) => {
    const isExpanded = expandedFolders[folderPath];
    if (!isExpanded) {
      // Load contents if expanding
      await loadFolder(folderPath);
    }
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !isExpanded,
    }));
  };

  // Open file
  const openFile = async (entry: FileEntry) => {
    if (entry.isDirectory) {
      await toggleFolder(entry.path);
    } else {
      // Load the PartStudio
      const studio = await fileStore.loadPartStudio(entry.path);
      if (studio) {
        setStudio(studio);
      }
    }
  };

  // Handle rename
  const handleRename = async (oldPath: string, newName: string) => {
    if (!newName.trim()) {
      setRenamingPath(null);
      return;
    }
    try {
      await fileStore.renameEntry(oldPath, newName);
      // Refresh parent folder
      const parentPath = path.dirname(oldPath);
      await loadFolder(parentPath);
    } catch (err) {
      console.error("[FileExplorer] Rename failed:", err);
    }
    setRenamingPath(null);
  };

  // Handle delete
  const handleDelete = async (entry: FileEntry) => {
    const confirmMsg = entry.isDirectory
      ? `Delete folder "${entry.name}" and all its contents?`
      : `Delete "${entry.name}"?`;
    if (!confirm(confirmMsg)) return;

    try {
      await fileStore.deleteEntry(entry.path);
      // Refresh parent folder
      const parentPath = path.dirname(entry.path);
      await loadFolder(parentPath);
      // Clear selection if deleted
      if (selectedPath === entry.path) {
        setSelectedPath(null);
      }
    } catch (err) {
      console.error("[FileExplorer] Delete failed:", err);
    }
  };

  // Handle new folder
  const handleNewFolder = async (parentPath: string) => {
    const name = prompt("Folder name:");
    if (!name?.trim()) return;

    try {
      const fs = (await import("../store/file-store")).getFs();
      const folderPath = path.join(parentPath, name);
      await fs.mkdir(folderPath);
      await loadFolder(parentPath);
      // Expand parent to show new folder
      setExpandedFolders((prev) => ({ ...prev, [parentPath]: true }));
    } catch (err) {
      console.error("[FileExplorer] Create folder failed:", err);
      alert("Failed to create folder: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  // Handle new file (Part Studio)
  const handleNewFile = async (parentPath: string) => {
    // Save current studio to the specified folder
    try {
      const fileName = cadStudio.name.replace(/\s+/g, "_") + ".vibecad";
      const filePath = path.join(parentPath, fileName);
      await fileStore.savePartStudio(cadStudio, { path: filePath });
      await loadFolder(parentPath);
      // Expand parent to show new file
      setExpandedFolders((prev) => ({ ...prev, [parentPath]: true }));
    } catch (err) {
      console.error("[FileExplorer] Create file failed:", err);
    }
  };

  // Context menu handler
  const handleContextMenu = (
    e: React.MouseEvent,
    entry: FileEntry | null,
    parentPath: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      entry,
      parentPath,
    });
  };

  // Refresh all
  const refreshAll = async () => {
    const paths = Object.keys(expandedFolders).filter((p) => expandedFolders[p]);
    for (const p of paths) {
      await loadFolder(p);
    }
  };

  // Render tree recursively
  const renderTree = (folderPath: string, depth: number = 0): React.ReactNode[] => {
    const contents = folderContents[folderPath] || [];
    const items: React.ReactNode[] = [];

    for (const entry of contents) {
      const isExpanded = expandedFolders[entry.path] || false;
      const isSelected = selectedPath === entry.path;
      const isRenaming = renamingPath === entry.path;

      items.push(
        <TreeItem
          key={entry.path}
          entry={entry}
          depth={depth}
          isExpanded={isExpanded}
          isSelected={isSelected}
          isRenaming={isRenaming}
          onToggle={() => toggleFolder(entry.path)}
          onSelect={() => setSelectedPath(entry.path)}
          onOpen={() => openFile(entry)}
          onContextMenu={(e) => handleContextMenu(e, entry, folderPath)}
          onRenameSubmit={(newName) => handleRename(entry.path, newName)}
          onRenameCancel={() => setRenamingPath(null)}
        />
      );

      // Render children if expanded folder
      if (entry.isDirectory && isExpanded) {
        items.push(...renderTree(entry.path, depth + 1));
      }
    }

    return items;
  };

  const rootContents = folderContents["/"] || [];
  const isLoading = rootContents.length === 0 && !folderContents["/"];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>Explorer</span>
        <div style={styles.headerActions}>
          <button
            style={{
              ...styles.headerButton,
              ...(headerButtonHovered === "newFile" ? styles.headerButtonHover : {}),
            }}
            onClick={() => handleNewFile("/")}
            onMouseEnter={() => setHeaderButtonHovered("newFile")}
            onMouseLeave={() => setHeaderButtonHovered(null)}
            title="Save as new file"
          >
            +
          </button>
          <button
            style={{
              ...styles.headerButton,
              ...(headerButtonHovered === "newFolder" ? styles.headerButtonHover : {}),
            }}
            onClick={() => handleNewFolder("/")}
            onMouseEnter={() => setHeaderButtonHovered("newFolder")}
            onMouseLeave={() => setHeaderButtonHovered(null)}
            title="New folder"
          >
            {"\u{1F4C1}"}
          </button>
          <button
            style={{
              ...styles.headerButton,
              ...(headerButtonHovered === "refresh" ? styles.headerButtonHover : {}),
            }}
            onClick={refreshAll}
            onMouseEnter={() => setHeaderButtonHovered("refresh")}
            onMouseLeave={() => setHeaderButtonHovered(null)}
            title="Refresh"
          >
            {"\u21BB"}
          </button>
        </div>
      </div>

      {/* Tree */}
      <div
        style={styles.tree}
        onContextMenu={(e) => handleContextMenu(e, null, "/")}
      >
        {isLoading ? (
          <div style={styles.loading}>Loading...</div>
        ) : rootContents.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon}>{"\u{1F4C2}"}</span>
            <span>No files yet</span>
            <span style={{ fontSize: 11, color: "#555" }}>
              Right-click to create a folder
            </span>
          </div>
        ) : (
          renderTree("/")
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          onClose={() => setContextMenu(null)}
          onOpen={() => {
            if (contextMenu.entry) {
              openFile(contextMenu.entry);
            }
          }}
          onRename={() => {
            if (contextMenu.entry) {
              setRenamingPath(contextMenu.entry.path);
            }
          }}
          onDelete={() => {
            if (contextMenu.entry) {
              handleDelete(contextMenu.entry);
            }
          }}
          onNewFolder={() => handleNewFolder(contextMenu.parentPath)}
          onNewFile={() => handleNewFile(contextMenu.parentPath)}
        />
      )}
    </div>
  );
}

export default FileExplorer;
