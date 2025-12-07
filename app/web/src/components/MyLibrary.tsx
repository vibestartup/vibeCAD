/**
 * MyLibrary - file browser for vibeCAD files and folders.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useFileStore, initializeFileSystem, uploadFile, downloadFile, serializePartStudio } from "../store/file-store";
import { useCadStore } from "../store/cad-store";
import { createPartStudioWithCube } from "@vibecad/core";
import { captureThumbnail } from "../utils/viewport-capture";
import { path } from "@vibecad/fs";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  overlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },

  modal: {
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    border: "1px solid #333",
    width: "100%",
    maxWidth: 800,
    maxHeight: "85vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column" as const,
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid #333",
    flexShrink: 0,
  },

  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: "#fff",
  },

  closeButton: {
    background: "none",
    border: "none",
    color: "#888",
    fontSize: 20,
    cursor: "pointer",
    padding: 4,
    lineHeight: 1,
  },

  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "8px 20px",
    backgroundColor: "#0f0f1a",
    borderBottom: "1px solid #333",
    fontSize: 13,
    color: "#888",
    flexShrink: 0,
    overflowX: "auto" as const,
  },

  breadcrumbItem: {
    background: "none",
    border: "none",
    color: "#888",
    cursor: "pointer",
    padding: "2px 6px",
    borderRadius: 3,
    fontSize: 13,
  },

  breadcrumbItemHover: {
    backgroundColor: "#333",
    color: "#fff",
  },

  breadcrumbSeparator: {
    color: "#555",
  },

  actions: {
    display: "flex",
    gap: 8,
    padding: "12px 20px",
    borderBottom: "1px solid #333",
    flexShrink: 0,
    flexWrap: "wrap" as const,
  },

  button: {
    padding: "8px 14px",
    borderRadius: 4,
    border: "none",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  primaryButton: {
    backgroundColor: "#646cff",
    color: "#fff",
  },

  secondaryButton: {
    backgroundColor: "#333",
    color: "#fff",
  },

  dangerButton: {
    backgroundColor: "#dc3545",
    color: "#fff",
  },

  content: {
    flex: 1,
    overflow: "auto",
    padding: 16,
  },

  emptyState: {
    textAlign: "center" as const,
    padding: "60px 20px",
    color: "#666",
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },

  emptyText: {
    fontSize: 14,
    marginBottom: 8,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: 12,
  },

  card: {
    backgroundColor: "#0f0f1a",
    borderRadius: 8,
    border: "1px solid #333",
    overflow: "hidden",
    cursor: "pointer",
    transition: "border-color 0.15s, transform 0.15s",
  },

  cardHover: {
    borderColor: "#646cff",
    transform: "translateY(-2px)",
  },

  cardSelected: {
    borderColor: "#646cff",
    backgroundColor: "#1a1a3e",
  },

  cardThumbnail: {
    width: "100%",
    height: 90,
    backgroundColor: "#1a1a2e",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    color: "#444",
    overflow: "hidden",
  },

  cardInfo: {
    padding: 10,
  },

  cardName: {
    fontSize: 12,
    fontWeight: 500,
    color: "#fff",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },

  cardMeta: {
    fontSize: 10,
    color: "#666",
    marginTop: 2,
  },

  folderIcon: {
    color: "#ffa94d",
  },

  fileIcon: {
    color: "#646cff",
  },

  contextMenu: {
    position: "fixed" as const,
    backgroundColor: "#252530",
    border: "1px solid #333",
    borderRadius: 6,
    padding: 4,
    minWidth: 140,
    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    zIndex: 1100,
  },

  contextMenuItem: {
    display: "block",
    width: "100%",
    padding: "8px 12px",
    border: "none",
    backgroundColor: "transparent",
    color: "#ccc",
    fontSize: 12,
    textAlign: "left" as const,
    cursor: "pointer",
    borderRadius: 4,
  },

  contextMenuItemHover: {
    backgroundColor: "#333",
    color: "#fff",
  },

  contextMenuItemDanger: {
    color: "#ff6b6b",
  },

  renameInput: {
    width: "100%",
    padding: "4px 8px",
    borderRadius: 4,
    border: "1px solid #646cff",
    backgroundColor: "#0f0f1a",
    color: "#fff",
    fontSize: 12,
    outline: "none",
  },

  newFolderInput: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 4,
    border: "1px solid #333",
    backgroundColor: "#0f0f1a",
    color: "#fff",
    fontSize: 13,
    outline: "none",
  },
};

// ============================================================================
// Types
// ============================================================================

interface ContextMenuState {
  x: number;
  y: number;
  entry: { path: string; name: string; isDirectory: boolean };
}

// ============================================================================
// File Card Component
// ============================================================================

interface FileCardProps {
  entry: {
    path: string;
    name: string;
    isDirectory: boolean;
    thumbnail?: string;
    modifiedAt: number;
  };
  isSelected: boolean;
  onOpen: () => void;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  isRenaming: boolean;
  onRename: (newName: string) => void;
  onCancelRename: () => void;
}

function FileCard({
  entry,
  isSelected,
  onOpen,
  onSelect,
  onContextMenu,
  isRenaming,
  onRename,
  onCancelRename,
}: FileCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [renameValue, setRenameValue] = useState(entry.name);

  const handleDoubleClick = () => {
    onOpen();
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue !== entry.name) {
      onRename(renameValue.trim());
    } else {
      onCancelRename();
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      onCancelRename();
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div
      style={{
        ...styles.card,
        ...(isHovered ? styles.cardHover : {}),
        ...(isSelected ? styles.cardSelected : {}),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div style={styles.cardThumbnail}>
        {entry.isDirectory ? (
          <span style={styles.folderIcon}>&#x1F4C1;</span>
        ) : entry.thumbnail ? (
          <img
            src={entry.thumbnail}
            alt={entry.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={styles.fileIcon}>&#x2B22;</span>
        )}
      </div>
      <div style={styles.cardInfo}>
        {isRenaming ? (
          <input
            type="text"
            style={styles.renameInput}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <>
            <div style={styles.cardName} title={entry.name}>
              {entry.name}
            </div>
            <div style={styles.cardMeta}>{formatDate(entry.modifiedAt)}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface MyLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MyLibrary({ isOpen, onClose }: MyLibraryProps) {
  const fileStore = useFileStore();
  const cadStore = useCadStore();

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [contextMenuHovered, setContextMenuHovered] = useState<string | null>(null);

  // Initialize filesystem and load root on open
  useEffect(() => {
    if (isOpen) {
      initializeFileSystem().then(() => {
        fileStore.navigateTo(fileStore.currentPath || "/");
      });
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (contextMenu) {
          setContextMenu(null);
        } else if (renamingPath) {
          setRenamingPath(null);
        } else if (showNewFolder) {
          setShowNewFolder(false);
          setNewFolderName("");
        } else if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, contextMenu, renamingPath, showNewFolder]);

  // Close context menu on click outside
  useEffect(() => {
    if (contextMenu) {
      const handleClick = () => setContextMenu(null);
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  const handleNewProject = useCallback(() => {
    const studio = createPartStudioWithCube("Untitled");
    cadStore.setStudio(studio);
    fileStore.setOpenFilePath(null);
    onClose();
  }, [cadStore, fileStore, onClose]);

  const handleSaveCurrent = useCallback(async () => {
    const studio = cadStore.studio;
    const thumbnail = captureThumbnail(200, 150, 0.7);
    await fileStore.savePartStudio(studio, { thumbnail: thumbnail ?? undefined });
  }, [cadStore, fileStore]);

  const handleUpload = useCallback(async () => {
    const file = await uploadFile();
    if (file) {
      await fileStore.saveFile(file.name, file.content);
    }
  }, [fileStore]);

  const handleOpenEntry = useCallback(
    async (entry: { path: string; isDirectory: boolean }) => {
      if (entry.isDirectory) {
        await fileStore.navigateTo(entry.path);
        setSelectedPath(null);
      } else {
        // Load PartStudio
        const studio = await fileStore.loadPartStudio(entry.path);
        if (studio) {
          cadStore.setStudio(studio);
          onClose();
        }
      }
    },
    [fileStore, cadStore, onClose]
  );

  const handleCreateFolder = useCallback(async () => {
    if (newFolderName.trim()) {
      await fileStore.createFolder(newFolderName.trim());
      setNewFolderName("");
      setShowNewFolder(false);
    }
  }, [fileStore, newFolderName]);

  const handleRename = useCallback(
    async (oldPath: string, newName: string) => {
      await fileStore.renameEntry(oldPath, newName);
      setRenamingPath(null);
    },
    [fileStore]
  );

  const handleDelete = useCallback(
    async (entryPath: string) => {
      if (confirm("Are you sure you want to delete this?")) {
        await fileStore.deleteEntry(entryPath);
        setSelectedPath(null);
      }
    },
    [fileStore]
  );

  const handleDownload = useCallback(
    async (entryPath: string, name: string) => {
      const studio = await fileStore.loadPartStudio(entryPath);
      if (studio) {
        const content = JSON.stringify(serializePartStudio(studio), null, 2);
        downloadFile(content, name.endsWith(".vibecad") ? name : `${name}.vibecad`);
      }
    },
    [fileStore]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, entry: { path: string; name: string; isDirectory: boolean }) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, entry });
    },
    []
  );

  // Build breadcrumb items
  const breadcrumbParts = path.segments(fileStore.currentPath);
  const breadcrumbs = [
    { path: "/", name: "Root" },
    ...breadcrumbParts.map((name, i) => ({
      path: "/" + breadcrumbParts.slice(0, i + 1).join("/"),
      name,
    })),
  ];

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>My Library</h2>
          <button style={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {/* Breadcrumb */}
        <div style={styles.breadcrumb}>
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.path}>
              {i > 0 && <span style={styles.breadcrumbSeparator}>/</span>}
              <button
                style={styles.breadcrumbItem}
                onClick={() => fileStore.navigateTo(crumb.path)}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={handleNewProject}
          >
            + New Part
          </button>
          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={handleSaveCurrent}
          >
            &#x1F4BE; Save Current
          </button>
          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={handleUpload}
          >
            &#x2B71; Upload
          </button>
          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={() => setShowNewFolder(true)}
          >
            &#x1F4C1; New Folder
          </button>
          {selectedPath && (
            <button
              style={{ ...styles.button, ...styles.dangerButton }}
              onClick={() => handleDelete(selectedPath)}
            >
              &#x2717; Delete
            </button>
          )}
        </div>

        {/* New Folder Input */}
        {showNewFolder && (
          <div style={{ ...styles.actions, borderBottom: "1px solid #333" }}>
            <input
              type="text"
              style={styles.newFolderInput}
              placeholder="Folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") {
                  setShowNewFolder(false);
                  setNewFolderName("");
                }
              }}
              autoFocus
            />
            <button
              style={{ ...styles.button, ...styles.primaryButton }}
              onClick={handleCreateFolder}
            >
              Create
            </button>
            <button
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={() => {
                setShowNewFolder(false);
                setNewFolderName("");
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Content */}
        <div style={styles.content} onClick={() => setSelectedPath(null)}>
          {fileStore.isLoading ? (
            <div style={styles.emptyState}>Loading...</div>
          ) : fileStore.contents.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>&#x1F4C1;</div>
              <div style={styles.emptyText}>This folder is empty</div>
              <div style={{ ...styles.emptyText, color: "#555" }}>
                Create a new part or folder to get started
              </div>
            </div>
          ) : (
            <div style={styles.grid}>
              {fileStore.contents.map((entry) => (
                <FileCard
                  key={entry.path}
                  entry={entry}
                  isSelected={selectedPath === entry.path}
                  onOpen={() => handleOpenEntry(entry)}
                  onSelect={() => setSelectedPath(entry.path)}
                  onContextMenu={(e) =>
                    handleContextMenu(e, {
                      path: entry.path,
                      name: entry.name,
                      isDirectory: entry.isDirectory,
                    })
                  }
                  isRenaming={renamingPath === entry.path}
                  onRename={(newName) => handleRename(entry.path, newName)}
                  onCancelRename={() => setRenamingPath(null)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <div
            style={{
              ...styles.contextMenu,
              left: contextMenu.x,
              top: contextMenu.y,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{
                ...styles.contextMenuItem,
                ...(contextMenuHovered === "open" ? styles.contextMenuItemHover : {}),
              }}
              onClick={() => {
                handleOpenEntry(contextMenu.entry);
                setContextMenu(null);
              }}
              onMouseEnter={() => setContextMenuHovered("open")}
              onMouseLeave={() => setContextMenuHovered(null)}
            >
              {contextMenu.entry.isDirectory ? "Open" : "Load"}
            </button>
            <button
              style={{
                ...styles.contextMenuItem,
                ...(contextMenuHovered === "rename" ? styles.contextMenuItemHover : {}),
              }}
              onClick={() => {
                setRenamingPath(contextMenu.entry.path);
                setContextMenu(null);
              }}
              onMouseEnter={() => setContextMenuHovered("rename")}
              onMouseLeave={() => setContextMenuHovered(null)}
            >
              Rename
            </button>
            {!contextMenu.entry.isDirectory && (
              <button
                style={{
                  ...styles.contextMenuItem,
                  ...(contextMenuHovered === "download" ? styles.contextMenuItemHover : {}),
                }}
                onClick={() => {
                  handleDownload(contextMenu.entry.path, contextMenu.entry.name);
                  setContextMenu(null);
                }}
                onMouseEnter={() => setContextMenuHovered("download")}
                onMouseLeave={() => setContextMenuHovered(null)}
              >
                Download
              </button>
            )}
            <button
              style={{
                ...styles.contextMenuItem,
                ...styles.contextMenuItemDanger,
                ...(contextMenuHovered === "delete" ? styles.contextMenuItemHover : {}),
              }}
              onClick={() => {
                handleDelete(contextMenu.entry.path);
                setContextMenu(null);
              }}
              onMouseEnter={() => setContextMenuHovered("delete")}
              onMouseLeave={() => setContextMenuHovered(null)}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MyLibrary;
