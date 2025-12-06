/**
 * Feature Tree - displays the operation hierarchy.
 */

import React from "react";
import type { Op, OpId } from "@vibecad/core";
import { useActiveStudio, useSelection, useDocumentContext } from "../../context";

// ============================================================================
// Props
// ============================================================================

interface FeatureTreeProps {
  /** Called when an operation is selected */
  onSelect?: (opId: OpId) => void;
  /** Called when an operation is double-clicked (edit) */
  onEdit?: (opId: OpId) => void;
  /** Called when suppress is toggled */
  onToggleSuppress?: (opId: OpId) => void;
}

// ============================================================================
// Operation Icon
// ============================================================================

function getOpIcon(type: Op["type"]): string {
  switch (type) {
    case "sketch":
      return "📐";
    case "extrude":
      return "⬆️";
    case "revolve":
      return "🔄";
    case "sweep":
      return "➰";
    case "loft":
      return "🎢";
    case "boolean":
      return "🔗";
    case "fillet":
      return "⭕";
    case "chamfer":
      return "📐";
    case "shell":
      return "📦";
    case "pattern":
      return "🔲";
    case "mirror":
      return "🪞";
    default:
      return "⚙️";
  }
}

// ============================================================================
// Component
// ============================================================================

export function FeatureTree({
  onSelect,
  onEdit,
  onToggleSuppress,
}: FeatureTreeProps) {
  const studio = useActiveStudio();
  const selection = useSelection();
  const { setSelection } = useDocumentContext();

  if (!studio) {
    return (
      <div style={{ padding: 16, color: "#666", fontFamily: "system-ui" }}>
        No part studio selected
      </div>
    );
  }

  const operations = studio.opOrder
    .map((id) => studio.opGraph.get(id)?.op)
    .filter((op): op is Op => op !== undefined);

  const handleClick = (opId: OpId) => {
    setSelection(new Set([opId]));
    onSelect?.(opId);
  };

  const handleDoubleClick = (opId: OpId) => {
    onEdit?.(opId);
  };

  const handleSuppress = (e: React.MouseEvent, opId: OpId) => {
    e.stopPropagation();
    onToggleSuppress?.(opId);
  };

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
        backgroundColor: "#1a1a2e",
        color: "#e0e0e0",
        height: "100%",
        overflow: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #333",
          fontWeight: 600,
          color: "#fff",
        }}
      >
        {studio.name}
      </div>

      {/* Operation list */}
      <div style={{ padding: "8px 0" }}>
        {operations.length === 0 ? (
          <div style={{ padding: "16px", color: "#666", textAlign: "center" }}>
            No operations yet
          </div>
        ) : (
          operations.map((op) => {
            const isSelected = selection.has(op.id);
            const hasError = studio.rebuildErrors?.has(op.id);

            return (
              <div
                key={op.id}
                onClick={() => handleClick(op.id)}
                onDoubleClick={() => handleDoubleClick(op.id)}
                style={{
                  padding: "8px 16px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: isSelected ? "#2d2d4a" : "transparent",
                  opacity: op.suppressed ? 0.5 : 1,
                  borderLeft: isSelected ? "3px solid #646cff" : "3px solid transparent",
                }}
              >
                {/* Icon */}
                <span style={{ fontSize: 16 }}>{getOpIcon(op.type)}</span>

                {/* Name */}
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: op.suppressed ? "line-through" : "none",
                    color: hasError ? "#ff6b6b" : undefined,
                  }}
                >
                  {op.name}
                </span>

                {/* Error indicator */}
                {hasError && (
                  <span title={studio.rebuildErrors?.get(op.id)} style={{ color: "#ff6b6b" }}>
                    ⚠️
                  </span>
                )}

                {/* Suppress button */}
                <button
                  onClick={(e) => handleSuppress(e, op.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                    color: "#666",
                    fontSize: 12,
                  }}
                  title={op.suppressed ? "Unsuppress" : "Suppress"}
                >
                  {op.suppressed ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default FeatureTree;
