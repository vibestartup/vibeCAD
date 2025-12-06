/**
 * PropertiesPanel - right sidebar for editing operation details and parameters.
 */

import React from "react";
import { useCadStore } from "../store";
import type { Op, Parameter, ParamId } from "@vibecad/core";

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
  } as React.CSSProperties,

  tabs: {
    display: "flex",
    borderBottom: "1px solid #333",
  } as React.CSSProperties,

  tab: {
    flex: 1,
    padding: "10px 12px",
    border: "none",
    backgroundColor: "transparent",
    color: "#888",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
    borderBottom: "2px solid transparent",
    transition: "color 0.15s, border-color 0.15s",
  } as React.CSSProperties,

  tabActive: {
    color: "#fff",
    borderBottomColor: "#646cff",
  } as React.CSSProperties,

  content: {
    flex: 1,
    overflowY: "auto",
    padding: 16,
  } as React.CSSProperties,

  section: {
    marginBottom: 20,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 12,
  } as React.CSSProperties,

  field: {
    marginBottom: 12,
  } as React.CSSProperties,

  fieldLabel: {
    fontSize: 12,
    color: "#aaa",
    marginBottom: 4,
    display: "block",
  } as React.CSSProperties,

  input: {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #333",
    borderRadius: 4,
    backgroundColor: "#252545",
    color: "#fff",
    fontSize: 13,
    outline: "none",
  } as React.CSSProperties,

  inputFocus: {
    borderColor: "#646cff",
  } as React.CSSProperties,

  select: {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #333",
    borderRadius: 4,
    backgroundColor: "#252545",
    color: "#fff",
    fontSize: 13,
    cursor: "pointer",
    outline: "none",
  } as React.CSSProperties,

  checkbox: {
    marginRight: 8,
    accentColor: "#646cff",
  } as React.CSSProperties,

  checkboxLabel: {
    fontSize: 13,
    color: "#aaa",
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
  } as React.CSSProperties,

  paramRow: {
    display: "flex",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #2d2d4a",
  } as React.CSSProperties,

  paramName: {
    flex: 1,
    fontSize: 13,
    color: "#fff",
  } as React.CSSProperties,

  paramValue: {
    width: 80,
    textAlign: "right",
    padding: "4px 8px",
    border: "1px solid #333",
    borderRadius: 4,
    backgroundColor: "#252545",
    color: "#4dabf7",
    fontSize: 12,
    fontFamily: "monospace",
  } as React.CSSProperties,

  paramUnit: {
    marginLeft: 4,
    fontSize: 11,
    color: "#666",
    width: 24,
  } as React.CSSProperties,

  addButton: {
    width: "100%",
    padding: "8px 12px",
    border: "1px dashed #444",
    borderRadius: 4,
    backgroundColor: "transparent",
    color: "#888",
    cursor: "pointer",
    fontSize: 12,
    marginTop: 8,
    transition: "border-color 0.15s, color 0.15s",
  } as React.CSSProperties,

  emptyState: {
    padding: 24,
    textAlign: "center",
    color: "#666",
    fontSize: 12,
  } as React.CSSProperties,

  deleteButton: {
    padding: "6px 12px",
    border: "1px solid #ff6b6b",
    borderRadius: 4,
    backgroundColor: "transparent",
    color: "#ff6b6b",
    cursor: "pointer",
    fontSize: 12,
    width: "100%",
  } as React.CSSProperties,
};

type TabId = "properties" | "parameters";

// ============================================================================
// Operation Properties Tab
// ============================================================================

interface OpPropertiesProps {
  op: Op;
}

function OpProperties({ op }: OpPropertiesProps) {
  const updateOp = useCadStore((s) => s.updateOp);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateOp(op.id, { name: e.target.value });
  };

  const handleSuppressedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateOp(op.id, { suppressed: e.target.checked });
  };

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>General</div>

        <div style={styles.field}>
          <label style={styles.fieldLabel}>Name</label>
          <input
            type="text"
            value={op.name}
            onChange={handleNameChange}
            style={styles.input}
          />
        </div>

        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={op.suppressed}
            onChange={handleSuppressedChange}
            style={styles.checkbox}
          />
          Suppressed
        </label>
      </div>

      {/* Type-specific properties */}
      {op.type === "extrude" && <ExtrudeProperties op={op} />}
      {op.type === "fillet" && <FilletProperties op={op} />}
      {op.type === "boolean" && <BooleanProperties op={op} />}

      <div style={styles.section}>
        <button style={styles.deleteButton}>Delete Operation</button>
      </div>
    </div>
  );
}

function ExtrudeProperties({ op }: { op: any }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Extrude Settings</div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Direction</label>
        <select style={styles.select} value={op.direction}>
          <option value="normal">Normal</option>
          <option value="reverse">Reverse</option>
          <option value="symmetric">Symmetric</option>
        </select>
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Depth</label>
        <input
          type="text"
          value={op.depth?.expression || op.depth?.value || ""}
          style={styles.input}
          placeholder="e.g., 10 or Height * 2"
        />
      </div>
    </div>
  );
}

function FilletProperties({ op }: { op: any }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Fillet Settings</div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Radius</label>
        <input
          type="text"
          value={op.radius?.expression || op.radius?.value || ""}
          style={styles.input}
          placeholder="e.g., 2"
        />
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Edges</label>
        <div style={{ color: "#888", fontSize: 12 }}>
          {op.edges?.length || 0} edges selected
        </div>
      </div>
    </div>
  );
}

function BooleanProperties({ op }: { op: any }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Boolean Settings</div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Operation</label>
        <select style={styles.select} value={op.operation}>
          <option value="union">Union</option>
          <option value="subtract">Subtract</option>
          <option value="intersect">Intersect</option>
        </select>
      </div>
    </div>
  );
}

// ============================================================================
// Parameters Tab
// ============================================================================

function ParametersTab() {
  const params = useCadStore((s) => s.document.params);
  const addParam = useCadStore((s) => s.addParam);
  const updateParam = useCadStore((s) => s.updateParam);
  const removeParam = useCadStore((s) => s.removeParam);

  const paramList = React.useMemo(
    () => Array.from(params.params.values()),
    [params]
  );

  const handleAddParam = () => {
    const name = `Param${paramList.length + 1}`;
    addParam(name, 10);
  };

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Global Parameters</div>

        {paramList.length === 0 ? (
          <div style={styles.emptyState}>
            No parameters defined.
            <br />
            Parameters allow you to drive dimensions with expressions.
          </div>
        ) : (
          paramList.map((param) => (
            <ParameterRow
              key={param.id}
              param={param}
              onUpdate={(updates) => updateParam(param.id, updates)}
              onDelete={() => removeParam(param.id)}
            />
          ))
        )}

        <button style={styles.addButton} onClick={handleAddParam}>
          + Add Parameter
        </button>
      </div>
    </div>
  );
}

interface ParameterRowProps {
  param: Parameter;
  onUpdate: (updates: Partial<Parameter>) => void;
  onDelete: () => void;
}

function ParameterRow({ param, onUpdate, onDelete }: ParameterRowProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(param.expression);

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== param.expression) {
      onUpdate({ expression: editValue });
    }
  };

  return (
    <div style={styles.paramRow}>
      <input
        type="text"
        value={param.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        style={{
          ...styles.paramName,
          backgroundColor: "transparent",
          border: "none",
          padding: 0,
        }}
      />
      <input
        type="text"
        value={isEditing ? editValue : param.expression}
        onChange={(e) => setEditValue(e.target.value)}
        onFocus={() => {
          setIsEditing(true);
          setEditValue(param.expression);
        }}
        onBlur={handleBlur}
        style={styles.paramValue as React.CSSProperties}
      />
      <span style={styles.paramUnit}>{param.unit || ""}</span>
    </div>
  );
}

// ============================================================================
// Main Panel
// ============================================================================

export function PropertiesPanel() {
  const [activeTab, setActiveTab] = React.useState<TabId>("properties");
  const selection = useCadStore((s) => s.selection);
  const studio = useCadStore((s) =>
    s.activeStudioId ? s.document.partStudios.get(s.activeStudioId) : null
  );

  // Get selected operation
  const selectedOp = React.useMemo(() => {
    if (selection.size !== 1 || !studio) return null;
    const opId = Array.from(selection)[0];
    return studio.opGraph.get(opId as any)?.op ?? null;
  }, [selection, studio]);

  return (
    <div style={styles.container}>
      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === "properties" ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab("properties")}
        >
          Properties
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === "parameters" ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab("parameters")}
        >
          Parameters
        </button>
      </div>

      <div style={styles.content}>
        {activeTab === "properties" ? (
          selectedOp ? (
            <OpProperties op={selectedOp} />
          ) : (
            <div style={styles.emptyState}>
              Select an operation to view its properties.
            </div>
          )
        ) : (
          <ParametersTab />
        )}
      </div>
    </div>
  );
}

export default PropertiesPanel;
