/**
 * MarkdownViewer - displays markdown files with rendered preview
 */

import React, { useState, useMemo } from "react";
import type { MarkdownDocument } from "../store/tabs-store";

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
  },

  toolbarButtonHover: {
    backgroundColor: "#252545",
    borderColor: "#444",
    color: "#fff",
  },

  toolbarButtonActive: {
    backgroundColor: "#646cff",
    borderColor: "#646cff",
    color: "#fff",
  },

  toolbarDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#333",
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

  contentWrapper: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
  },

  pane: {
    flex: 1,
    overflow: "auto",
    padding: 24,
  },

  sourcePane: {
    fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
    fontSize: 13,
    lineHeight: "1.6",
    color: "#d4d4d4",
    whiteSpace: "pre-wrap" as const,
    backgroundColor: "#0a0a14",
    borderRight: "1px solid #333",
  },

  previewPane: {
    backgroundColor: "#0f0f1a",
  },

  divider: {
    width: 1,
    backgroundColor: "#333",
    cursor: "col-resize",
  },
};

// ============================================================================
// Markdown Parser (Simple Implementation)
// ============================================================================

function parseMarkdown(markdown: string): string {
  let html = markdown;

  // Escape HTML
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (fenced)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre style="background-color: #1a1a2e; padding: 16px; border-radius: 6px; overflow-x: auto; font-family: 'Fira Code', monospace; font-size: 13px; line-height: 1.5;"><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background-color: #1a1a2e; padding: 2px 6px; border-radius: 3px; font-family: \'Fira Code\', monospace; font-size: 0.9em;">$1</code>');

  // Headers
  html = html.replace(/^######\s+(.*)$/gm, '<h6 style="color: #fff; font-size: 14px; margin: 16px 0 8px 0; font-weight: 600;">$1</h6>');
  html = html.replace(/^#####\s+(.*)$/gm, '<h5 style="color: #fff; font-size: 15px; margin: 16px 0 8px 0; font-weight: 600;">$1</h5>');
  html = html.replace(/^####\s+(.*)$/gm, '<h4 style="color: #fff; font-size: 16px; margin: 20px 0 8px 0; font-weight: 600;">$1</h4>');
  html = html.replace(/^###\s+(.*)$/gm, '<h3 style="color: #fff; font-size: 18px; margin: 24px 0 12px 0; font-weight: 600;">$1</h3>');
  html = html.replace(/^##\s+(.*)$/gm, '<h2 style="color: #fff; font-size: 22px; margin: 28px 0 12px 0; font-weight: 600; border-bottom: 1px solid #333; padding-bottom: 8px;">$1</h2>');
  html = html.replace(/^#\s+(.*)$/gm, '<h1 style="color: #fff; font-size: 28px; margin: 32px 0 16px 0; font-weight: 700; border-bottom: 1px solid #333; padding-bottom: 8px;">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #fff;">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__([^_]+)__/g, '<strong style="color: #fff;">$1</strong>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~([^~]+)~~/g, '<del style="color: #666;">$1</del>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #4dabf7; text-decoration: none;" target="_blank" rel="noopener noreferrer">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; border-radius: 6px; margin: 8px 0;" />');

  // Horizontal rules
  html = html.replace(/^[-*_]{3,}$/gm, '<hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />');

  // Blockquotes
  html = html.replace(/^&gt;\s+(.*)$/gm, '<blockquote style="border-left: 4px solid #646cff; margin: 16px 0; padding: 8px 16px; color: #888; background-color: #1a1a2e; border-radius: 0 6px 6px 0;">$1</blockquote>');

  // Unordered lists
  html = html.replace(/^[-*+]\s+(.*)$/gm, '<li style="margin: 4px 0; color: #ccc;">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="margin: 16px 0; padding-left: 24px;">$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.*)$/gm, '<li style="margin: 4px 0; color: #ccc;">$1</li>');

  // Task lists
  html = html.replace(/\[ \]/g, '☐');
  html = html.replace(/\[x\]/gi, '☑');

  // Paragraphs (wrap remaining text)
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p style="margin: 12px 0; line-height: 1.7; color: #ccc;">$1</p>');

  // Clean up extra line breaks
  html = html.replace(/\n{3,}/g, '\n\n');

  return html;
}

// ============================================================================
// Rendered Markdown Styles
// ============================================================================

const markdownStyles = `
  .markdown-preview {
    color: #ccc;
    line-height: 1.7;
  }
  .markdown-preview h1:first-child,
  .markdown-preview h2:first-child,
  .markdown-preview h3:first-child {
    margin-top: 0;
  }
  .markdown-preview a:hover {
    text-decoration: underline;
  }
  .markdown-preview ul ul,
  .markdown-preview ol ol,
  .markdown-preview ul ol,
  .markdown-preview ol ul {
    margin: 4px 0;
  }
`;

// ============================================================================
// Component
// ============================================================================

type ViewMode = "preview" | "source" | "split";

interface MarkdownViewerProps {
  document: MarkdownDocument;
}

export function MarkdownViewer({ document }: MarkdownViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const renderedHtml = useMemo(() => parseMarkdown(document.content), [document.content]);

  const lineCount = document.content.split("\n").length;
  const wordCount = document.content.split(/\s+/).filter(Boolean).length;

  return (
    <div style={styles.container}>
      <style>{markdownStyles}</style>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "preview" && viewMode !== "preview" ? styles.toolbarButtonHover : {}),
            ...(viewMode === "preview" ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setViewMode("preview")}
          onMouseEnter={() => setHoveredButton("preview")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Preview"
        >
          Preview
        </button>
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "source" && viewMode !== "source" ? styles.toolbarButtonHover : {}),
            ...(viewMode === "source" ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setViewMode("source")}
          onMouseEnter={() => setHoveredButton("source")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Source"
        >
          Source
        </button>
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "split" && viewMode !== "split" ? styles.toolbarButtonHover : {}),
            ...(viewMode === "split" ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setViewMode("split")}
          onMouseEnter={() => setHoveredButton("split")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Split View"
        >
          Split
        </button>

        <div style={styles.toolbarDivider} />

        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "copy" ? styles.toolbarButtonHover : {}),
          }}
          onClick={() => navigator.clipboard.writeText(document.content)}
          onMouseEnter={() => setHoveredButton("copy")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Copy Source"
        >
          Copy
        </button>

        <div style={styles.info}>
          <span style={styles.infoItem}>{wordCount} words</span>
          <span style={styles.infoItem}>{lineCount} lines</span>
        </div>
      </div>

      {/* Content */}
      <div style={styles.contentWrapper}>
        {/* Source Pane */}
        {(viewMode === "source" || viewMode === "split") && (
          <div style={{ ...styles.pane, ...styles.sourcePane, flex: viewMode === "split" ? 1 : 1 }}>
            {document.content}
          </div>
        )}

        {/* Preview Pane */}
        {(viewMode === "preview" || viewMode === "split") && (
          <div
            className="markdown-preview"
            style={{ ...styles.pane, ...styles.previewPane, flex: viewMode === "split" ? 1 : 1 }}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        )}
      </div>
    </div>
  );
}

export default MarkdownViewer;
