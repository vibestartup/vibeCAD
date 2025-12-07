/**
 * OpTimeline - left sidebar showing the operation stack as a timeline.
 * Users can click on any operation to "rewind" to that point.
 */

import React from "react";
import { createPortal } from "react-dom";
import { useCadStore } from "../store";
import type { Op, OpId, SketchOp } from "@vibecad/core";

// Operation type icons
const OP_ICONS: Record<string, string> = {
  sketch: "□",
  extrude: "⬆",
  revolve: "↻",
  sweep: "⤴",
  loft: "⧫",
  boolean: "⊕",
  fillet: "◜",
  chamfer: "◿",
  shell: "◻",
  pattern: "⊞",
  mirror: "⇋",
  // Primitive solids
  box: "⬡",
  cylinder: "⏣",
  sphere: "◉",
  cone: "△",
  // Transform
  transform: "↔",
};

// Operation type colors
const OP_COLORS: Record<string, string> = {
  sketch: "#4dabf7",
  extrude: "#69db7c",
  revolve: "#ffa94d",
  sweep: "#da77f2",
  loft: "#ff8787",
  boolean: "#748ffc",
  fillet: "#63e6be",
  chamfer: "#e599f7",
  shell: "#ffd43b",
  pattern: "#a9e34b",
  mirror: "#74c0fc",
  // Primitive solids
  box: "#ff922b",
  cylinder: "#20c997",
  sphere: "#f783ac",
  cone: "#fcc419",
  // Transform
  transform: "#845ef7",
};

// Operations that produce solid bodies
const BODY_PRODUCING_OPS = new Set([
  "extrude", "revolve", "sweep", "loft", "boolean", "fillet", "chamfer", "shell",
  "box", "cylinder", "sphere", "cone", "transform"
]);

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: "transparent",
  } as React.CSSProperties,

  header: {
    padding: "12px 16px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    fontWeight: 600,
    fontSize: 13,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as React.CSSProperties,

  addButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    border: "none",
    borderRadius: 4,
    backgroundColor: "#646cff",
    color: "#fff",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "bold",
  } as React.CSSProperties,

  timeline: {
    flex: 1,
    overflowY: "auto",
    padding: "2px 0",
  } as React.CSSProperties,

  opItem: {
    display: "flex",
    alignItems: "center",
    padding: "3px 8px",
    cursor: "pointer",
    transition: "background-color 0.15s, border-left-color 0.15s",
    borderLeftWidth: 2,
    borderLeftStyle: "solid",
    borderLeftColor: "transparent",
  } as React.CSSProperties,

  opItemSelected: {
    backgroundColor: "#2d2d4a",
    borderLeftColor: "#646cff",
  } as React.CSSProperties,

  opItemSuppressed: {
    opacity: 0.4,
  } as React.CSSProperties,

  opItemHover: {
    backgroundColor: "#252545",
  } as React.CSSProperties,

  opIcon: {
    fontSize: 12,
    marginRight: 6,
    flexShrink: 0,
  } as React.CSSProperties,

  opName: {
    flex: 1,
    fontSize: 12,
    color: "#fff",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,

  opIndex: {
    fontSize: 9,
    color: "#555",
    width: 16,
    textAlign: "right",
    marginRight: 6,
  } as React.CSSProperties,

  timelineConnector: {
    position: "absolute",
    left: 31,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#333",
  } as React.CSSProperties,

  currentMarker: {
    position: "absolute",
    left: 28,
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "#4dabf7",
    border: "2px solid #1a1a2e",
  } as React.CSSProperties,

  emptyState: {
    padding: 24,
    textAlign: "center",
    color: "#666",
    fontSize: 12,
  } as React.CSSProperties,

  rollbackBar: {
    display: "flex",
    alignItems: "center",
    padding: "2px 8px",
    cursor: "grab",
    userSelect: "none",
  } as React.CSSProperties,

  rollbackBarDragging: {
    cursor: "grabbing",
  } as React.CSSProperties,

  rollbackBarLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#f59f00",
    borderRadius: 1,
  } as React.CSSProperties,

  rollbackBarHandle: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "#f59f00",
    marginLeft: -4,
    boxShadow: "0 0 4px rgba(245, 159, 0, 0.5)",
  } as React.CSSProperties,

  rollbackBarLabel: {
    fontSize: 9,
    color: "#f59f00",
    marginLeft: 6,
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  contextMenu: {
    position: "fixed",
    backgroundColor: "#2a2a4a",
    border: "1px solid #444",
    borderRadius: 4,
    padding: "4px 0",
    zIndex: 1000,
    minWidth: 120,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
  } as React.CSSProperties,

  contextMenuItem: {
    padding: "8px 12px",
    fontSize: 12,
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
  } as React.CSSProperties,

  contextMenuItemHover: {
    backgroundColor: "#3a3a5a",
  } as React.CSSProperties,

  // Bodies section styles
  bodiesSection: {
    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
    padding: "8px 0",
  } as React.CSSProperties,

  bodiesSectionHeader: {
    padding: "8px 16px",
    fontSize: 11,
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  } as React.CSSProperties,

  bodyItem: {
    display: "flex",
    alignItems: "center",
    padding: "3px 8px",
    cursor: "pointer",
    transition: "background-color 0.15s",
    borderLeftWidth: 2,
    borderLeftStyle: "solid",
    borderLeftColor: "transparent",
  } as React.CSSProperties,

  bodyItemSelected: {
    backgroundColor: "#2d2d4a",
    borderLeftColor: "#646cff",
  } as React.CSSProperties,

  bodyItemHover: {
    backgroundColor: "#252545",
  } as React.CSSProperties,

  bodyIcon: {
    fontSize: 12,
    marginRight: 6,
    flexShrink: 0,
  } as React.CSSProperties,

  bodyName: {
    fontSize: 12,
    color: "#ccc",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,
};

// Context menu item component
function ContextMenuItem({
  label,
  icon,
  onClick
}: {
  label: string;
  icon?: string;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      style={{
        ...styles.contextMenuItem,
        ...(isHovered ? styles.contextMenuItemHover : {}),
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
    </div>
  );
}

// Body item component for the bodies list
interface BodyItemProps {
  op: Op;
  isSelected: boolean;
  onClick: () => void;
}

function BodyItem({ op, isSelected, onClick }: BodyItemProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const icon = OP_ICONS[op.type] || "⬢";
  const color = OP_COLORS[op.type] || "#888";

  return (
    <div
      style={{
        ...styles.bodyItem,
        ...(isSelected ? styles.bodyItemSelected : {}),
        ...(isHovered && !isSelected ? styles.bodyItemHover : {}),
        ...(op.suppressed ? { opacity: 0.4 } : {}),
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span style={{ ...styles.bodyIcon, color }}>{icon}</span>
      <span style={styles.bodyName}>
        {op.name}
        {op.suppressed && <span style={{ color: "#666" }}> (hidden)</span>}
      </span>
    </div>
  );
}

// Rollback bar component
interface RollbackBarProps {
  position: number;
  total: number;
  onDragStart: (e: React.MouseEvent) => void;
  isDragging: boolean;
}

function RollbackBar({ position, total, onDragStart, isDragging }: RollbackBarProps) {
  // position -1 means "before all ops", display as 0
  const displayPosition = position + 1;

  return (
    <div
      style={{
        ...styles.rollbackBar,
        ...(isDragging ? styles.rollbackBarDragging : {}),
      }}
      onMouseDown={onDragStart}
    >
      <div style={styles.rollbackBarLine} />
      <div style={styles.rollbackBarHandle} />
      <span style={styles.rollbackBarLabel}>
        {displayPosition}/{total}
      </span>
    </div>
  );
}

interface OpItemProps {
  op: Op;
  index: number;
  isSelected: boolean;
  isSuppressedByRollback: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function OpItem({ op, index, isSelected, isSuppressedByRollback, onClick, onDoubleClick, onContextMenu }: OpItemProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const icon = OP_ICONS[op.type] || "?";
  const color = OP_COLORS[op.type] || "#888";
  const isDimmed = op.suppressed || isSuppressedByRollback;

  return (
    <div
      style={{
        ...styles.opItem,
        ...(isSelected ? styles.opItemSelected : {}),
        ...(isDimmed ? styles.opItemSuppressed : {}),
        ...(isHovered && !isSelected ? styles.opItemHover : {}),
        position: "relative",
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span style={styles.opIndex}>{index + 1}</span>
      <span style={{ ...styles.opIcon, color }}>{icon}</span>
      <span style={styles.opName}>
        {op.name}
        {op.suppressed && <span style={{ color: "#666" }}> (suppressed)</span>}
      </span>
    </div>
  );
}

// Context menu state
interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  op: Op | null;
}

/**
 * OpTimelineContent - the content portion of the operations timeline.
 * Used by both the standalone OpTimeline and the LeftSidebar.
 */
export function OpTimelineContent() {
  const studio = useCadStore((s) => s.studio);
  const opSelection = useCadStore((s) => s.opSelection);
  const setOpSelection = useCadStore((s) => s.setOpSelection);
  const timelinePosition = useCadStore((s) => s.timelinePosition);
  const setTimelinePosition = useCadStore((s) => s.setTimelinePosition);
  const enterSketchMode = useCadStore((s) => s.enterSketchMode);
  const updateOp = useCadStore((s) => s.updateOp);
  const deleteOp = useCadStore((s) => s.deleteOp);
  const rebuild = useCadStore((s) => s.rebuild);

  // Context menu state
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    op: null,
  });

  // Rollback bar drag state
  const [isDragging, setIsDragging] = React.useState(false);
  const timelineRef = React.useRef<HTMLDivElement>(null);
  const opItemRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());

  const ops = React.useMemo(() => {
    if (!studio) return [];
    return studio.opOrder
      .map((id) => studio.opGraph.get(id)?.op)
      .filter((op): op is Op => op !== undefined);
  }, [studio]);

  // Filter operations that produce bodies
  const bodies = React.useMemo(() => {
    return ops.filter((op) => BODY_PRODUCING_OPS.has(op.type));
  }, [ops]);

  const currentIndex = timelinePosition ?? ops.length - 1;

  const handleOpClick = (opId: OpId) => {
    // Only select - don't change timeline/rollback position
    setOpSelection(new Set([opId]));
  };

  const handleBodyClick = (opId: OpId) => {
    // Only select - don't change timeline/rollback position
    setOpSelection(new Set([opId]));
  };

  const handleOpDoubleClick = (op: Op) => {
    // Double-click on sketch to enter sketch mode
    if (op.type === "sketch") {
      const sketchOp = op as SketchOp;
      console.log("[OpTimeline] Double-click to enter sketch mode:", sketchOp.sketchId);
      enterSketchMode(sketchOp.sketchId);
    } else {
      console.log("[OpTimeline] Double-click to edit:", op.id);
      // TODO: Open edit panel for non-sketch operations
    }
  };

  const handleContextMenu = (e: React.MouseEvent, op: Op) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      op,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, op: null });
  };

  const handleEnterSketchMode = () => {
    if (contextMenu.op?.type === "sketch") {
      const sketchOp = contextMenu.op as SketchOp;
      enterSketchMode(sketchOp.sketchId);
    }
    closeContextMenu();
  };

  const handleToggleSuppress = () => {
    if (contextMenu.op) {
      updateOp(contextMenu.op.id, { suppressed: !contextMenu.op.suppressed });
      // Trigger rebuild to update the 3D view
      rebuild();
    }
    closeContextMenu();
  };

  const handleDelete = () => {
    if (contextMenu.op) {
      deleteOp(contextMenu.op.id);
      // Trigger rebuild to update the 3D view
      rebuild();
    }
    closeContextMenu();
  };

  const handleRename = () => {
    if (contextMenu.op) {
      const newName = prompt("Enter new name:", contextMenu.op.name);
      if (newName && newName.trim() !== "") {
        updateOp(contextMenu.op.id, { name: newName.trim() });
      }
    }
    closeContextMenu();
  };

  const handleDuplicate = () => {
    // TODO: Implement duplicate operation
    // This would need to deep clone the operation and associated data
    closeContextMenu();
  };

  // Close context menu when clicking elsewhere
  React.useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        closeContextMenu();
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [contextMenu.visible]);

  // Rollback bar drag handlers
  const handleRollbackDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // Handle drag move and end
  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;

      const timelineRect = timelineRef.current.getBoundingClientRect();
      const mouseY = e.clientY - timelineRect.top + timelineRef.current.scrollTop;

      // Find which operation the mouse is closest to (after)
      // -1 means before all operations (rollback to nothing)
      let newPosition = ops.length - 1;

      for (let i = 0; i < ops.length; i++) {
        const opEl = opItemRefs.current.get(i);
        if (opEl) {
          const opRect = opEl.getBoundingClientRect();
          const opTop = opRect.top - timelineRect.top + timelineRef.current.scrollTop;
          const opMid = opTop + opRect.height / 2;

          if (mouseY < opMid) {
            newPosition = i - 1; // Can be -1 if before first op
            break;
          }
          newPosition = i;
        }
      }

      setTimelinePosition(newPosition);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, ops.length, setTimelinePosition]);

  if (!studio) {
    return (
      <div style={{ ...styles.container, padding: 16 }}>
        <div style={styles.emptyState}>No part studio loaded</div>
      </div>
    );
  }

  // Build timeline items with rollback bar inserted
  const renderTimelineItems = () => {
    const items: React.ReactNode[] = [];

    // If position is -1, show bar at top (before all operations)
    if (currentIndex === -1) {
      items.push(
        <RollbackBar
          key="rollback-bar"
          position={currentIndex}
          total={ops.length}
          onDragStart={handleRollbackDragStart}
          isDragging={isDragging}
        />
      );
    }

    ops.forEach((op, index) => {
      // Add op item
      items.push(
        <div
          key={op.id}
          ref={(el) => {
            if (el) opItemRefs.current.set(index, el);
            else opItemRefs.current.delete(index);
          }}
        >
          <OpItem
            op={op}
            index={index}
            isSelected={opSelection.has(op.id)}
            isSuppressedByRollback={index > currentIndex}
            onClick={() => handleOpClick(op.id)}
            onDoubleClick={() => handleOpDoubleClick(op)}
            onContextMenu={(e) => handleContextMenu(e, op)}
          />
        </div>
      );

      // Add rollback bar after the current position (if not -1)
      if (index === currentIndex && currentIndex >= 0) {
        items.push(
          <RollbackBar
            key="rollback-bar"
            position={currentIndex}
            total={ops.length}
            onDragStart={handleRollbackDragStart}
            isDragging={isDragging}
          />
        );
      }
    });

    return items;
  };

  return (
    <div style={styles.container}>
      <div style={styles.timeline} ref={timelineRef}>
        {ops.length === 0 ? (
          <div style={styles.emptyState}>
            No operations yet.
            <br />
            <br />
            Start by creating a sketch or adding a primitive.
          </div>
        ) : (
          renderTimelineItems()
        )}
      </div>

      {/* Bodies section */}
      {bodies.length > 0 && (
        <div style={styles.bodiesSection}>
          <div style={styles.bodiesSectionHeader}>
            Bodies ({bodies.length})
          </div>
          {bodies.map((body) => (
            <BodyItem
              key={body.id}
              op={body}
              isSelected={opSelection.has(body.id)}
              onClick={() => handleBodyClick(body.id)}
            />
          ))}
        </div>
      )}

      {/* Context Menu - rendered via portal to escape sidebar's stacking context */}
      {contextMenu.visible && contextMenu.op && createPortal(
        <div
          style={{
            ...styles.contextMenu,
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.op.type === "sketch" && (
            <ContextMenuItem
              label="Edit Sketch"
              icon="✎"
              onClick={handleEnterSketchMode}
            />
          )}
          <ContextMenuItem
            label="Rename"
            icon="✏"
            onClick={handleRename}
          />
          <ContextMenuItem
            label={contextMenu.op.suppressed ? "Unsuppress" : "Suppress"}
            icon={contextMenu.op.suppressed ? "✓" : "○"}
            onClick={handleToggleSuppress}
          />
          <div style={{ height: 1, backgroundColor: "#444", margin: "4px 0" }} />
          <ContextMenuItem
            label="Delete"
            icon="×"
            onClick={handleDelete}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

/**
 * OpTimeline - standalone wrapper (kept for backwards compatibility).
 * @deprecated Use LeftSidebar instead for the tabbed interface.
 */
export function OpTimeline() {
  return <OpTimelineContent />;
}

export default OpTimeline;
