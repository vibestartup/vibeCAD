/**
 * DocumentContainer - renders the appropriate view based on the active tab document type
 */

import React from "react";
import {
  useTabsStore,
  type TabDocument,
  type CadDocument,
  type ImageDocument,
  type RawDocument,
  type TextDocument,
  type PdfDocument,
  type MarkdownDocument,
  type VideoDocument,
  type AudioDocument,
  type Model3dDocument,
} from "../store/tabs-store";
import { ImageViewer } from "./ImageViewer";
import { RawFileViewer } from "./RawFileViewer";
import { TextViewer } from "./TextViewer";
import { PdfViewer } from "./PdfViewer";
import { MarkdownViewer } from "./MarkdownViewer";
import { VideoViewer } from "./VideoViewer";
import { AudioViewer } from "./AudioViewer";
import { Model3dViewer } from "./Model3dViewer";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
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

  emptyActions: {
    display: "flex",
    gap: 12,
  },

  emptyButton: {
    padding: "10px 20px",
    borderRadius: 6,
    border: "none",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s, transform 0.15s",
  },

  primaryButton: {
    backgroundColor: "#646cff",
    color: "#fff",
  },

  secondaryButton: {
    backgroundColor: "#252545",
    color: "#ccc",
    border: "1px solid #333",
  },
};

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
      <div style={styles.emptyActions}>
        {onNewCadDocument && (
          <button
            style={{
              ...styles.emptyButton,
              ...styles.primaryButton,
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
              ...styles.emptyButton,
              ...styles.secondaryButton,
              ...(secondaryHovered ? { backgroundColor: "#333" } : {}),
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
// CAD Editor Wrapper (placeholder - actual editor is passed as child)
// ============================================================================

interface CadEditorWrapperProps {
  document: CadDocument;
  children: React.ReactNode;
}

function CadEditorWrapper({ document, children }: CadEditorWrapperProps) {
  return <>{children}</>;
}

// ============================================================================
// Main Component
// ============================================================================

interface DocumentContainerProps {
  // The CAD editor component to render when a CAD document is active
  cadEditor?: React.ReactNode;
  onNewCadDocument?: () => void;
  onOpenFile?: () => void;
}

export function DocumentContainer({
  cadEditor,
  onNewCadDocument,
  onOpenFile,
}: DocumentContainerProps) {
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const getTab = useTabsStore((s) => s.getTab);

  const activeTab = activeTabId ? getTab(activeTabId) : null;

  // No active tab - show empty state
  if (!activeTab) {
    return (
      <EmptyState onNewCadDocument={onNewCadDocument} onOpenFile={onOpenFile} />
    );
  }

  // Render based on document type
  switch (activeTab.type) {
    case "cad":
      return (
        <div style={styles.container}>
          {cadEditor || (
            <EmptyState
              onNewCadDocument={onNewCadDocument}
              onOpenFile={onOpenFile}
            />
          )}
        </div>
      );

    case "image":
      return (
        <div style={styles.container}>
          <ImageViewer document={activeTab as ImageDocument} />
        </div>
      );

    case "text":
      return (
        <div style={styles.container}>
          <TextViewer document={activeTab as TextDocument} />
        </div>
      );

    case "pdf":
      return (
        <div style={styles.container}>
          <PdfViewer document={activeTab as PdfDocument} />
        </div>
      );

    case "markdown":
      return (
        <div style={styles.container}>
          <MarkdownViewer document={activeTab as MarkdownDocument} />
        </div>
      );

    case "video":
      return (
        <div style={styles.container}>
          <VideoViewer document={activeTab as VideoDocument} />
        </div>
      );

    case "audio":
      return (
        <div style={styles.container}>
          <AudioViewer document={activeTab as AudioDocument} />
        </div>
      );

    case "model3d":
      return (
        <div style={styles.container}>
          <Model3dViewer document={activeTab as Model3dDocument} />
        </div>
      );

    case "raw":
      return (
        <div style={styles.container}>
          <RawFileViewer document={activeTab as RawDocument} />
        </div>
      );

    default:
      return (
        <EmptyState onNewCadDocument={onNewCadDocument} onOpenFile={onOpenFile} />
      );
  }
}

export default DocumentContainer;
