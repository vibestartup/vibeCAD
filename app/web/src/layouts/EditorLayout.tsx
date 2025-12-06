/**
 * Editor Layout - main CAD editor layout with panels.
 */

import React, { useState } from "react";

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
}: EditorLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(240);
  const [rightWidth, setRightWidth] = useState(280);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100vw",
        height: "100vh",
        backgroundColor: "#0f0f1a",
        color: "#e0e0e0",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      {toolbar && (
        <div
          style={{
            height: 48,
            borderBottom: "1px solid #333",
            backgroundColor: "#1a1a2e",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            flexShrink: 0,
          }}
        >
          {toolbar}
        </div>
      )}

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* Left panel */}
        {leftPanel && (
          <div
            style={{
              width: leftCollapsed ? 40 : leftWidth,
              borderRight: "1px solid #333",
              backgroundColor: "#1a1a2e",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
              transition: "width 0.2s ease",
            }}
          >
            {/* Collapse button */}
            <button
              onClick={() => setLeftCollapsed(!leftCollapsed)}
              style={{
                height: 32,
                border: "none",
                backgroundColor: "transparent",
                color: "#666",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderBottom: "1px solid #333",
              }}
            >
              {leftCollapsed ? "→" : "←"}
            </button>

            {/* Panel content */}
            {!leftCollapsed && (
              <div style={{ flex: 1, overflow: "hidden" }}>{leftPanel}</div>
            )}
          </div>
        )}

        {/* Viewport */}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {viewport}
        </div>

        {/* Right panel */}
        {rightPanel && (
          <div
            style={{
              width: rightCollapsed ? 40 : rightWidth,
              borderLeft: "1px solid #333",
              backgroundColor: "#1a1a2e",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
              transition: "width 0.2s ease",
            }}
          >
            {/* Collapse button */}
            <button
              onClick={() => setRightCollapsed(!rightCollapsed)}
              style={{
                height: 32,
                border: "none",
                backgroundColor: "transparent",
                color: "#666",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderBottom: "1px solid #333",
              }}
            >
              {rightCollapsed ? "←" : "→"}
            </button>

            {/* Panel content */}
            {!rightCollapsed && (
              <div style={{ flex: 1, overflow: "hidden" }}>{rightPanel}</div>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      {statusBar && (
        <div
          style={{
            height: 24,
            borderTop: "1px solid #333",
            backgroundColor: "#1a1a2e",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            fontSize: 11,
            color: "#888",
            flexShrink: 0,
          }}
        >
          {statusBar}
        </div>
      )}
    </div>
  );
}

export default EditorLayout;
