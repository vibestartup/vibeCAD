/**
 * OpTimeline - left sidebar showing the operation stack as a timeline.
 * Users can click on any operation to "rewind" to that point.
 */

import React from "react";
import { useCadStore } from "../store";
import type { Op, OpId } from "@vibecad/core";

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
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: "#1a1a2e",
  } as React.CSSProperties,

  header: {
    padding: "12px 16px",
    borderBottom: "1px solid #333",
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
    padding: "8px 0",
  } as React.CSSProperties,

  opItem: {
    display: "flex",
    alignItems: "center",
    padding: "8px 16px",
    cursor: "pointer",
    transition: "background-color 0.15s, border-left-color 0.15s",
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderLeftColor: "transparent",
  } as React.CSSProperties,

  opItemSelected: {
    backgroundColor: "#2d2d4a",
    borderLeftColor: "#646cff",
  } as React.CSSProperties,

  opItemCurrent: {
    backgroundColor: "#1e3a5f",
    borderLeftColor: "#4dabf7",
  } as React.CSSProperties,

  opItemSuppressed: {
    opacity: 0.4,
  } as React.CSSProperties,

  opItemHover: {
    backgroundColor: "#252545",
  } as React.CSSProperties,

  opIcon: {
    width: 28,
    height: 28,
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    marginRight: 10,
    flexShrink: 0,
  } as React.CSSProperties,

  opInfo: {
    flex: 1,
    overflow: "hidden",
  } as React.CSSProperties,

  opName: {
    fontSize: 13,
    color: "#fff",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,

  opType: {
    fontSize: 11,
    color: "#888",
    marginTop: 2,
  } as React.CSSProperties,

  opIndex: {
    fontSize: 10,
    color: "#555",
    width: 20,
    textAlign: "right",
    marginRight: 8,
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

  rollbackSlider: {
    padding: "8px 16px",
    borderTop: "1px solid #333",
  } as React.CSSProperties,

  slider: {
    width: "100%",
    accentColor: "#646cff",
  } as React.CSSProperties,

  sliderLabel: {
    fontSize: 11,
    color: "#888",
    marginBottom: 4,
  } as React.CSSProperties,
};

interface OpItemProps {
  op: Op;
  index: number;
  isSelected: boolean;
  isCurrent: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

function OpItem({ op, index, isSelected, isCurrent, onClick, onDoubleClick }: OpItemProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const icon = OP_ICONS[op.type] || "?";
  const color = OP_COLORS[op.type] || "#888";

  return (
    <div
      style={{
        ...styles.opItem,
        ...(isSelected ? styles.opItemSelected : {}),
        ...(isCurrent ? styles.opItemCurrent : {}),
        ...(op.suppressed ? styles.opItemSuppressed : {}),
        ...(isHovered && !isSelected && !isCurrent ? styles.opItemHover : {}),
        position: "relative",
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span style={styles.opIndex}>{index + 1}</span>
      <div
        style={{
          ...styles.opIcon,
          backgroundColor: `${color}22`,
          color: color,
        }}
      >
        {icon}
      </div>
      <div style={styles.opInfo}>
        <div style={styles.opName}>{op.name}</div>
        <div style={styles.opType}>
          {op.type}
          {op.suppressed && " (suppressed)"}
        </div>
      </div>
    </div>
  );
}

export function OpTimeline() {
  const activeStudioId = useCadStore((s) => s.activeStudioId);
  const studio = useCadStore((s) =>
    s.activeStudioId ? s.document.partStudios.get(s.activeStudioId) : null
  );
  const selection = useCadStore((s) => s.selection);
  const setSelection = useCadStore((s) => s.setSelection);
  const timelinePosition = useCadStore((s) => s.timelinePosition);
  const setTimelinePosition = useCadStore((s) => s.setTimelinePosition);

  const ops = React.useMemo(() => {
    if (!studio) return [];
    return studio.opOrder
      .map((id) => studio.opGraph.get(id)?.op)
      .filter((op): op is Op => op !== undefined);
  }, [studio]);

  const currentIndex = timelinePosition ?? ops.length - 1;

  const handleOpClick = (opId: OpId, index: number) => {
    setSelection(new Set([opId]));
    setTimelinePosition(index);
  };

  const handleOpDoubleClick = (opId: OpId) => {
    // Double-click to edit operation
    console.log("Edit operation:", opId);
    // TODO: Open edit panel
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setTimelinePosition(value);
    if (ops[value]) {
      setSelection(new Set([ops[value].id]));
    }
  };

  if (!activeStudioId || !studio) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Operations</div>
        <div style={styles.emptyState}>No part studio selected</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>Operations</span>
        <button style={styles.addButton} title="Add Operation">
          +
        </button>
      </div>

      <div style={styles.timeline}>
        {ops.length === 0 ? (
          <div style={styles.emptyState}>
            No operations yet.
            <br />
            <br />
            Start by creating a sketch or adding a primitive.
          </div>
        ) : (
          ops.map((op, index) => (
            <OpItem
              key={op.id}
              op={op}
              index={index}
              isSelected={selection.has(op.id)}
              isCurrent={index === currentIndex}
              onClick={() => handleOpClick(op.id, index)}
              onDoubleClick={() => handleOpDoubleClick(op.id)}
            />
          ))
        )}
      </div>

      {ops.length > 0 && (
        <div style={styles.rollbackSlider}>
          <div style={styles.sliderLabel}>
            Timeline: {currentIndex + 1} / {ops.length}
          </div>
          <input
            type="range"
            min={0}
            max={ops.length - 1}
            value={currentIndex}
            onChange={handleSliderChange}
            style={styles.slider}
          />
        </div>
      )}
    </div>
  );
}

export default OpTimeline;
