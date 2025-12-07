/**
 * MyLibrary - view and manage saved projects.
 */

import React, { useState } from "react";
import {
  useProjectStore,
  uploadProjectFile,
  type ProjectMetadata,
} from "../store/project-store";
import { useCadStore } from "../store/cad-store";
import { createDocumentWithCube } from "@vibecad/core";
import { captureThumbnail } from "../utils/viewport-capture";

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
    maxWidth: 700,
    maxHeight: "90vh",
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

  actions: {
    display: "flex",
    gap: 8,
    padding: "12px 20px",
    borderBottom: "1px solid #333",
    flexShrink: 0,
  },

  button: {
    padding: "8px 16px",
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

  content: {
    flex: 1,
    overflow: "auto",
    padding: 20,
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

  projectGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 16,
  },

  projectCard: {
    backgroundColor: "#0f0f1a",
    borderRadius: 8,
    border: "1px solid #333",
    overflow: "hidden",
    cursor: "pointer",
    transition: "border-color 0.15s, transform 0.15s",
  },

  projectCardHover: {
    borderColor: "#646cff",
    transform: "translateY(-2px)",
  },

  projectCardActive: {
    borderColor: "#646cff",
    backgroundColor: "#1a1a3e",
  },

  projectThumbnail: {
    width: "100%",
    height: 120,
    backgroundColor: "#1a1a2e",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    color: "#333",
  },

  projectInfo: {
    padding: 12,
  },

  projectName: {
    fontSize: 14,
    fontWeight: 500,
    color: "#fff",
    marginBottom: 4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },

  projectDate: {
    fontSize: 11,
    color: "#666",
  },

  projectActions: {
    display: "flex",
    gap: 4,
    padding: "8px 12px",
    borderTop: "1px solid #333",
  },

  iconButton: {
    background: "none",
    border: "none",
    color: "#888",
    cursor: "pointer",
    padding: 4,
    fontSize: 14,
    borderRadius: 4,
    transition: "color 0.15s, background-color 0.15s",
  },

  iconButtonHover: {
    color: "#fff",
    backgroundColor: "#333",
  },

  iconButtonDanger: {
    color: "#ff6b6b",
  },

  renameInput: {
    width: "100%",
    padding: "4px 8px",
    borderRadius: 4,
    border: "1px solid #646cff",
    backgroundColor: "#0f0f1a",
    color: "#fff",
    fontSize: 14,
    outline: "none",
  },
};

// ============================================================================
// Project Card Component
// ============================================================================

interface ProjectCardProps {
  project: ProjectMetadata;
  isActive: boolean;
  onLoad: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
  onDownload: () => void;
}

function ProjectCard({
  project,
  isActive,
  onLoad,
  onDelete,
  onRename,
  onDownload,
}: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue !== project.name) {
      onRename(renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setRenameValue(project.name);
      setIsRenaming(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div
      style={{
        ...styles.projectCard,
        ...(isHovered ? styles.projectCardHover : {}),
        ...(isActive ? styles.projectCardActive : {}),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onLoad}
    >
      {/* Thumbnail */}
      <div style={styles.projectThumbnail}>
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span>&#x2B22;</span>
        )}
      </div>

      {/* Info */}
      <div style={styles.projectInfo}>
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
          <div style={styles.projectName}>{project.name}</div>
        )}
        <div style={styles.projectDate}>
          Modified {formatDate(project.modifiedAt)}
        </div>
      </div>

      {/* Actions */}
      <div style={styles.projectActions} onClick={(e) => e.stopPropagation()}>
        <button
          style={styles.iconButton}
          onClick={() => {
            setRenameValue(project.name);
            setIsRenaming(true);
          }}
          title="Rename"
        >
          &#x270E;
        </button>
        <button
          style={styles.iconButton}
          onClick={onDownload}
          title="Download"
        >
          &#x2B73;
        </button>
        <button
          style={{ ...styles.iconButton, ...styles.iconButtonDanger }}
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Are you sure you want to delete this project?")) {
              onDelete();
            }
          }}
          title="Delete"
        >
          &#x2717;
        </button>
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
  const projectStore = useProjectStore();
  const cadStore = useCadStore();

  const handleNewProject = () => {
    const doc = createDocumentWithCube("Untitled Project");
    cadStore.setDocument(doc);
    projectStore.setCurrentProjectId(null);
    onClose();
  };

  const handleLoadProject = (projectId: string) => {
    const doc = projectStore.loadProject(projectId);
    if (doc) {
      cadStore.setDocument(doc);
      // Set active studio to the first one
      const firstStudioId = doc.partStudios.keys().next().value;
      if (firstStudioId) {
        cadStore.setActiveStudio(firstStudioId);
      }
      onClose();
    }
  };

  const handleDeleteProject = (projectId: string) => {
    projectStore.deleteProject(projectId);
  };

  const handleRenameProject = (projectId: string, newName: string) => {
    projectStore.renameProject(projectId, newName);
  };

  const handleDownloadProject = (projectId: string) => {
    const doc = projectStore.loadProject(projectId);
    if (doc) {
      projectStore.downloadProject(doc);
    }
  };

  const handleUploadProject = async () => {
    const doc = await uploadProjectFile();
    if (doc) {
      cadStore.setDocument(doc);
      // Save to library
      projectStore.saveProject(doc);
      // Set active studio to the first one
      const firstStudioId = doc.partStudios.keys().next().value;
      if (firstStudioId) {
        cadStore.setActiveStudio(firstStudioId);
      }
      onClose();
    }
  };

  const handleSaveCurrentProject = () => {
    const doc = cadStore.document;
    // Capture thumbnail from viewport
    const thumbnail = captureThumbnail(200, 150, 0.7);
    projectStore.saveProject(doc, thumbnail ?? undefined);
  };

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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

        {/* Actions */}
        <div style={styles.actions}>
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={handleNewProject}
          >
            + New Project
          </button>
          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={handleUploadProject}
          >
            &#x2B71; Upload
          </button>
          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={handleSaveCurrentProject}
          >
            &#x2714; Save Current
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {projectStore.projectList.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>&#x1F4C1;</div>
              <div style={styles.emptyText}>No projects yet</div>
              <div style={{ ...styles.emptyText, color: "#555" }}>
                Create a new project or upload an existing one
              </div>
            </div>
          ) : (
            <div style={styles.projectGrid}>
              {projectStore.projectList.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isActive={project.id === projectStore.currentProjectId}
                  onLoad={() => handleLoadProject(project.id)}
                  onDelete={() => handleDeleteProject(project.id)}
                  onRename={(newName) =>
                    handleRenameProject(project.id, newName)
                  }
                  onDownload={() => handleDownloadProject(project.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MyLibrary;
