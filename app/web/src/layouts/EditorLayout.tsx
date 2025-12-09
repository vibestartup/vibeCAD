/**
 * Editor Layout - main CAD editor layout with floating glassy panels.
 * The viewport extends full-screen underneath all panels.
 * Panels are resizable via drag handles.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";

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
// Resize handle styles
// ============================================================================

const resizeHandleStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  width: 6,
  cursor: "ew-resize",
  backgroundColor: "transparent",
  zIndex: 11,
};

const resizeHandleHoverStyle: React.CSSProperties = {
  backgroundColor: "rgba(100, 108, 255, 0.5)",
};

// ============================================================================
// Constants
// ============================================================================

const LEFT_WIDTH_DEFAULT = 240;
const LEFT_WIDTH_MIN = 180;
const LEFT_WIDTH_MAX = 500;

const RIGHT_WIDTH_DEFAULT = 280;
const RIGHT_WIDTH_MIN = 200;
const RIGHT_WIDTH_MAX = 500;

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
  /** Current left panel width (optional, for external tracking) */
  leftWidth?: number;
  /** Current right panel width (optional, for external tracking) */
  rightWidth?: number;
  /** Callback when left panel width changes */
  onLeftWidthChange?: (width: number) => void;
  /** Callback when right panel width changes */
  onRightWidthChange?: (width: number) => void;
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
  leftWidth: externalLeftWidth,
  rightWidth: externalRightWidth,
  onLeftWidthChange,
  onRightWidthChange,
}: EditorLayoutProps) {
  // Resizable panel widths (internal state, can be overridden by props)
  const [internalLeftWidth, setInternalLeftWidth] = useState(LEFT_WIDTH_DEFAULT);
  const [internalRightWidth, setInternalRightWidth] = useState(RIGHT_WIDTH_DEFAULT);

  // Use external width if provided, otherwise internal
  const leftWidth = externalLeftWidth ?? internalLeftWidth;
  const rightWidth = externalRightWidth ?? internalRightWidth;

  // Setters that call both internal state and external callback
  const setLeftWidth = useCallback(
    (width: number) => {
      setInternalLeftWidth(width);
      onLeftWidthChange?.(width);
    },
    [onLeftWidthChange]
  );

  const setRightWidth = useCallback(
    (width: number) => {
      setInternalRightWidth(width);
      onRightWidthChange?.(width);
    },
    [onRightWidthChange]
  );

  // Drag state
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [leftHover, setLeftHover] = useState(false);
  const [rightHover, setRightHover] = useState(false);

  // Store initial position for drag calculations
  const dragStartRef = useRef<{ x: number; width: number } | null>(null);

  // Handle mouse move for resizing
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      if (isResizingLeft) {
        // Left panel: dragging right edge, so width increases with mouse X
        const delta = e.clientX - dragStartRef.current.x;
        const newWidth = Math.max(
          LEFT_WIDTH_MIN,
          Math.min(LEFT_WIDTH_MAX, dragStartRef.current.width + delta)
        );
        setLeftWidth(newWidth);
      } else if (isResizingRight) {
        // Right panel: dragging left edge, so width increases as mouse X decreases
        const delta = dragStartRef.current.x - e.clientX;
        const newWidth = Math.max(
          RIGHT_WIDTH_MIN,
          Math.min(RIGHT_WIDTH_MAX, dragStartRef.current.width + delta)
        );
        setRightWidth(newWidth);
      }
    },
    [isResizingLeft, isResizingRight]
  );

  // Handle mouse up to stop resizing
  const handleMouseUp = useCallback(() => {
    setIsResizingLeft(false);
    setIsResizingRight(false);
    dragStartRef.current = null;
  }, []);

  // Add/remove global mouse listeners
  useEffect(() => {
    if (isResizingLeft || isResizingRight) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      // Prevent text selection while dragging
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ew-resize";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizingLeft, isResizingRight, handleMouseMove, handleMouseUp]);

  // Start resizing left panel
  const handleLeftResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingLeft(true);
      dragStartRef.current = { x: e.clientX, width: leftWidth };
    },
    [leftWidth]
  );

  // Start resizing right panel
  const handleRightResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingRight(true);
      dragStartRef.current = { x: e.clientX, width: rightWidth };
    },
    [rightWidth]
  );

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
          {/* Resize handle on right edge */}
          <div
            style={{
              ...resizeHandleStyle,
              right: -3,
              ...(leftHover || isResizingLeft ? resizeHandleHoverStyle : {}),
            }}
            onMouseDown={handleLeftResizeStart}
            onMouseEnter={() => setLeftHover(true)}
            onMouseLeave={() => setLeftHover(false)}
          />
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
          {/* Resize handle on left edge */}
          <div
            style={{
              ...resizeHandleStyle,
              left: -3,
              ...(rightHover || isResizingRight ? resizeHandleHoverStyle : {}),
            }}
            onMouseDown={handleRightResizeStart}
            onMouseEnter={() => setRightHover(true)}
            onMouseLeave={() => setRightHover(false)}
          />
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
