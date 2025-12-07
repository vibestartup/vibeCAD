/**
 * PropertiesPanel - right sidebar for editing operation details and parameters.
 */

import React from "react";
import { useCadStore } from "../store";
import { useSettingsStore } from "../store/settings-store";
import { useTabsStore, createImageTabFromFile } from "../store/tabs-store";
import { getLengthUnitLabel, getAngleUnitLabel } from "../utils/units";
import {
  captureViewport,
  downloadCapture,
  formatFileSize,
  getDataUrlSize,
  RESOLUTION_PRESETS,
  BACKGROUND_PRESETS,
  type CaptureResult,
} from "../utils/viewport-capture";
import type { Op, Parameter, ParamId, SketchId } from "@vibecad/core";

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
    borderBottomWidth: 2,
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
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

  // Face selector styles
  faceSelector: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  } as React.CSSProperties,

  faceSelectorButton: {
    flex: 1,
    padding: "8px 12px",
    border: "1px solid #444",
    borderRadius: 4,
    backgroundColor: "#252545",
    color: "#aaa",
    cursor: "pointer",
    fontSize: 12,
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: 8,
    transition: "border-color 0.15s, background-color 0.15s",
  } as React.CSSProperties,

  faceSelectorButtonListening: {
    borderColor: "#da77f2",
    backgroundColor: "#3a2a4a",
    color: "#fff",
  } as React.CSSProperties,

  faceSelectorButtonSelected: {
    borderColor: "#69db7c",
    color: "#69db7c",
  } as React.CSSProperties,

  faceSelectorIcon: {
    width: 16,
    height: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,

  // Pending extrude panel styles
  pendingPanel: {
    backgroundColor: "#252545",
    border: "1px solid #646cff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  } as React.CSSProperties,

  pendingPanelTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    gap: 8,
  } as React.CSSProperties,

  buttonRow: {
    display: "flex",
    gap: 8,
    marginTop: 16,
  } as React.CSSProperties,

  primaryButton: {
    flex: 1,
    padding: "8px 16px",
    border: "none",
    borderRadius: 4,
    backgroundColor: "#646cff",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  } as React.CSSProperties,

  primaryButtonDisabled: {
    backgroundColor: "#444",
    cursor: "not-allowed",
    opacity: 0.6,
  } as React.CSSProperties,

  secondaryButton: {
    flex: 1,
    padding: "8px 16px",
    border: "1px solid #444",
    borderRadius: 4,
    backgroundColor: "transparent",
    color: "#aaa",
    cursor: "pointer",
    fontSize: 12,
  } as React.CSSProperties,
};

type TabId = "properties" | "parameters" | "render";

// ============================================================================
// Face/Sketch Selector Component
// ============================================================================

interface FaceSelectorProps {
  label: string;
  value: string | null;
  targetType: "extrude-profile" | "extrude-face" | "sketch-plane";
  onClear?: () => void;
}

function FaceSelector({ label, value, targetType, onClear }: FaceSelectorProps) {
  const faceSelectionTarget = useCadStore((s) => s.faceSelectionTarget);
  const enterFaceSelectionMode = useCadStore((s) => s.enterFaceSelectionMode);
  const exitFaceSelectionMode = useCadStore((s) => s.exitFaceSelectionMode);
  const studio = useCadStore((s) =>
    s.activeStudioId ? s.document.partStudios.get(s.activeStudioId) : null
  );

  const isListening = faceSelectionTarget?.type === targetType;

  // Get display name for selected sketch
  const displayName = React.useMemo(() => {
    if (!value || !studio) return null;
    const sketch = studio.sketches.get(value as SketchId);
    if (sketch) {
      // Find the op that references this sketch
      for (const [, node] of studio.opGraph) {
        if (node.op.type === "sketch" && (node.op as any).sketchId === value) {
          return node.op.name;
        }
      }
      return `Sketch ${value.slice(0, 8)}`;
    }
    return null;
  }, [value, studio]);

  const handleClick = () => {
    if (isListening) {
      exitFaceSelectionMode();
    } else {
      enterFaceSelectionMode({ type: targetType });
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) onClear();
  };

  return (
    <div style={styles.field}>
      <label style={styles.fieldLabel}>{label}</label>
      <div style={styles.faceSelector}>
        <button
          style={{
            ...styles.faceSelectorButton,
            ...(isListening ? styles.faceSelectorButtonListening : {}),
            ...(value && !isListening ? styles.faceSelectorButtonSelected : {}),
          }}
          onClick={handleClick}
        >
          <span style={styles.faceSelectorIcon}>
            {isListening ? "◉" : value ? "✓" : "◎"}
          </span>
          <span style={{ flex: 1 }}>
            {isListening
              ? "Click a sketch in viewport..."
              : value && displayName
              ? displayName
              : "Select sketch profile"}
          </span>
          {value && !isListening && onClear && (
            <span
              onClick={handleClear}
              style={{ opacity: 0.6, cursor: "pointer" }}
            >
              ×
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Plane Selector Component (for editing sketch plane)
// ============================================================================

interface PlaneSelectorProps {
  opId: string;
  sketchId: string;
  currentPlaneId: string;
}

function PlaneSelector({ opId, sketchId, currentPlaneId }: PlaneSelectorProps) {
  const faceSelectionTarget = useCadStore((s) => s.faceSelectionTarget);
  const enterFaceSelectionMode = useCadStore((s) => s.enterFaceSelectionMode);
  const exitFaceSelectionMode = useCadStore((s) => s.exitFaceSelectionMode);

  const isListening =
    faceSelectionTarget?.type === "edit-sketch-plane" &&
    faceSelectionTarget.opId === opId;

  // Get display name for the plane
  const planeDisplayName = React.useMemo(() => {
    if (currentPlaneId === "datum_xy") return "XY Plane";
    if (currentPlaneId === "datum_xz") return "XZ Plane";
    if (currentPlaneId === "datum_yz") return "YZ Plane";
    return `Plane ${currentPlaneId.slice(0, 8)}`;
  }, [currentPlaneId]);

  const handleClick = () => {
    if (isListening) {
      exitFaceSelectionMode();
    } else {
      enterFaceSelectionMode({ type: "edit-sketch-plane", opId, sketchId });
    }
  };

  return (
    <div style={styles.field}>
      <label style={styles.fieldLabel}>Sketch Plane</label>
      <div style={styles.faceSelector}>
        <button
          style={{
            ...styles.faceSelectorButton,
            ...(isListening ? styles.faceSelectorButtonListening : {}),
            ...(!isListening ? styles.faceSelectorButtonSelected : {}),
          }}
          onClick={handleClick}
        >
          <span style={styles.faceSelectorIcon}>
            {isListening ? "◉" : "✓"}
          </span>
          <span style={{ flex: 1 }}>
            {isListening
              ? "Click a plane in viewport..."
              : planeDisplayName}
          </span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Sketch Properties Component
// ============================================================================

function SketchProperties({ op }: { op: any }) {
  const studio = useCadStore((s) =>
    s.activeStudioId ? s.document.partStudios.get(s.activeStudioId) : null
  );

  // Get the sketch from the op
  const sketch = React.useMemo(() => {
    if (!studio || !op.sketchId) return null;
    return studio.sketches.get(op.sketchId as SketchId) ?? null;
  }, [studio, op.sketchId]);

  // Get plane info
  const currentPlaneId = sketch?.planeId ?? op.planeRef ?? "datum_xy";

  // Count entities
  const entityCount = React.useMemo(() => {
    if (!sketch) return { points: 0, lines: 0, circles: 0, arcs: 0 };
    let points = 0, lines = 0, circles = 0, arcs = 0;
    for (const [, prim] of sketch.primitives) {
      if (prim.type === "point") points++;
      else if (prim.type === "line") lines++;
      else if (prim.type === "circle") circles++;
      else if (prim.type === "arc") arcs++;
    }
    return { points, lines, circles, arcs };
  }, [sketch]);

  const constraintCount = sketch?.constraints?.size ?? 0;

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Sketch</div>

      <PlaneSelector
        opId={op.id}
        sketchId={op.sketchId}
        currentPlaneId={currentPlaneId}
      />

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Entities</label>
        <div style={{ fontSize: 12, color: "#aaa", paddingLeft: 4 }}>
          {entityCount.points > 0 && <div>{entityCount.points} points</div>}
          {entityCount.lines > 0 && <div>{entityCount.lines} lines</div>}
          {entityCount.circles > 0 && <div>{entityCount.circles} circles</div>}
          {entityCount.arcs > 0 && <div>{entityCount.arcs} arcs</div>}
          {entityCount.points === 0 && entityCount.lines === 0 && entityCount.circles === 0 && entityCount.arcs === 0 && (
            <div style={{ color: "#666" }}>No entities</div>
          )}
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Constraints</label>
        <div style={{ fontSize: 12, color: "#aaa", paddingLeft: 4 }}>
          {constraintCount} constraint{constraintCount !== 1 ? "s" : ""}
        </div>
      </div>

      {sketch?.solveStatus && (
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Solve Status</label>
          <div style={{
            fontSize: 12,
            paddingLeft: 4,
            color: sketch.solveStatus === "ok" ? "#69db7c" :
                   sketch.solveStatus === "under-constrained" ? "#ffd43b" : "#ff6b6b"
          }}>
            {sketch.solveStatus === "ok" ? "Fully Constrained" :
             sketch.solveStatus === "under-constrained" ? `Under-constrained (${sketch.dof ?? "?"} DOF)` :
             sketch.solveStatus}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Revolve Properties (unified for both pending and existing ops)
// ============================================================================

function RevolveProperties({ op, isPending = false }: { op?: any; isPending?: boolean }) {
  const updateOp = useCadStore((s) => s.updateOp);
  const pendingRevolve = useCadStore((s) => s.pendingRevolve);
  const setPendingRevolveSketch = useCadStore((s) => s.setPendingRevolveSketch);
  const setPendingRevolveAngle = useCadStore((s) => s.setPendingRevolveAngle);
  const setPendingRevolveAxis = useCadStore((s) => s.setPendingRevolveAxis);
  const confirmRevolve = useCadStore((s) => s.confirmRevolve);
  const cancelRevolve = useCadStore((s) => s.cancelRevolve);
  const studio = useCadStore((s) =>
    s.activeStudioId ? s.document.partStudios.get(s.activeStudioId) : null
  );

  // Determine if we're in pending mode or editing an existing op
  const isCreating = isPending && pendingRevolve;

  // Get current values from either pending state or existing op
  const currentSketchId = isCreating ? pendingRevolve?.sketchId : op?.profile?.sketchId;
  const currentAxis = isCreating ? (pendingRevolve?.axis ?? "sketch-y") : (op?.axis ?? "sketch-y");
  const currentAngle = isCreating ? (pendingRevolve?.angle ?? 360) : (op?.angle?.value ?? 360);

  // Track if we're editing the profile on an existing op
  const [isEditingProfile, setIsEditingProfile] = React.useState(false);

  const [angleValue, setAngleValue] = React.useState(currentAngle.toString());

  // Sync angle value when values change
  React.useEffect(() => {
    setAngleValue(currentAngle.toString());
  }, [currentAngle]);

  // Get profile display name
  const profileDisplayName = React.useMemo(() => {
    if (!studio || !currentSketchId) return null;
    const sketch = studio.sketches.get(currentSketchId as SketchId);
    if (sketch) {
      for (const [, node] of studio.opGraph) {
        if (node.op.type === "sketch" && (node.op as any).sketchId === currentSketchId) {
          return node.op.name;
        }
      }
      return `Sketch ${currentSketchId.slice(0, 8)}`;
    }
    return null;
  }, [currentSketchId, studio]);

  const handleAxisChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAxis = e.target.value as "x" | "y" | "sketch-x" | "sketch-y";
    if (isCreating) {
      setPendingRevolveAxis(newAxis);
    } else if (op) {
      updateOp(op.id, { axis: newAxis } as any);
    }
  };

  const handleAngleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAngleValue(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && num <= 360) {
      if (isCreating) {
        setPendingRevolveAngle(num);
      }
    }
  };

  const handleAngleBlur = () => {
    const num = parseFloat(angleValue);
    if (!isNaN(num) && num > 0 && num <= 360) {
      if (isCreating) {
        setPendingRevolveAngle(num);
      } else if (op) {
        updateOp(op.id, { angle: { value: num, expression: angleValue } });
      }
    }
  };

  const handleClearProfile = () => {
    if (isCreating) {
      setPendingRevolveSketch(null);
    } else if (op) {
      // For existing op, enter "editing profile" mode
      setIsEditingProfile(true);
    }
  };

  const handleConfirm = () => {
    const num = parseFloat(angleValue);
    if (!isNaN(num) && num > 0) {
      setPendingRevolveAngle(num);
    }
    confirmRevolve();
  };

  // Determine if we need to show the profile selector
  const hasProfile = !!currentSketchId;
  const showProfileSelector = isCreating ? !hasProfile : (isEditingProfile || !hasProfile);

  // Can confirm if we have a sketch selected
  const canConfirm = hasProfile && parseFloat(angleValue) > 0;

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Revolve</div>

      {/* Profile selector - show when no profile or editing profile */}
      {showProfileSelector ? (
        <FaceSelector
          label="Profile (Sketch)"
          value={currentSketchId}
          targetType="extrude-profile"
          onClear={handleClearProfile}
        />
      ) : (
        /* Show selected profile with X to clear */
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Profile</label>
          <div style={{
            ...styles.faceSelectorButton,
            ...styles.faceSelectorButtonSelected,
          }}>
            <span style={styles.faceSelectorIcon}>✓</span>
            <span style={{ flex: 1 }}>{profileDisplayName}</span>
            <span
              onClick={handleClearProfile}
              style={{ opacity: 0.6, cursor: "pointer", padding: "0 4px" }}
              title="Change profile"
            >
              ×
            </span>
          </div>
        </div>
      )}

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Axis</label>
        <select
          style={styles.select}
          value={currentAxis}
          onChange={handleAxisChange}
        >
          <option value="sketch-x">Sketch X Axis</option>
          <option value="sketch-y">Sketch Y Axis</option>
          <option value="x">World X Axis</option>
          <option value="y">World Y Axis</option>
        </select>
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Angle (degrees)</label>
        <input
          type="number"
          value={angleValue}
          onChange={handleAngleChange}
          onBlur={handleAngleBlur}
          style={styles.input}
          placeholder="e.g., 360"
          min={0}
          max={360}
          step={15}
        />
      </div>

      {/* Create/Cancel buttons only in creation mode */}
      {isCreating && (
        <div style={styles.buttonRow}>
          <button style={styles.secondaryButton} onClick={cancelRevolve}>
            Cancel
          </button>
          <button
            style={{
              ...styles.primaryButton,
              ...(canConfirm ? {} : styles.primaryButtonDisabled),
            }}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Create Revolve
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Fillet Properties (unified for both pending and existing ops)
// ============================================================================

function FilletProperties({ op, isPending = false }: { op?: any; isPending?: boolean }) {
  const updateOp = useCadStore((s) => s.updateOp);
  const pendingFillet = useCadStore((s) => s.pendingFillet);
  const setPendingFilletTarget = useCadStore((s) => s.setPendingFilletTarget);
  const setPendingFilletRadius = useCadStore((s) => s.setPendingFilletRadius);
  const confirmFillet = useCadStore((s) => s.confirmFillet);
  const cancelFillet = useCadStore((s) => s.cancelFillet);
  const studio = useCadStore((s) =>
    s.activeStudioId ? s.document.partStudios.get(s.activeStudioId) : null
  );
  const lengthUnit = useSettingsStore((s) => s.lengthUnit);
  const unitLabel = getLengthUnitLabel(lengthUnit);

  // Determine if we're in pending mode or editing an existing op
  const isCreating = isPending && pendingFillet;

  // Get current values from either pending state or existing op
  const currentTargetOpId = isCreating ? pendingFillet?.targetOpId : op?.targetOpId;
  const currentRadius = isCreating ? (pendingFillet?.radius ?? 5) : (op?.radius?.value ?? 5);

  const [radiusValue, setRadiusValue] = React.useState(currentRadius.toString());

  // Sync radius value when values change
  React.useEffect(() => {
    setRadiusValue(currentRadius.toString());
  }, [currentRadius]);

  // Get available operations that produce geometry
  const availableOps = React.useMemo(() => {
    if (!studio) return [];
    return Array.from(studio.opGraph.entries())
      .filter(([, node]) => node.op.type === "extrude" || node.op.type === "revolve")
      .map(([id, node]) => ({ id, name: node.op.name }));
  }, [studio]);

  // Get current target display name
  const targetDisplayName = React.useMemo(() => {
    if (!currentTargetOpId || !studio) return null;
    const targetOp = studio.opGraph.get(currentTargetOpId as any);
    return targetOp?.op.name ?? null;
  }, [currentTargetOpId, studio]);

  const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRadiusValue(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      if (isCreating) {
        setPendingFilletRadius(num);
      }
    }
  };

  const handleRadiusBlur = () => {
    const num = parseFloat(radiusValue);
    if (!isNaN(num) && num > 0) {
      if (isCreating) {
        setPendingFilletRadius(num);
      } else if (op) {
        updateOp(op.id, { radius: { value: num, expression: radiusValue } });
      }
    }
  };

  const handleTargetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTarget = e.target.value || null;
    if (isCreating) {
      setPendingFilletTarget(newTarget);
    } else if (op) {
      updateOp(op.id, { targetOpId: newTarget } as any);
    }
  };

  const handleConfirm = () => {
    const num = parseFloat(radiusValue);
    if (!isNaN(num) && num > 0) {
      setPendingFilletRadius(num);
    }
    confirmFillet();
  };

  // Can confirm if we have a target body selected and valid radius
  const canConfirm = currentTargetOpId && parseFloat(radiusValue) > 0;

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Fillet</div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Target Body</label>
        <select
          style={styles.select}
          value={currentTargetOpId || ""}
          onChange={handleTargetChange}
        >
          <option value="">Select a body...</option>
          {availableOps.map((opItem) => (
            <option key={opItem.id} value={opItem.id}>
              {opItem.name}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Radius ({unitLabel})</label>
        <input
          type="number"
          value={radiusValue}
          onChange={handleRadiusChange}
          onBlur={handleRadiusBlur}
          style={styles.input}
          placeholder="e.g., 5"
          min={0}
          step={1}
        />
      </div>

      <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>
        Note: Fillet will be applied to all edges of the selected body.
      </div>

      {/* Create/Cancel buttons only in creation mode */}
      {isCreating && (
        <div style={styles.buttonRow}>
          <button style={styles.secondaryButton} onClick={cancelFillet}>
            Cancel
          </button>
          <button
            style={{
              ...styles.primaryButton,
              ...(canConfirm ? {} : styles.primaryButtonDisabled),
            }}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Create Fillet
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Boolean Properties (unified for both pending and existing ops)
// ============================================================================

function BooleanProperties({ op, isPending = false }: { op?: any; isPending?: boolean }) {
  const updateOp = useCadStore((s) => s.updateOp);
  const pendingBoolean = useCadStore((s) => s.pendingBoolean);
  const setPendingBooleanTarget = useCadStore((s) => s.setPendingBooleanTarget);
  const setPendingBooleanTool = useCadStore((s) => s.setPendingBooleanTool);
  const confirmBoolean = useCadStore((s) => s.confirmBoolean);
  const cancelBoolean = useCadStore((s) => s.cancelBoolean);
  const studio = useCadStore((s) =>
    s.activeStudioId ? s.document.partStudios.get(s.activeStudioId) : null
  );

  // Determine if we're in pending mode or editing an existing op
  const isCreating = isPending && !!pendingBoolean;

  // Get current values from either pending state or existing op
  const currentTargetOpId = isCreating ? pendingBoolean?.targetOpId : op?.targetOpId;
  const currentToolOpId = isCreating ? pendingBoolean?.toolOpId : op?.toolOpId;
  const currentOperation = isCreating ? (pendingBoolean?.operation ?? "union") : (op?.operation ?? "union");

  // Get available operations that produce geometry
  const availableOps = React.useMemo(() => {
    if (!studio) return [];
    return Array.from(studio.opGraph.entries())
      .filter(([, node]) => node.op.type === "extrude" || node.op.type === "revolve")
      .map(([id, node]) => ({ id, name: node.op.name }));
  }, [studio]);

  const handleTargetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTarget = e.target.value || null;
    if (isCreating) {
      setPendingBooleanTarget(newTarget);
    } else if (op) {
      updateOp(op.id, { targetOpId: newTarget } as any);
    }
  };

  const handleToolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTool = e.target.value || null;
    if (isCreating) {
      setPendingBooleanTool(newTool);
    } else if (op) {
      updateOp(op.id, { toolOpId: newTool } as any);
    }
  };

  const handleOperationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOperation = e.target.value as "union" | "subtract" | "intersect";
    if (op && !isCreating) {
      updateOp(op.id, { operation: newOperation });
    }
    // Note: For pending, operation is fixed at creation time from toolbar
  };

  const handleConfirm = () => {
    confirmBoolean();
  };

  const opLabel =
    currentOperation === "union"
      ? "Union"
      : currentOperation === "subtract"
      ? "Subtract"
      : "Intersect";

  const opIcon =
    currentOperation === "union"
      ? "⊕"
      : currentOperation === "subtract"
      ? "⊖"
      : "⊗";

  const canConfirm = currentTargetOpId && currentToolOpId;

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{opLabel}</div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Operation</label>
        <select
          style={styles.select}
          value={currentOperation}
          onChange={handleOperationChange}
          disabled={isCreating} // Can't change operation type for pending
        >
          <option value="union">Union</option>
          <option value="subtract">Subtract</option>
          <option value="intersect">Intersect</option>
        </select>
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Target Body</label>
        <select
          style={styles.select}
          value={currentTargetOpId || ""}
          onChange={handleTargetChange}
        >
          <option value="">Select target body...</option>
          {availableOps.map((opItem) => (
            <option key={opItem.id} value={opItem.id}>
              {opItem.name}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Tool Body</label>
        <select
          style={styles.select}
          value={currentToolOpId || ""}
          onChange={handleToolChange}
        >
          <option value="">Select tool body...</option>
          {availableOps
            .filter((opItem) => opItem.id !== currentTargetOpId)
            .map((opItem) => (
              <option key={opItem.id} value={opItem.id}>
                {opItem.name}
              </option>
            ))}
        </select>
      </div>

      {/* Create/Cancel buttons only in creation mode */}
      {isCreating && (
        <div style={styles.buttonRow}>
          <button style={styles.secondaryButton} onClick={cancelBoolean}>
            Cancel
          </button>
          <button
            style={{
              ...styles.primaryButton,
              ...(canConfirm ? {} : styles.primaryButtonDisabled),
            }}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Create {opLabel}
          </button>
        </div>
      )}
    </div>
  );
}

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
      {op.type === "sketch" && <SketchProperties op={op} />}
      {op.type === "extrude" && <ExtrudeProperties op={op} />}
      {op.type === "revolve" && <RevolveProperties op={op} />}
      {op.type === "fillet" && <FilletProperties op={op} />}
      {op.type === "boolean" && <BooleanProperties op={op} />}

      <div style={styles.section}>
        <button style={styles.deleteButton}>Delete Operation</button>
      </div>
    </div>
  );
}

function ExtrudeProperties({ op, isPending = false }: { op?: any; isPending?: boolean }) {
  const updateOp = useCadStore((s) => s.updateOp);
  const pendingExtrude = useCadStore((s) => s.pendingExtrude);
  const setPendingExtrudeSketch = useCadStore((s) => s.setPendingExtrudeSketch);
  const setPendingExtrudeBodyFace = useCadStore((s) => s.setPendingExtrudeBodyFace);
  const setPendingExtrudeDepth = useCadStore((s) => s.setPendingExtrudeDepth);
  const setPendingExtrudeDirection = useCadStore((s) => s.setPendingExtrudeDirection);
  const confirmExtrude = useCadStore((s) => s.confirmExtrude);
  const cancelExtrude = useCadStore((s) => s.cancelExtrude);
  const studio = useCadStore((s) =>
    s.activeStudioId ? s.document.partStudios.get(s.activeStudioId) : null
  );
  const lengthUnit = useSettingsStore((s) => s.lengthUnit);
  const unitLabel = getLengthUnitLabel(lengthUnit);

  // Determine if we're in pending mode or editing an existing op
  const isCreating = isPending && pendingExtrude;

  // Get current values from either pending state or existing op
  const currentSketchId = isCreating ? pendingExtrude?.sketchId : op?.profile?.sketchId;
  const currentBodyFace = isCreating ? pendingExtrude?.bodyFace : (op?.profile?.type === "face" ? op.profile.faceRef : null);
  const currentDirection = isCreating ? (pendingExtrude?.direction ?? "normal") : (op?.direction ?? "normal");
  const currentDepth = isCreating ? (pendingExtrude?.depth ?? 10) : (op?.depth?.value ?? 10);

  // Track if we're editing the profile on an existing op
  const [isEditingProfile, setIsEditingProfile] = React.useState(false);

  const [depthValue, setDepthValue] = React.useState(currentDepth.toString());

  // Sync depth value when values change
  React.useEffect(() => {
    setDepthValue(currentDepth.toString());
  }, [currentDepth]);

  // Get profile display name
  const profileDisplayName = React.useMemo(() => {
    if (!studio) return null;

    if (currentSketchId) {
      const sketch = studio.sketches.get(currentSketchId as SketchId);
      if (sketch) {
        for (const [, node] of studio.opGraph) {
          if (node.op.type === "sketch" && (node.op as any).sketchId === currentSketchId) {
            return node.op.name;
          }
        }
        return `Sketch ${currentSketchId.slice(0, 8)}`;
      }
    }

    if (currentBodyFace) {
      const sourceOp = studio.opGraph.get(currentBodyFace.opId);
      if (sourceOp) {
        return `${sourceOp.op.name} - Face ${(currentBodyFace.faceIndex ?? currentBodyFace.index ?? 0) + 1}`;
      }
      return `Face ${(currentBodyFace.faceIndex ?? currentBodyFace.index ?? 0) + 1}`;
    }

    return null;
  }, [currentSketchId, currentBodyFace, studio]);

  const handleDirectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDirection = e.target.value as "normal" | "reverse" | "symmetric";
    if (isCreating) {
      setPendingExtrudeDirection(newDirection);
    } else if (op) {
      updateOp(op.id, { direction: newDirection });
    }
  };

  const handleDepthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDepthValue(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      if (isCreating) {
        setPendingExtrudeDepth(num);
      }
    }
  };

  const handleDepthBlur = () => {
    const num = parseFloat(depthValue);
    if (!isNaN(num) && num > 0) {
      if (isCreating) {
        setPendingExtrudeDepth(num);
      } else if (op) {
        updateOp(op.id, { depth: { value: num, expression: depthValue } });
      }
    }
  };

  const handleClearProfile = () => {
    if (isCreating) {
      setPendingExtrudeSketch(null);
      setPendingExtrudeBodyFace(null);
    } else if (op) {
      // For existing op, enter "editing profile" mode
      setIsEditingProfile(true);
    }
  };

  const handleConfirm = () => {
    const num = parseFloat(depthValue);
    if (!isNaN(num) && num > 0) {
      setPendingExtrudeDepth(num);
    }
    confirmExtrude();
  };

  // Determine if we need to show the profile selector (no profile selected yet, or editing)
  const hasProfile = currentSketchId || currentBodyFace;
  const showProfileSelector = isCreating ? !hasProfile : (isEditingProfile || !hasProfile);

  // Can confirm if we have either a sketch or a body face selected
  const canConfirm = hasProfile && parseFloat(depthValue) > 0;

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Extrude</div>

      {/* Profile selector - show when no profile or editing profile */}
      {showProfileSelector ? (
        <FaceSelector
          label="Profile (Sketch or Face)"
          value={currentSketchId}
          targetType="extrude-profile"
          onClear={handleClearProfile}
        />
      ) : (
        /* Show selected profile with X to clear */
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Profile</label>
          <div style={{
            ...styles.faceSelectorButton,
            ...styles.faceSelectorButtonSelected,
          }}>
            <span style={styles.faceSelectorIcon}>✓</span>
            <span style={{ flex: 1 }}>{profileDisplayName}</span>
            <span
              onClick={handleClearProfile}
              style={{ opacity: 0.6, cursor: "pointer", padding: "0 4px" }}
              title="Change profile"
            >
              ×
            </span>
          </div>
        </div>
      )}

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Direction</label>
        <select
          style={styles.select}
          value={currentDirection}
          onChange={handleDirectionChange}
        >
          <option value="normal">Normal (Up)</option>
          <option value="reverse">Reverse (Down)</option>
          <option value="symmetric">Symmetric (Both)</option>
        </select>
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Depth ({unitLabel})</label>
        <input
          type="number"
          value={depthValue}
          onChange={handleDepthChange}
          onBlur={handleDepthBlur}
          style={styles.input}
          placeholder="e.g., 10"
          min={0}
          step={1}
        />
      </div>

      {/* Create/Cancel buttons only in creation mode */}
      {isCreating && (
        <div style={styles.buttonRow}>
          <button style={styles.secondaryButton} onClick={cancelExtrude}>
            Cancel
          </button>
          <button
            style={{
              ...styles.primaryButton,
              ...(canConfirm ? {} : styles.primaryButtonDisabled),
            }}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Create Extrude
          </button>
        </div>
      )}
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
// Rendering Tab
// ============================================================================

function RenderingTab() {
  const openTab = useTabsStore((s) => s.openTab);
  const documentName = useCadStore((s) => s.document.name);

  const [selectedPreset, setSelectedPreset] = React.useState(1); // Full HD default
  const [customWidth, setCustomWidth] = React.useState(1920);
  const [customHeight, setCustomHeight] = React.useState(1080);
  const [backgroundColor, setBackgroundColor] = React.useState("#0f0f1a");
  const [transparentBg, setTransparentBg] = React.useState(false);
  const [lastCapture, setLastCapture] = React.useState<CaptureResult | null>(null);
  const [isCapturing, setIsCapturing] = React.useState(false);

  const currentResolution = React.useMemo(() => {
    const preset = RESOLUTION_PRESETS[selectedPreset];
    if (preset.width === 0) {
      return { width: customWidth, height: customHeight };
    }
    return { width: preset.width, height: preset.height };
  }, [selectedPreset, customWidth, customHeight]);

  const handleCapture = React.useCallback(() => {
    setIsCapturing(true);

    // Small delay to let UI update
    setTimeout(() => {
      const capture = captureViewport({
        width: currentResolution.width,
        height: currentResolution.height,
        backgroundColor,
        transparentBackground: transparentBg,
      });

      setIsCapturing(false);

      if (capture) {
        setLastCapture(capture);
      }
    }, 50);
  }, [currentResolution, backgroundColor, transparentBg]);

  const handleDownload = React.useCallback(() => {
    if (!lastCapture) return;
    const filename = documentName.replace(/\s+/g, "_") || "render";
    downloadCapture(lastCapture, filename);
  }, [lastCapture, documentName]);

  const handleSaveToLibrary = React.useCallback(async () => {
    if (!lastCapture) return;

    // Convert data URL to File object
    const response = await fetch(lastCapture.dataUrl);
    const blob = await response.blob();
    const filename = `${documentName.replace(/\s+/g, "_") || "render"}_${Date.now()}.png`;
    const file = new File([blob], filename, { type: "image/png" });

    // Create image tab from file
    const { createImageTabFromFile } = await import("../store/tabs-store");
    const tab = await createImageTabFromFile(file);
    openTab(tab);
  }, [lastCapture, documentName, openTab]);

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Resolution</div>

        <div style={styles.field}>
          <label style={styles.fieldLabel}>Preset</label>
          <select
            style={styles.select}
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(parseInt(e.target.value))}
          >
            {RESOLUTION_PRESETS.map((preset, idx) => (
              <option key={idx} value={idx}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        {RESOLUTION_PRESETS[selectedPreset].width === 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.fieldLabel}>Width</label>
              <input
                type="number"
                style={styles.input}
                value={customWidth}
                onChange={(e) => setCustomWidth(parseInt(e.target.value) || 1920)}
                min={100}
                max={8192}
              />
            </div>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.fieldLabel}>Height</label>
              <input
                type="number"
                style={styles.input}
                value={customHeight}
                onChange={(e) => setCustomHeight(parseInt(e.target.value) || 1080)}
                min={100}
                max={8192}
              />
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
          Output: {currentResolution.width} × {currentResolution.height} px
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Background</div>

        <div style={styles.field}>
          <label style={styles.fieldLabel}>Color</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {BACKGROUND_PRESETS.filter((p) => p.color !== "transparent").map((preset) => (
              <button
                key={preset.color}
                onClick={() => {
                  setBackgroundColor(preset.color);
                  setTransparentBg(false);
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  border: backgroundColor === preset.color && !transparentBg
                    ? "2px solid #646cff"
                    : "1px solid #444",
                  backgroundColor: preset.color,
                  cursor: "pointer",
                }}
                title={preset.label}
              />
            ))}
            <button
              onClick={() => setTransparentBg(true)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                border: transparentBg ? "2px solid #646cff" : "1px solid #444",
                background: `
                  linear-gradient(45deg, #444 25%, transparent 25%),
                  linear-gradient(-45deg, #444 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #444 75%),
                  linear-gradient(-45deg, transparent 75%, #444 75%)
                `,
                backgroundSize: "8px 8px",
                backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                cursor: "pointer",
              }}
              title="Transparent"
            />
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <button
          style={{
            ...styles.primaryButton,
            width: "100%",
            opacity: isCapturing ? 0.7 : 1,
          }}
          onClick={handleCapture}
          disabled={isCapturing}
        >
          {isCapturing ? "Capturing..." : "Capture Viewport"}
        </button>
      </div>

      {lastCapture && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Last Capture</div>

          {/* Preview */}
          <div
            style={{
              backgroundColor: "#0f0f1a",
              borderRadius: 8,
              overflow: "hidden",
              marginBottom: 12,
            }}
          >
            <img
              src={lastCapture.dataUrl}
              alt="Last render"
              style={{
                width: "100%",
                height: "auto",
                display: "block",
              }}
            />
          </div>

          {/* Info */}
          <div style={{ fontSize: 11, color: "#666", marginBottom: 12 }}>
            {lastCapture.width} × {lastCapture.height} px •{" "}
            {formatFileSize(getDataUrlSize(lastCapture.dataUrl))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ ...styles.secondaryButton, flex: 1 }}
              onClick={handleDownload}
            >
              Download
            </button>
            <button
              style={{ ...styles.primaryButton, flex: 1 }}
              onClick={handleSaveToLibrary}
            >
              Open in Tab
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Panel
// ============================================================================

export function PropertiesPanel() {
  const [activeTab, setActiveTab] = React.useState<TabId>("properties");
  const selection = useCadStore((s) => s.selection);
  const pendingExtrude = useCadStore((s) => s.pendingExtrude);
  const pendingRevolve = useCadStore((s) => s.pendingRevolve);
  const pendingFillet = useCadStore((s) => s.pendingFillet);
  const pendingBoolean = useCadStore((s) => s.pendingBoolean);
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
        <button
          style={{
            ...styles.tab,
            ...(activeTab === "render" ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab("render")}
        >
          Render
        </button>
      </div>

      <div style={styles.content}>
        {activeTab === "properties" ? (
          // Pending operations take priority and show in the same place as regular properties
          pendingExtrude ? (
            <ExtrudeProperties isPending />
          ) : pendingRevolve ? (
            <RevolveProperties isPending />
          ) : pendingFillet ? (
            <FilletProperties isPending />
          ) : pendingBoolean ? (
            <BooleanProperties isPending />
          ) : selectedOp ? (
            <OpProperties op={selectedOp} />
          ) : (
            <div style={styles.emptyState}>
              Select an operation to view its properties.
            </div>
          )
        ) : activeTab === "parameters" ? (
          <ParametersTab />
        ) : activeTab === "render" ? (
          <RenderingTab />
        ) : null}
      </div>
    </div>
  );
}

export default PropertiesPanel;
