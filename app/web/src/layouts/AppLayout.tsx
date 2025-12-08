/**
 * AppLayout - unified layout with shared sidebars for all document types.
 *
 * The left sidebar always contains the file explorer.
 * The right sidebar content is provided by the active viewer.
 * Both sidebars float over the viewport area.
 */

import React from "react";
import { TabbedSidebar, type TabDefinition } from "../components/TabbedSidebar";
import { FileExplorer } from "../components/FileExplorer";
import { useSidebarStore } from "../store/sidebar-store";

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

interface AppLayoutProps {
  /** Main content area (viewport/viewer) */
  children: React.ReactNode;
  /** Toolbar content */
  toolbar?: React.ReactNode;
  /** Status bar content */
  statusBar?: React.ReactNode;
  /** Additional left sidebar tabs (beyond Explorer) */
  leftExtraTabs?: TabDefinition[];
  /** Right sidebar tabs (provided by viewer) */
  rightTabs?: TabDefinition[];
}

// ============================================================================
// Component
// ============================================================================

export function AppLayout({
  children,
  toolbar,
  statusBar,
  leftExtraTabs = [],
  rightTabs = [],
}: AppLayoutProps) {
  const leftWidth = 240;
  const rightWidth = 280;
  const toolbarHeight = toolbar ? 48 : 0;

  // Sidebar state from store
  const leftCollapsed = useSidebarStore((s) => s.leftCollapsed);
  const rightCollapsed = useSidebarStore((s) => s.rightCollapsed);
  const toggleLeftCollapsed = useSidebarStore((s) => s.toggleLeftCollapsed);
  const toggleRightCollapsed = useSidebarStore((s) => s.toggleRightCollapsed);

  const actualLeftWidth = leftCollapsed ? 0 : leftWidth;
  const actualRightWidth = rightTabs.length > 0 && !rightCollapsed ? rightWidth : 0;

  // Build left sidebar tabs (Explorer is always first)
  const leftTabs: TabDefinition[] = [
    {
      id: "explorer",
      label: "Explorer",
      content: <FileExplorer />,
    },
    ...leftExtraTabs,
  ];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#0f0f1a",
        color: "#e0e0e0",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Main content - full area behind panels */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        {children}
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
          {/* Toolbar content */}
          <div style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", alignItems: "center" }}>
            {toolbar}
          </div>

          {/* Panel toggle buttons */}
          <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 12 }}>
            <button
              onClick={toggleLeftCollapsed}
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
              &#x25E7;
            </button>
            {rightTabs.length > 0 && (
              <button
                onClick={toggleRightCollapsed}
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
                &#x25E8;
              </button>
            )}
          </div>
        </div>
      )}

      {/* Left panel - floating */}
      {!leftCollapsed && (
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
          <TabbedSidebar tabs={leftTabs} defaultTab="explorer" />
        </div>
      )}

      {/* Right panel - floating (only if there are tabs) */}
      {rightTabs.length > 0 && !rightCollapsed && (
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
          <TabbedSidebar tabs={rightTabs} defaultTab={rightTabs[0]?.id} />
        </div>
      )}

      {/* Status bar */}
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

export default AppLayout;
