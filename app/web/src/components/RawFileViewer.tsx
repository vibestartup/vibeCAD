/**
 * RawFileViewer - displays raw files with download option
 */

import React, { useState, useCallback } from "react";
import type { RawDocument } from "../store/tabs-store";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f1a",
    padding: 32,
  },

  card: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    border: "1px solid #333",
    padding: 32,
    maxWidth: 400,
    width: "100%",
    textAlign: "center" as const,
  },

  icon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.6,
  },

  filename: {
    fontSize: 18,
    fontWeight: 600,
    color: "#fff",
    marginBottom: 8,
    wordBreak: "break-all" as const,
  },

  mimeType: {
    fontSize: 12,
    color: "#666",
    marginBottom: 24,
    fontFamily: "monospace",
  },

  info: {
    display: "flex",
    justifyContent: "center",
    gap: 24,
    marginBottom: 24,
  },

  infoItem: {
    textAlign: "center" as const,
  },

  infoValue: {
    fontSize: 14,
    fontWeight: 600,
    color: "#4dabf7",
    marginBottom: 4,
  },

  infoLabel: {
    fontSize: 11,
    color: "#666",
    textTransform: "uppercase" as const,
  },

  downloadButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 24px",
    borderRadius: 6,
    border: "none",
    backgroundColor: "#646cff",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.15s, transform 0.15s",
  },

  downloadButtonHover: {
    backgroundColor: "#747bff",
    transform: "translateY(-1px)",
  },

  noPreview: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#252545",
    borderRadius: 8,
    fontSize: 12,
    color: "#888",
  },

  hexPreview: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#0f0f1a",
    borderRadius: 8,
    fontSize: 11,
    fontFamily: "monospace",
    color: "#888",
    textAlign: "left" as const,
    overflow: "auto",
    maxHeight: 200,
    whiteSpace: "pre" as const,
  },
};

// ============================================================================
// Helpers
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("text/")) return "\u{1F4C4}";
  if (mimeType.startsWith("audio/")) return "\u{1F3B5}";
  if (mimeType.startsWith("video/")) return "\u{1F3AC}";
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return "\u{1F4E6}";
  if (mimeType.includes("pdf")) return "\u{1F4D1}";
  if (mimeType.includes("json")) return "{ }";
  if (mimeType.includes("xml")) return "<>";
  return "\u{1F4C1}";
}

function base64ToHexPreview(base64: string, maxBytes: number = 256): string {
  try {
    const binary = atob(base64);
    const bytes = Math.min(binary.length, maxBytes);
    const lines: string[] = [];

    for (let i = 0; i < bytes; i += 16) {
      const hex: string[] = [];
      const ascii: string[] = [];

      for (let j = 0; j < 16 && i + j < bytes; j++) {
        const byte = binary.charCodeAt(i + j);
        hex.push(byte.toString(16).padStart(2, "0"));
        ascii.push(byte >= 32 && byte < 127 ? String.fromCharCode(byte) : ".");
      }

      const offset = i.toString(16).padStart(8, "0");
      const hexStr = hex.join(" ").padEnd(48, " ");
      lines.push(`${offset}  ${hexStr}  ${ascii.join("")}`);
    }

    if (binary.length > maxBytes) {
      lines.push(`... ${binary.length - maxBytes} more bytes`);
    }

    return lines.join("\n");
  } catch {
    return "Unable to preview file contents";
  }
}

// ============================================================================
// Component
// ============================================================================

interface RawFileViewerProps {
  document: RawDocument;
}

export function RawFileViewer({ document }: RawFileViewerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showHex, setShowHex] = useState(false);

  const handleDownload = useCallback(() => {
    try {
      // Convert base64 to blob
      const binary = atob(document.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: document.mimeType });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = document.originalFilename;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download file:", err);
    }
  }, [document]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>{getFileIcon(document.mimeType)}</div>
        <div style={styles.filename}>{document.originalFilename}</div>
        <div style={styles.mimeType}>{document.mimeType}</div>

        <div style={styles.info}>
          <div style={styles.infoItem}>
            <div style={styles.infoValue}>{formatFileSize(document.size)}</div>
            <div style={styles.infoLabel}>Size</div>
          </div>
        </div>

        <button
          style={{
            ...styles.downloadButton,
            ...(isHovered ? styles.downloadButtonHover : {}),
          }}
          onClick={handleDownload}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <span>&#x2B73;</span>
          Download File
        </button>

        <div style={styles.noPreview}>
          This file type cannot be previewed directly.
          <br />
          <button
            onClick={() => setShowHex(!showHex)}
            style={{
              marginTop: 8,
              background: "none",
              border: "none",
              color: "#4dabf7",
              cursor: "pointer",
              fontSize: 12,
              textDecoration: "underline",
            }}
          >
            {showHex ? "Hide hex preview" : "Show hex preview"}
          </button>
        </div>

        {showHex && (
          <div style={styles.hexPreview}>
            {base64ToHexPreview(document.data)}
          </div>
        )}
      </div>
    </div>
  );
}

export default RawFileViewer;
