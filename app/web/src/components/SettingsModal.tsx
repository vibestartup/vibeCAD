/**
 * SettingsModal - user preferences and API key configuration.
 */

import React, { useState, useEffect } from "react";
import {
  useSettingsStore,
  type UnitSystem,
  type LengthUnit,
  type AngleUnit,
} from "../store/settings-store";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  overlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },

  modal: {
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    border: "1px solid #333",
    width: "100%",
    maxWidth: 500,
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid #333",
  },

  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: "#fff",
  },

  closeButton: {
    background: "none",
    border: "none",
    color: "#888",
    fontSize: 20,
    cursor: "pointer",
    padding: 4,
    lineHeight: 1,
  },

  content: {
    padding: 20,
  },

  section: {
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#888",
    marginBottom: 12,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },

  field: {
    marginBottom: 16,
  },

  label: {
    display: "block",
    fontSize: 13,
    color: "#ccc",
    marginBottom: 6,
  },

  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 4,
    border: "1px solid #333",
    backgroundColor: "#0f0f1a",
    color: "#fff",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
  },

  inputFocus: {
    borderColor: "#646cff",
  },

  select: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 4,
    border: "1px solid #333",
    backgroundColor: "#0f0f1a",
    color: "#fff",
    fontSize: 14,
    outline: "none",
    cursor: "pointer",
    boxSizing: "border-box" as const,
  },

  row: {
    display: "flex",
    gap: 12,
  },

  halfField: {
    flex: 1,
  },

  apiKeyInput: {
    fontFamily: "monospace",
    fontSize: 12,
  },

  hint: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },

  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  checkbox: {
    width: 16,
    height: 16,
    cursor: "pointer",
  },

  checkboxLabel: {
    fontSize: 13,
    color: "#ccc",
    cursor: "pointer",
  },

  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    padding: "16px 20px",
    borderTop: "1px solid #333",
  },

  button: {
    padding: "8px 16px",
    borderRadius: 4,
    border: "none",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.15s",
  },

  primaryButton: {
    backgroundColor: "#646cff",
    color: "#fff",
  },

  secondaryButton: {
    backgroundColor: "#333",
    color: "#fff",
  },
};

// ============================================================================
// Component
// ============================================================================

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const settings = useSettingsStore();

  // Local state for form
  const [userName, setUserName] = useState(settings.userName);
  const [unitSystem, setUnitSystem] = useState(settings.unitSystem);
  const [lengthUnit, setLengthUnit] = useState(settings.lengthUnit);
  const [angleUnit, setAngleUnit] = useState(settings.angleUnit);
  const [showSketchCursor, setShowSketchCursor] = useState(settings.showSketchCursor);
  const [openaiApiKey, setOpenaiApiKey] = useState(settings.openaiApiKey);
  const [openaiProjectId, setOpenaiProjectId] = useState(settings.openaiProjectId);
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey);
  const [anthropicApiKey, setAnthropicApiKey] = useState(settings.anthropicApiKey);

  // Sync local state with store when modal opens
  useEffect(() => {
    if (isOpen) {
      setUserName(settings.userName);
      setUnitSystem(settings.unitSystem);
      setLengthUnit(settings.lengthUnit);
      setAngleUnit(settings.angleUnit);
      setShowSketchCursor(settings.showSketchCursor);
      setOpenaiApiKey(settings.openaiApiKey);
      setOpenaiProjectId(settings.openaiProjectId);
      setGeminiApiKey(settings.geminiApiKey);
      setAnthropicApiKey(settings.anthropicApiKey);
    }
  }, [isOpen, settings]);

  // Handle unit system change - auto-select appropriate length unit
  const handleUnitSystemChange = (system: UnitSystem) => {
    setUnitSystem(system);
    setLengthUnit(system === "metric" ? "mm" : "in");
  };

  // Save settings
  const handleSave = () => {
    settings.setUserName(userName);
    settings.setUnitSystem(unitSystem);
    settings.setLengthUnit(lengthUnit);
    settings.setAngleUnit(angleUnit);
    settings.setShowSketchCursor(showSketchCursor);
    settings.setOpenaiApiKey(openaiApiKey);
    settings.setOpenaiProjectId(openaiProjectId);
    settings.setGeminiApiKey(geminiApiKey);
    settings.setAnthropicApiKey(anthropicApiKey);
    onClose();
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Settings</h2>
          <button style={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* User Info Section */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>User Info</div>
            <div style={styles.field}>
              <label style={styles.label}>Name</label>
              <input
                type="text"
                style={styles.input}
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          </div>

          {/* Units Section */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Units</div>
            <div style={styles.row}>
              <div style={{ ...styles.field, ...styles.halfField }}>
                <label style={styles.label}>Unit System</label>
                <select
                  style={styles.select}
                  value={unitSystem}
                  onChange={(e) =>
                    handleUnitSystemChange(e.target.value as UnitSystem)
                  }
                >
                  <option value="metric">Metric</option>
                  <option value="imperial">Imperial</option>
                </select>
              </div>
              <div style={{ ...styles.field, ...styles.halfField }}>
                <label style={styles.label}>Length Unit</label>
                <select
                  style={styles.select}
                  value={lengthUnit}
                  onChange={(e) => setLengthUnit(e.target.value as LengthUnit)}
                >
                  {unitSystem === "metric" ? (
                    <>
                      <option value="mm">Millimeters (mm)</option>
                      <option value="cm">Centimeters (cm)</option>
                      <option value="m">Meters (m)</option>
                    </>
                  ) : (
                    <>
                      <option value="in">Inches (in)</option>
                      <option value="ft">Feet (ft)</option>
                    </>
                  )}
                </select>
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Angle Unit</label>
              <select
                style={styles.select}
                value={angleUnit}
                onChange={(e) => setAngleUnit(e.target.value as AngleUnit)}
              >
                <option value="deg">Degrees</option>
                <option value="rad">Radians</option>
              </select>
            </div>
          </div>

          {/* Sketch Section */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Sketch</div>
            <div style={styles.field}>
              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={showSketchCursor}
                  onChange={(e) => setShowSketchCursor(e.target.checked)}
                />
                <span style={styles.checkboxLabel}>Show sketch cursor</span>
              </label>
              <p style={styles.hint}>
                Show a semi-transparent dot at the mouse position in sketch mode
              </p>
            </div>
          </div>

          {/* API Keys Section */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>AI API Keys</div>
            <p style={styles.hint}>
              API keys are stored locally in your browser and never sent to our
              servers.
            </p>

            <div style={styles.field}>
              <label style={styles.label}>OpenAI API Key</label>
              <input
                type="password"
                style={{ ...styles.input, ...styles.apiKeyInput }}
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="sk-..."
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>OpenAI Project ID</label>
              <input
                type="text"
                style={{ ...styles.input, ...styles.apiKeyInput }}
                value={openaiProjectId}
                onChange={(e) => setOpenaiProjectId(e.target.value)}
                placeholder="proj-..."
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Google Gemini API Key</label>
              <input
                type="password"
                style={{ ...styles.input, ...styles.apiKeyInput }}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIza..."
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Anthropic API Key</label>
              <input
                type="password"
                style={{ ...styles.input, ...styles.apiKeyInput }}
                value={anthropicApiKey}
                onChange={(e) => setAnthropicApiKey(e.target.value)}
                placeholder="sk-ant-..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={handleSave}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
