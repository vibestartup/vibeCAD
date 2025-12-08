/**
 * PCB Sidebars - left and right sidebars for PCB editor.
 */

import React, { useState } from "react";
import { TabbedSidebar, type TabDefinition } from "./TabbedSidebar";
import { usePcbStore } from "../store/pcb-store";
import type { FootprintInstance, Footprint, Layer, LayerId, DrcViolation } from "@vibecad/core";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  section: {
    padding: 12,
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase",
    marginBottom: 8,
  } as React.CSSProperties,

  listItem: {
    padding: "8px 12px",
    borderRadius: 4,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "#ccc",
  } as React.CSSProperties,

  listItemHover: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  } as React.CSSProperties,

  listItemSelected: {
    backgroundColor: "rgba(100, 108, 255, 0.3)",
    color: "#fff",
  } as React.CSSProperties,

  input: {
    width: "100%",
    padding: "8px 12px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: 4,
    color: "#fff",
    fontSize: 12,
    marginBottom: 8,
  } as React.CSSProperties,

  label: {
    fontSize: 11,
    color: "#888",
    marginBottom: 4,
    display: "block",
  } as React.CSSProperties,

  value: {
    fontSize: 12,
    color: "#fff",
  } as React.CSSProperties,

  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  } as React.CSSProperties,

  badge: {
    padding: "2px 6px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    fontSize: 10,
    color: "#888",
  } as React.CSSProperties,

  emptyState: {
    padding: 24,
    textAlign: "center",
    color: "#666",
    fontSize: 12,
  } as React.CSSProperties,

  layerItem: {
    padding: "6px 12px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    fontSize: 12,
  } as React.CSSProperties,

  layerColor: {
    width: 16,
    height: 16,
    borderRadius: 2,
  } as React.CSSProperties,

  layerCheckbox: {
    width: 14,
    height: 14,
    cursor: "pointer",
  } as React.CSSProperties,

  drcItem: {
    padding: "8px 12px",
    borderRadius: 4,
    backgroundColor: "rgba(255, 100, 100, 0.1)",
    marginBottom: 4,
    fontSize: 11,
    cursor: "pointer",
  } as React.CSSProperties,

  netItem: {
    padding: "6px 12px",
    borderRadius: 4,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#ccc",
  } as React.CSSProperties,
};

// Layer colors (same as in PcbCanvas)
const LAYER_COLORS: Record<string, string> = {
  "F.Cu": "#ff4444",
  "B.Cu": "#4444ff",
  "In1.Cu": "#44ff44",
  "In2.Cu": "#ffff44",
  "F.SilkS": "#ffffff",
  "B.SilkS": "#888888",
  "Edge.Cuts": "#ffff00",
  "F.Fab": "#666666",
  "B.Fab": "#444444",
};

// ============================================================================
// Components List (Left Sidebar)
// ============================================================================

function ComponentsListContent() {
  const pcb = usePcbStore((s) => s.pcb);
  const selectedInstances = usePcbStore((s) => s.selectedInstances);
  const selectInstance = usePcbStore((s) => s.selectInstance);
  const getFootprint = usePcbStore((s) => s.getFootprint);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const instances = Array.from(pcb.instances.values());

  // Group by reference prefix
  const grouped = instances.reduce((acc, inst) => {
    const prefix = inst.refDes.replace(/\d+$/, "") || "?";
    if (!acc[prefix]) acc[prefix] = [];
    acc[prefix].push(inst);
    return acc;
  }, {} as Record<string, FootprintInstance[]>);

  const sortedPrefixes = Object.keys(grouped).sort();

  if (instances.length === 0) {
    return (
      <div style={styles.emptyState}>
        No footprints placed yet.
        <br />
        Import from schematic or add manually.
      </div>
    );
  }

  return (
    <div>
      {sortedPrefixes.map((prefix) => (
        <div key={prefix}>
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              color: "#888",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {prefix} ({grouped[prefix].length})
          </div>
          {grouped[prefix]
            .sort((a, b) => a.refDes.localeCompare(b.refDes, undefined, { numeric: true }))
            .map((inst) => {
              const footprint = getFootprint(inst.footprintId);
              const isSelected = selectedInstances.has(inst.id);
              const isHovered = hoveredId === inst.id;

              return (
                <div
                  key={inst.id}
                  style={{
                    ...styles.listItem,
                    ...(isSelected ? styles.listItemSelected : {}),
                    ...(isHovered && !isSelected ? styles.listItemHover : {}),
                  }}
                  onClick={() => selectInstance(inst.id)}
                  onMouseEnter={() => setHoveredId(inst.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <span style={{ fontWeight: 500 }}>{inst.refDes}</span>
                  <span style={{ color: "#888", flex: 1, marginLeft: 8 }}>
                    {footprint?.name || "Unknown"}
                  </span>
                  <span style={styles.badge}>{inst.side}</span>
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Layers Panel (Left Sidebar)
// ============================================================================

function LayersContent() {
  const pcb = usePcbStore((s) => s.pcb);
  const layerVisibility = usePcbStore((s) => s.layerVisibility);
  const activeLayer = usePcbStore((s) => s.activeLayer);
  const setActiveLayer = usePcbStore((s) => s.setActiveLayer);
  const toggleLayerVisibility = usePcbStore((s) => s.toggleLayerVisibility);
  const showAllLayers = usePcbStore((s) => s.showAllLayers);
  const hideAllLayers = usePcbStore((s) => s.hideAllLayers);

  const layers = Array.from(pcb.layers.values());

  // Group layers by type
  const copperLayers = layers.filter((l) => l.type === "copper");
  const silkLayers = layers.filter((l) => l.type === "silkscreen");
  const maskLayers = layers.filter((l) => l.type === "soldermask");
  const otherLayers = layers.filter(
    (l) => !["copper", "silkscreen", "soldermask"].includes(l.type)
  );

  const renderLayerGroup = (title: string, groupLayers: Layer[]) => {
    if (groupLayers.length === 0) return null;

    return (
      <div key={title}>
        <div style={{ ...styles.sectionTitle, padding: "8px 12px" }}>{title}</div>
        {groupLayers.map((layer) => {
          const isVisible = layerVisibility.get(layer.id) ?? true;
          const isActive = activeLayer === layer.id;
          const color = LAYER_COLORS[layer.name] || "#888";

          return (
            <div
              key={layer.id}
              style={{
                ...styles.layerItem,
                backgroundColor: isActive ? "rgba(100, 108, 255, 0.2)" : "transparent",
              }}
              onClick={() => setActiveLayer(layer.id)}
            >
              <input
                type="checkbox"
                style={styles.layerCheckbox}
                checked={isVisible}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleLayerVisibility(layer.id);
                }}
              />
              <div style={{ ...styles.layerColor, backgroundColor: color }} />
              <span style={{ flex: 1, color: isVisible ? "#fff" : "#666" }}>
                {layer.name}
              </span>
              {isActive && <span style={{ color: "#4dabf7" }}>●</span>}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div style={{ padding: 8, display: "flex", gap: 8 }}>
        <button
          style={{
            flex: 1,
            padding: "6px",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "none",
            borderRadius: 4,
            color: "#aaa",
            cursor: "pointer",
            fontSize: 11,
          }}
          onClick={showAllLayers}
        >
          Show All
        </button>
        <button
          style={{
            flex: 1,
            padding: "6px",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "none",
            borderRadius: 4,
            color: "#aaa",
            cursor: "pointer",
            fontSize: 11,
          }}
          onClick={hideAllLayers}
        >
          Hide All
        </button>
      </div>

      {renderLayerGroup("Copper", copperLayers)}
      {renderLayerGroup("Silkscreen", silkLayers)}
      {renderLayerGroup("Soldermask", maskLayers)}
      {renderLayerGroup("Other", otherLayers)}
    </div>
  );
}

// ============================================================================
// Nets Panel (Left Sidebar)
// ============================================================================

function NetsContent() {
  const pcb = usePcbStore((s) => s.pcb);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const nets = Array.from(pcb.nets.entries());

  if (nets.length === 0) {
    return (
      <div style={styles.emptyState}>
        No nets defined yet.
        <br />
        Import from schematic or route manually.
      </div>
    );
  }

  return (
    <div>
      {nets
        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
        .map(([netId, net]) => {
          const isHovered = hoveredId === netId;
          const padCount = net.pads.length;
          const isRouted = net.isFullyRouted;

          return (
            <div
              key={netId}
              style={{
                ...styles.netItem,
                ...(isHovered ? styles.listItemHover : {}),
              }}
              onMouseEnter={() => setHoveredId(netId)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <span>{net.name}</span>
              <div style={{ display: "flex", gap: 4 }}>
                <span style={styles.badge}>{padCount} pads</span>
                {isRouted && (
                  <span style={{ ...styles.badge, backgroundColor: "rgba(100, 255, 100, 0.2)", color: "#69db7c" }}>
                    ✓
                  </span>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}

// ============================================================================
// Properties Panel (Right Sidebar)
// ============================================================================

function PropertiesContent() {
  const selectedInstances = usePcbStore((s) => s.selectedInstances);
  const pcb = usePcbStore((s) => s.pcb);
  const getFootprint = usePcbStore((s) => s.getFootprint);

  // Get first selected instance
  const selectedId = selectedInstances.size > 0 ? Array.from(selectedInstances)[0] : null;
  const instance = selectedId ? pcb.instances.get(selectedId) : null;
  const footprint = instance ? getFootprint(instance.footprintId) : null;

  if (!instance || !footprint) {
    return (
      <div style={styles.emptyState}>
        Select a footprint to view properties.
      </div>
    );
  }

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Footprint</div>
        <div style={styles.row}>
          <span style={styles.label}>Name</span>
          <span style={styles.value}>{footprint.name}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Description</span>
          <span style={styles.value}>{footprint.description || "-"}</span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Instance</div>
        <div style={styles.row}>
          <span style={styles.label}>Reference</span>
          <span style={styles.value}>{instance.refDes}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Value</span>
          <span style={styles.value}>{instance.value || "-"}</span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Position</div>
        <div style={styles.row}>
          <span style={styles.label}>X</span>
          <span style={styles.value}>{instance.position[0].toFixed(3)} mm</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Y</span>
          <span style={styles.value}>{instance.position[1].toFixed(3)} mm</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Rotation</span>
          <span style={styles.value}>{instance.rotation}°</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Side</span>
          <span style={styles.value}>{instance.side}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Locked</span>
          <span style={styles.value}>{instance.locked ? "Yes" : "No"}</span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Pads ({footprint.pads.size})</div>
        {Array.from(footprint.pads.entries()).slice(0, 10).map(([padId, pad]) => (
          <div key={padId} style={styles.row}>
            <span style={styles.label}>{pad.name || padId}</span>
            <span style={styles.value}>
              {pad.shape} {pad.size[0].toFixed(2)}×{pad.size[1].toFixed(2)}
            </span>
          </div>
        ))}
        {footprint.pads.size > 10 && (
          <div style={{ color: "#666", fontSize: 11 }}>
            ... and {footprint.pads.size - 10} more
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// DRC Panel (Right Sidebar)
// ============================================================================

function DrcContent() {
  const pcb = usePcbStore((s) => s.pcb);
  const runDrc = usePcbStore((s) => s.runDrc);
  const clearDrc = usePcbStore((s) => s.clearDrc);
  const drcRunning = usePcbStore((s) => s.drcRunning);

  const violations = pcb.drcViolations || [];

  return (
    <div>
      <div style={{ padding: 12, display: "flex", gap: 8 }}>
        <button
          style={{
            flex: 1,
            padding: "8px",
            backgroundColor: "rgba(100, 108, 255, 0.3)",
            border: "none",
            borderRadius: 4,
            color: "#fff",
            cursor: "pointer",
            fontSize: 12,
          }}
          onClick={runDrc}
          disabled={drcRunning}
        >
          {drcRunning ? "Running..." : "Run DRC"}
        </button>
        <button
          style={{
            padding: "8px 12px",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "none",
            borderRadius: 4,
            color: "#aaa",
            cursor: "pointer",
            fontSize: 12,
          }}
          onClick={clearDrc}
        >
          Clear
        </button>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          Violations ({violations.length})
        </div>

        {violations.length === 0 ? (
          <div style={styles.emptyState}>
            {pcb.drcViolations === undefined
              ? "Run DRC to check for violations."
              : "No violations found! ✓"}
          </div>
        ) : (
          violations.map((violation, idx) => (
            <div key={idx} style={styles.drcItem}>
              <div style={{ fontWeight: 500, color: "#ff6b6b", marginBottom: 4 }}>
                {violation.type}
              </div>
              <div style={{ color: "#ccc" }}>{violation.message}</div>
              <div style={{ color: "#888", marginTop: 4 }}>
                at ({violation.position[0].toFixed(2)}, {violation.position[1].toFixed(2)})
              </div>
            </div>
          ))
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Design Rules</div>
        <div style={styles.row}>
          <span style={styles.label}>Min Trace Width</span>
          <span style={styles.value}>{pcb.designRules.minTraceWidth} mm</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Min Clearance</span>
          <span style={styles.value}>{pcb.designRules.minClearance} mm</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Min Via Diameter</span>
          <span style={styles.value}>{pcb.designRules.minViaDiameter} mm</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Min Via Drill</span>
          <span style={styles.value}>{pcb.designRules.minViaDrill} mm</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Board Info (Right Sidebar)
// ============================================================================

function BoardInfoContent() {
  const pcb = usePcbStore((s) => s.pcb);

  const instanceCount = pcb.instances.size;
  const traceCount = pcb.traces.size;
  const viaCount = pcb.vias.size;
  const netCount = pcb.nets.size;
  const layerCount = pcb.layerStack.copperLayers.length;

  // Calculate board area
  let boardArea = 0;
  if (pcb.boardOutline.outline.length >= 3) {
    const outline = pcb.boardOutline.outline;
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length;
      boardArea += outline[i][0] * outline[j][1];
      boardArea -= outline[j][0] * outline[i][1];
    }
    boardArea = Math.abs(boardArea) / 2;
  }

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Document</div>
        <div style={styles.row}>
          <span style={styles.label}>Name</span>
          <span style={styles.value}>{pcb.name}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Units</span>
          <span style={styles.value}>{pcb.units}</span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Board</div>
        <div style={styles.row}>
          <span style={styles.label}>Area</span>
          <span style={styles.value}>{boardArea.toFixed(2)} mm²</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Layers</span>
          <span style={styles.value}>{layerCount} copper</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Thickness</span>
          <span style={styles.value}>{pcb.meta.boardThickness} mm</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Copper Weight</span>
          <span style={styles.value}>{pcb.meta.copperWeight} oz</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Finish</span>
          <span style={styles.value}>{pcb.meta.finishType}</span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Statistics</div>
        <div style={styles.row}>
          <span style={styles.label}>Footprints</span>
          <span style={styles.value}>{instanceCount}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Traces</span>
          <span style={styles.value}>{traceCount}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Vias</span>
          <span style={styles.value}>{viaCount}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Nets</span>
          <span style={styles.value}>{netCount}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Left Sidebar
// ============================================================================

export function PcbLeftSidebar() {
  const tabs: TabDefinition[] = [
    {
      id: "components",
      label: "Components",
      content: <ComponentsListContent />,
    },
    {
      id: "layers",
      label: "Layers",
      content: <LayersContent />,
    },
    {
      id: "nets",
      label: "Nets",
      content: <NetsContent />,
    },
  ];

  return <TabbedSidebar tabs={tabs} defaultTab="components" />;
}

// ============================================================================
// Right Sidebar
// ============================================================================

export function PcbRightSidebar() {
  const tabs: TabDefinition[] = [
    {
      id: "properties",
      label: "Properties",
      content: <PropertiesContent />,
    },
    {
      id: "drc",
      label: "DRC",
      content: <DrcContent />,
    },
    {
      id: "info",
      label: "Info",
      content: <BoardInfoContent />,
    },
  ];

  return <TabbedSidebar tabs={tabs} defaultTab="properties" />;
}
