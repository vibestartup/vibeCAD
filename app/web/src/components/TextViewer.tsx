/**
 * TextViewer - displays text/code files with syntax highlighting
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { TextDocument } from "../store/tabs-store";

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

  languageBadge: {
    fontSize: 10,
    color: "#4dabf7",
    backgroundColor: "#252545",
    padding: "2px 8px",
    borderRadius: 4,
    textTransform: "uppercase" as const,
  },

  content: {
    flex: 1,
    overflow: "auto",
    padding: 0,
    margin: 0,
  },

  codeWrapper: {
    display: "flex",
    minHeight: "100%",
  },

  lineNumbers: {
    padding: "16px 0",
    backgroundColor: "#0a0a14",
    color: "#444",
    fontSize: 12,
    fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
    lineHeight: "1.6",
    textAlign: "right" as const,
    userSelect: "none" as const,
    borderRight: "1px solid #252545",
    minWidth: 50,
    flexShrink: 0,
  },

  lineNumber: {
    padding: "0 12px",
    display: "block",
  },

  code: {
    flex: 1,
    padding: "16px",
    margin: 0,
    fontSize: 12,
    fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
    lineHeight: "1.6",
    color: "#d4d4d4",
    backgroundColor: "transparent",
    whiteSpace: "pre" as const,
    overflow: "visible",
    tabSize: 2,
  },

  searchBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    backgroundColor: "#1a1a2e",
    borderBottom: "1px solid #333",
  },

  searchInput: {
    flex: 1,
    maxWidth: 300,
    padding: "6px 12px",
    borderRadius: 4,
    border: "1px solid #333",
    backgroundColor: "#0f0f1a",
    color: "#fff",
    fontSize: 12,
    outline: "none",
  },

  searchInfo: {
    fontSize: 11,
    color: "#666",
  },
};

// ============================================================================
// Simple Syntax Highlighting
// ============================================================================

interface HighlightRule {
  pattern: RegExp;
  className: string;
  color: string;
}

const syntaxRules: Record<string, HighlightRule[]> = {
  javascript: [
    { pattern: /(\/\/.*$)/gm, className: "comment", color: "#6a9955" },
    { pattern: /(\/\*[\s\S]*?\*\/)/g, className: "comment", color: "#6a9955" },
    { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, className: "string", color: "#ce9178" },
    { pattern: /\b(const|let|var|function|class|extends|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|typeof|instanceof|import|export|from|default|async|await|yield)\b/g, className: "keyword", color: "#569cd6" },
    { pattern: /\b(true|false|null|undefined|NaN|Infinity)\b/g, className: "constant", color: "#4fc1ff" },
    { pattern: /\b(\d+\.?\d*)\b/g, className: "number", color: "#b5cea8" },
  ],
  typescript: [
    { pattern: /(\/\/.*$)/gm, className: "comment", color: "#6a9955" },
    { pattern: /(\/\*[\s\S]*?\*\/)/g, className: "comment", color: "#6a9955" },
    { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, className: "string", color: "#ce9178" },
    { pattern: /\b(const|let|var|function|class|extends|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|typeof|instanceof|import|export|from|default|async|await|yield|type|interface|enum|implements|private|public|protected|readonly|abstract|as|is|keyof|infer)\b/g, className: "keyword", color: "#569cd6" },
    { pattern: /\b(true|false|null|undefined|NaN|Infinity|string|number|boolean|any|void|never|unknown|object)\b/g, className: "constant", color: "#4fc1ff" },
    { pattern: /\b(\d+\.?\d*)\b/g, className: "number", color: "#b5cea8" },
  ],
  json: [
    { pattern: /("(?:[^"\\]|\\.)*")\s*:/g, className: "key", color: "#9cdcfe" },
    { pattern: /:\s*("(?:[^"\\]|\\.)*")/g, className: "string", color: "#ce9178" },
    { pattern: /\b(true|false|null)\b/g, className: "constant", color: "#569cd6" },
    { pattern: /\b(-?\d+\.?\d*)\b/g, className: "number", color: "#b5cea8" },
  ],
  html: [
    { pattern: /(&lt;!--[\s\S]*?--&gt;|<!--[\s\S]*?-->)/g, className: "comment", color: "#6a9955" },
    { pattern: /(&lt;\/?[a-zA-Z][a-zA-Z0-9]*|<\/?[a-zA-Z][a-zA-Z0-9]*)/g, className: "tag", color: "#569cd6" },
    { pattern: /\s([a-zA-Z-]+)=/g, className: "attribute", color: "#9cdcfe" },
    { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, className: "string", color: "#ce9178" },
  ],
  css: [
    { pattern: /(\/\*[\s\S]*?\*\/)/g, className: "comment", color: "#6a9955" },
    { pattern: /([.#]?[a-zA-Z_-][a-zA-Z0-9_-]*)\s*\{/g, className: "selector", color: "#d7ba7d" },
    { pattern: /([a-zA-Z-]+)\s*:/g, className: "property", color: "#9cdcfe" },
    { pattern: /:\s*([^;{}]+)/g, className: "value", color: "#ce9178" },
  ],
  python: [
    { pattern: /(#.*$)/gm, className: "comment", color: "#6a9955" },
    { pattern: /("""[\s\S]*?"""|'''[\s\S]*?''')/g, className: "string", color: "#ce9178" },
    { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, className: "string", color: "#ce9178" },
    { pattern: /\b(def|class|if|elif|else|for|while|try|except|finally|with|as|import|from|return|yield|lambda|and|or|not|in|is|True|False|None|pass|break|continue|raise|global|nonlocal|async|await)\b/g, className: "keyword", color: "#569cd6" },
    { pattern: /\b(\d+\.?\d*)\b/g, className: "number", color: "#b5cea8" },
  ],
  yaml: [
    { pattern: /(#.*$)/gm, className: "comment", color: "#6a9955" },
    { pattern: /^([a-zA-Z_][a-zA-Z0-9_]*):/gm, className: "key", color: "#9cdcfe" },
    { pattern: /:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, className: "string", color: "#ce9178" },
    { pattern: /\b(true|false|null|yes|no|on|off)\b/gi, className: "constant", color: "#569cd6" },
    { pattern: /\b(\d+\.?\d*)\b/g, className: "number", color: "#b5cea8" },
  ],
  plain: [],
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlightCode(code: string, language: string): string {
  const escaped = escapeHtml(code);
  const rules = syntaxRules[language] || syntaxRules.plain;

  if (rules.length === 0) {
    return escaped;
  }

  // Simple approach: apply rules in order with span wrapping
  // This is a basic implementation - a real syntax highlighter would use a proper tokenizer
  let result = escaped;

  for (const rule of rules) {
    result = result.replace(rule.pattern, (match) => {
      return `<span style="color: ${rule.color}">${match}</span>`;
    });
  }

  return result;
}

// ============================================================================
// Component
// ============================================================================

interface TextViewerProps {
  document: TextDocument;
}

export function TextViewer({ document }: TextViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const lines = document.content.split("\n");
  const lineCount = lines.length;

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === "Escape") {
        setShowSearch(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Count search matches
  const searchMatches = searchQuery
    ? (document.content.match(new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length
    : 0;

  // Highlight search matches in content
  const highlightSearchInCode = useCallback((html: string, query: string): string => {
    if (!query) return html;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedQuery})`, "gi");
    return html.replace(regex, '<mark style="background-color: #614d00; color: #fff">$1</mark>');
  }, []);

  const highlightedCode = highlightCode(document.content, document.language);
  const finalCode = highlightSearchInCode(highlightedCode, searchQuery);

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "lines" ? styles.toolbarButtonHover : {}),
            ...(showLineNumbers ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setShowLineNumbers(!showLineNumbers)}
          onMouseEnter={() => setHoveredButton("lines")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Toggle Line Numbers"
        >
          #
        </button>
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "wrap" ? styles.toolbarButtonHover : {}),
            ...(wordWrap ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setWordWrap(!wordWrap)}
          onMouseEnter={() => setHoveredButton("wrap")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Toggle Word Wrap"
        >
          ↩
        </button>
        <div style={styles.toolbarDivider} />
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "search" ? styles.toolbarButtonHover : {}),
            ...(showSearch ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setShowSearch(!showSearch)}
          onMouseEnter={() => setHoveredButton("search")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Search (Ctrl+F)"
        >
          🔍
        </button>
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "copy" ? styles.toolbarButtonHover : {}),
          }}
          onClick={() => navigator.clipboard.writeText(document.content)}
          onMouseEnter={() => setHoveredButton("copy")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Copy to Clipboard"
        >
          Copy
        </button>

        <div style={styles.info}>
          <span style={styles.languageBadge}>{document.language}</span>
          <span style={styles.infoItem}>{lineCount} lines</span>
          <span style={styles.infoItem}>{document.content.length} chars</span>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div style={styles.searchBar}>
          <input
            type="text"
            style={styles.searchInput}
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <span style={styles.searchInfo}>
            {searchQuery ? `${searchMatches} matches` : "Type to search"}
          </span>
        </div>
      )}

      {/* Content */}
      <div style={styles.content} ref={contentRef}>
        <div style={styles.codeWrapper}>
          {showLineNumbers && (
            <div style={styles.lineNumbers}>
              {lines.map((_, i) => (
                <span key={i} style={styles.lineNumber}>
                  {i + 1}
                </span>
              ))}
            </div>
          )}
          <pre
            style={{
              ...styles.code,
              whiteSpace: wordWrap ? "pre-wrap" : "pre",
              wordBreak: wordWrap ? "break-all" : "normal",
            }}
            dangerouslySetInnerHTML={{ __html: finalCode }}
          />
        </div>
      </div>
    </div>
  );
}

export default TextViewer;
