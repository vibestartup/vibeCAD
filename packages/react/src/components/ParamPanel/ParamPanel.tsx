/**
 * Parameter Panel - displays and edits global parameters.
 */

import React, { useState } from "react";
import type { ParamId, Parameter } from "@vibecad/core";
import { useParams, useDocumentContext } from "../../context";
import { useParamOperations, useParamError } from "../../hooks";

// ============================================================================
// Props
// ============================================================================

interface ParamPanelProps {
  /** Called when a parameter is selected */
  onSelect?: (paramId: ParamId) => void;
}

// ============================================================================
// Parameter Row
// ============================================================================

interface ParamRowProps {
  param: Parameter;
  error?: string;
  onUpdate: (expression: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

function ParamRow({ param, error, onUpdate, onRename, onDelete }: ParamRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(param.expression);

  const handleSubmit = () => {
    onUpdate(editValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      setEditValue(param.expression);
      setIsEditing(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "8px 12px",
        borderBottom: "1px solid #333",
        gap: 8,
      }}
    >
      {/* Name */}
      <span
        style={{
          width: 80,
          fontWeight: 500,
          color: error ? "#ff6b6b" : "#fff",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={param.name}
      >
        {param.name}
      </span>

      {/* Expression/Value */}
      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            flex: 1,
            padding: "4px 8px",
            border: "1px solid #646cff",
            borderRadius: 4,
            backgroundColor: "#2d2d4a",
            color: "#fff",
            fontSize: 13,
            outline: "none",
          }}
        />
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          style={{
            flex: 1,
            padding: "4px 8px",
            borderRadius: 4,
            backgroundColor: "#2d2d4a",
            cursor: "pointer",
            color: "#aaa",
            fontSize: 13,
          }}
        >
          {param.expression}
        </span>
      )}

      {/* Evaluated value */}
      <span
        style={{
          width: 60,
          textAlign: "right",
          color: "#888",
          fontSize: 12,
          fontFamily: "monospace",
        }}
      >
        = {param.value.toFixed(2)}
      </span>

      {/* Unit */}
      {param.unit && (
        <span style={{ color: "#666", fontSize: 11 }}>{param.unit}</span>
      )}

      {/* Delete button */}
      <button
        onClick={onDelete}
        style={{
          background: "none",
          border: "none",
          color: "#666",
          cursor: "pointer",
          padding: 4,
        }}
        title="Delete parameter"
      >
        🗑️
      </button>

      {/* Error indicator */}
      {error && (
        <span title={error} style={{ color: "#ff6b6b" }}>
          ⚠️
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function ParamPanel({ onSelect }: ParamPanelProps) {
  const paramEnv = useParams();
  const { addParameter, updateExpression, updateName, removeParameter } =
    useParamOperations();
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");

  const params = Array.from(paramEnv.params.values());

  const handleAdd = () => {
    if (!newName.trim()) return;

    const value = parseFloat(newValue) || 0;
    addParameter(newName.trim(), value);
    setNewName("");
    setNewValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAdd();
    }
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
        Parameters
      </div>

      {/* Parameter list */}
      <div>
        {params.length === 0 ? (
          <div style={{ padding: "16px", color: "#666", textAlign: "center" }}>
            No parameters defined
          </div>
        ) : (
          params.map((param) => (
            <ParamRow
              key={param.id}
              param={param}
              error={paramEnv.errors.get(param.id)}
              onUpdate={(expr) => updateExpression(param.id, expr)}
              onRename={(name) => updateName(param.id, name)}
              onDelete={() => removeParameter(param.id)}
            />
          ))
        )}
      </div>

      {/* Add new parameter */}
      <div
        style={{
          padding: "12px",
          borderTop: "1px solid #333",
          display: "flex",
          gap: 8,
        }}
      >
        <input
          type="text"
          placeholder="Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            padding: "6px 10px",
            border: "1px solid #333",
            borderRadius: 4,
            backgroundColor: "#2d2d4a",
            color: "#fff",
            fontSize: 13,
            outline: "none",
          }}
        />
        <input
          type="text"
          placeholder="Value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            width: 80,
            padding: "6px 10px",
            border: "1px solid #333",
            borderRadius: 4,
            backgroundColor: "#2d2d4a",
            color: "#fff",
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          style={{
            padding: "6px 12px",
            border: "none",
            borderRadius: 4,
            backgroundColor: newName.trim() ? "#646cff" : "#333",
            color: "#fff",
            cursor: newName.trim() ? "pointer" : "not-allowed",
            fontSize: 13,
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default ParamPanel;
