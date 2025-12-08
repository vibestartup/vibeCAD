/**
 * PdfViewer - displays PDF documents using browser's native PDF viewer
 */

import React, { useState } from "react";
import type { PdfDocument } from "../store/tabs-store";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    backgroundColor: "#0f0f1a",
    overflow: "hidden",
  },

  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    backgroundColor: "#1a1a2e",
    borderBottom: "1px solid #333",
    flexShrink: 0,
  },

  toolbarButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 12px",
    borderRadius: 4,
    backgroundColor: "transparent",
    border: "1px solid #333",
    color: "#888",
    fontSize: 12,
    cursor: "pointer",
    transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
    gap: 6,
  },

  toolbarButtonHover: {
    backgroundColor: "#252545",
    borderColor: "#444",
    color: "#fff",
  },

  info: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  infoItem: {
    fontSize: 11,
    color: "#666",
  },

  filename: {
    fontSize: 12,
    color: "#888",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    maxWidth: 200,
  },

  viewer: {
    flex: 1,
    width: "100%",
    border: "none",
    backgroundColor: "#525659",
  },

  fallback: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },

  fallbackIcon: {
    fontSize: 64,
    opacity: 0.5,
  },

  fallbackText: {
    fontSize: 14,
    color: "#888",
    textAlign: "center" as const,
  },

  downloadLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 24px",
    borderRadius: 6,
    backgroundColor: "#646cff",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
    border: "none",
    transition: "background-color 0.15s",
  },
};

// ============================================================================
// Helpers
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ============================================================================
// Component
// ============================================================================

interface PdfViewerProps {
  document: PdfDocument;
}

export function PdfViewer({ document }: PdfViewerProps) {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [useNativeViewer, setUseNativeViewer] = useState(true);

  const handleDownload = () => {
    const link = window.document.createElement("a");
    link.href = document.src;
    link.download = document.originalFilename;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const handleOpenExternal = () => {
    window.open(document.src, "_blank");
  };

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <span style={styles.filename} title={document.originalFilename}>
          {document.originalFilename}
        </span>

        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "download" ? styles.toolbarButtonHover : {}),
          }}
          onClick={handleDownload}
          onMouseEnter={() => setHoveredButton("download")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Download PDF"
        >
          <span>⬇</span>
          Download
        </button>

        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "external" ? styles.toolbarButtonHover : {}),
          }}
          onClick={handleOpenExternal}
          onMouseEnter={() => setHoveredButton("external")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Open in New Tab"
        >
          <span>↗</span>
          Open in Tab
        </button>

        <div style={styles.info}>
          <span style={styles.infoItem}>{formatFileSize(document.size)}</span>
        </div>
      </div>

      {/* PDF Viewer */}
      {useNativeViewer ? (
        <iframe
          src={document.src}
          style={styles.viewer}
          title={document.name}
          onError={() => setUseNativeViewer(false)}
        />
      ) : (
        <div style={styles.fallback}>
          <div style={styles.fallbackIcon}>📄</div>
          <div style={styles.fallbackText}>
            PDF preview is not available in this browser.
            <br />
            You can download the file or open it in a new tab.
          </div>
          <button
            style={{
              ...styles.downloadLink,
              ...(hoveredButton === "fallbackDownload" ? { backgroundColor: "#747bff" } : {}),
            }}
            onClick={handleDownload}
            onMouseEnter={() => setHoveredButton("fallbackDownload")}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <span>⬇</span>
            Download PDF
          </button>
        </div>
      )}
    </div>
  );
}

export default PdfViewer;
