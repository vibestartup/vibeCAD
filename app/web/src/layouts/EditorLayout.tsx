/**
 * Editor Layout - main CAD editor layout with floating glassy panels.
 * The viewport extends full-screen underneath all panels.
 */

import React from "react";

// ============================================================================
// Shared glass effect styles
// ============================================================================

const glassStyle: React.CSSProperties = {
  backgroundColor: "rgba(20, 20, 35, 0.75)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
};

// ============================================================================
// Props
// ============================================================================

interface EditorLayoutProps {
  /** Left panel content (feature tree) */
  leftPanel?: React.ReactNode;
  /** Right panel content (params, properties) */
  rightPanel?: React.ReactNode;
  /** Main viewport content */
  viewport: React.ReactNode;
  /** Toolbar content */
  toolbar?: React.ReactNode;
  /** Status bar content */
  statusBar?: React.ReactNode;
  /** Whether left panel is collapsed */
  leftCollapsed?: boolean;
  /** Toggle left panel */
  onToggleLeft?: () => void;
  /** Whether right panel is collapsed */
  rightCollapsed?: boolean;
  /** Toggle right panel */
  onToggleRight?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function EditorLayout({
  leftPanel,
  rightPanel,
  viewport,
  toolbar,
  statusBar,
  leftCollapsed = false,
  onToggleLeft,
  rightCollapsed = false,
  onToggleRight,
}: EditorLayoutProps) {
  const leftWidth = 240;
  const rightWidth = 280;

  const toolbarHeight = toolbar ? 48 : 0;
  const actualLeftWidth = leftPanel ? (leftCollapsed ? 0 : leftWidth) : 0;
  const actualRightWidth = rightPanel ? (rightCollapsed ? 0 : rightWidth) : 0;

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        backgroundColor: "#0f0f1a",
        color: "#e0e0e0",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Viewport - full screen behind everything */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        {viewport}
      </div>

      {/* Toolbar - flush to top edge */}
      {toolbar && (
        <div
          style={{
            ...glassStyle,
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: toolbarHeight,
            borderRadius: 0,
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
            zIndex: 20,
          }}
        >
          {/* Toolbar content - takes available space, scrolls internally */}
          <div style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", alignItems: "center" }}>
            {toolbar}
          </div>

          {/* Panel toggle buttons (right side of toolbar) - always visible */}
          <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 12 }}>
            {leftPanel && onToggleLeft && (
              <button
                onClick={onToggleLeft}
                style={{
                  width: 28,
                  height: 28,
                  border: "none",
                  borderRadius: 4,
                  backgroundColor: leftCollapsed ? "rgba(255, 255, 255, 0.1)" : "rgba(100, 108, 255, 0.2)",
                  color: leftCollapsed ? "#666" : "#aaa",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
                title={leftCollapsed ? "Show Left Panel" : "Hide Left Panel"}
              >
                ◧
              </button>
            )}
            {rightPanel && onToggleRight && (
              <button
                onClick={onToggleRight}
                style={{
                  width: 28,
                  height: 28,
                  border: "none",
                  borderRadius: 4,
                  backgroundColor: rightCollapsed ? "rgba(255, 255, 255, 0.1)" : "rgba(100, 108, 255, 0.2)",
                  color: rightCollapsed ? "#666" : "#aaa",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
                title={rightCollapsed ? "Show Right Panel" : "Hide Right Panel"}
              >
                ◨
              </button>
            )}
          </div>
        </div>
      )}

      {/* Left panel - floating */}
      {leftPanel && !leftCollapsed && (
        <div
          style={{
            ...glassStyle,
            position: "absolute",
            top: toolbarHeight + 12,
            left: 12,
            bottom: 12,
            width: leftWidth,
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
            zIndex: 10,
            overflow: "hidden",
          }}
        >
          <div style={{ flex: 1, overflow: "auto" }}>{leftPanel}</div>
        </div>
      )}

      {/* Right panel - floating */}
      {rightPanel && !rightCollapsed && (
        <div
          style={{
            ...glassStyle,
            position: "absolute",
            top: toolbarHeight + 12,
            right: 12,
            bottom: 12,
            width: rightWidth,
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
            zIndex: 10,
            overflow: "hidden",
          }}
        >
          <div style={{ flex: 1, overflow: "auto" }}>{rightPanel}</div>
        </div>
      )}

      {/* Status bar - naked text at bottom, between sidebars */}
      {statusBar && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: actualLeftWidth + 24,
            right: actualRightWidth + 24,
            display: "flex",
            alignItems: "center",
            padding: "0 8px",
            fontSize: 11,
            color: "#666",
            pointerEvents: "none",
            zIndex: 5,
                      }}
        >
          {statusBar}
        </div>
      )}
    </div>
  );
}

export default EditorLayout;
