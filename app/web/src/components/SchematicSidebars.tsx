/**
 * Schematic Sidebars - left and right sidebars for schematic editor.
 */

import React, { useState } from "react";
import { TabbedSidebar, type TabDefinition } from "./TabbedSidebar";
import { useSchematicStore } from "../store/schematic-store";
import { useLibraryStore } from "../store/library-store";
import type { ComponentCategory } from "@vibecad/core";
import { Schematic } from "@vibecad/core";

type SymbolInstance = Schematic.SymbolInstance;
type Symbol = Schematic.Symbol;

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

  button: {
    padding: "6px 12px",
    backgroundColor: "rgba(100, 108, 255, 0.3)",
    border: "none",
    borderRadius: 4,
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    width: "100%",
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

  categoryHeader: {
    padding: "8px 12px",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    color: "#888",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as React.CSSProperties,
};

// ============================================================================
// Components List (Left Sidebar)
// ============================================================================

function ComponentsListContent() {
  const schematic = useSchematicStore((s) => s.schematic);
  const selectedInstances = useSchematicStore((s) => s.selectedInstances);
  const selectInstance = useSchematicStore((s) => s.selectInstance);
  const getSymbol = useSchematicStore((s) => s.getSymbol);
  const getActiveSheetInstances = useSchematicStore((s) => s.getActiveSheetInstances);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const instances = getActiveSheetInstances();

  // Group by reference prefix
  const grouped = instances.reduce((acc, inst) => {
    const prefix = inst.refDes.replace(/\d+$/, "") || "?";
    if (!acc[prefix]) acc[prefix] = [];
    acc[prefix].push(inst);
    return acc;
  }, {} as Record<string, SymbolInstance[]>);

  const sortedPrefixes = Object.keys(grouped).sort();

  if (instances.length === 0) {
    return (
      <div style={styles.emptyState}>
        No components placed yet.
        <br />
        Use the library to add symbols.
      </div>
    );
  }

  return (
    <div>
      {sortedPrefixes.map((prefix) => (
        <div key={prefix}>
          <div style={styles.categoryHeader}>
            <span>{prefix} ({grouped[prefix].length})</span>
          </div>
          {grouped[prefix]
            .sort((a, b) => a.refDes.localeCompare(b.refDes, undefined, { numeric: true }))
            .map((inst) => {
              const symbol = getSymbol(inst.symbolId);
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
                    {symbol?.name || "Unknown"}
                  </span>
                  {inst.value && (
                    <span style={styles.badge}>{inst.value}</span>
                  )}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Nets List (Left Sidebar)
// ============================================================================

function NetsListContent() {
  const schematic = useSchematicStore((s) => s.schematic);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const nets = Array.from(schematic.nets.values());

  if (nets.length === 0) {
    return (
      <div style={styles.emptyState}>
        No nets defined yet.
        <br />
        Draw wires to create connections.
      </div>
    );
  }

  return (
    <div>
      {nets
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((net) => {
          const isHovered = hoveredId === net.id;
          return (
            <div
              key={net.id}
              style={{
                ...styles.netItem,
                ...(isHovered ? styles.listItemHover : {}),
              }}
              onMouseEnter={() => setHoveredId(net.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <span>{net.name}</span>
              <span style={styles.badge}>
                {net.wires.length} wire{net.wires.length !== 1 ? "s" : ""}
              </span>
            </div>
          );
        })}
    </div>
  );
}

// ============================================================================
// Sheets List (Left Sidebar)
// ============================================================================

function SheetsListContent() {
  const schematic = useSchematicStore((s) => s.schematic);
  const setActiveSheet = useSchematicStore((s) => s.setActiveSheet);

  const sheets = Array.from(schematic.sheets.values());

  return (
    <div>
      {sheets.map((sheet) => {
        const isActive = sheet.id === schematic.activeSheetId;
        return (
          <div
            key={sheet.id}
            style={{
              ...styles.listItem,
              ...(isActive ? styles.listItemSelected : {}),
            }}
            onClick={() => setActiveSheet(sheet.id)}
          >
            <span>📄</span>
            <span>{sheet.name}</span>
            {isActive && <span style={{ marginLeft: "auto", color: "#4dabf7" }}>●</span>}
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
  const selectedInstances = useSchematicStore((s) => s.selectedInstances);
  const schematic = useSchematicStore((s) => s.schematic);
  const getSymbol = useSchematicStore((s) => s.getSymbol);
  const setInstanceRefDes = useSchematicStore((s) => s.setInstanceRefDes);
  const setInstanceValue = useSchematicStore((s) => s.setInstanceValue);

  // Get first selected instance
  const selectedId = selectedInstances.size > 0 ? Array.from(selectedInstances)[0] : null;
  const instance = selectedId ? schematic.symbolInstances.get(selectedId) : null;
  const symbol = instance ? getSymbol(instance.symbolId) : null;

  if (!instance || !symbol) {
    return (
      <div style={styles.emptyState}>
        Select a component to view properties.
      </div>
    );
  }

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Component</div>
        <div style={styles.row}>
          <span style={styles.label}>Type</span>
          <span style={styles.value}>{symbol.name}</span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Attributes</div>

        <label style={styles.label}>Reference Designator</label>
        <input
          type="text"
          style={styles.input}
          value={instance.refDes}
          onChange={(e) => setInstanceRefDes(instance.id, e.target.value)}
        />

        <label style={styles.label}>Value</label>
        <input
          type="text"
          style={styles.input}
          value={instance.value}
          onChange={(e) => setInstanceValue(instance.id, e.target.value)}
          placeholder="e.g., 10k, 100nF"
        />
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Position</div>
        <div style={styles.row}>
          <span style={styles.label}>X</span>
          <span style={styles.value}>{instance.position.x.toFixed(0)}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Y</span>
          <span style={styles.value}>{instance.position.y.toFixed(0)}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Rotation</span>
          <span style={styles.value}>{instance.rotation}°</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Mirror</span>
          <span style={styles.value}>{instance.mirror ? "Yes" : "No"}</span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Pins ({symbol.pins.size})</div>
        {Array.from(symbol.pins.values()).map((pin) => (
          <div key={pin.id} style={styles.row}>
            <span style={styles.label}>{pin.name}</span>
            <span style={styles.value}>{pin.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Design Info (Right Sidebar)
// ============================================================================

function DesignInfoContent() {
  const schematic = useSchematicStore((s) => s.schematic);

  const componentCount = schematic.symbolInstances.size;
  const netCount = schematic.nets.size;
  const wireCount = schematic.wires.size;
  const sheetCount = schematic.sheets.size;

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Document</div>
        <div style={styles.row}>
          <span style={styles.label}>Name</span>
          <span style={styles.value}>{schematic.name}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Sheets</span>
          <span style={styles.value}>{sheetCount}</span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Statistics</div>
        <div style={styles.row}>
          <span style={styles.label}>Components</span>
          <span style={styles.value}>{componentCount}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Nets</span>
          <span style={styles.value}>{netCount}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Wires</span>
          <span style={styles.value}>{wireCount}</span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Timestamps</div>
        <div style={styles.row}>
          <span style={styles.label}>Created</span>
          <span style={styles.value}>
            {new Date(schematic.meta.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Modified</span>
          <span style={styles.value}>
            {new Date(schematic.meta.modifiedAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Library Browser Content
// ============================================================================

function LibraryBrowserContent() {
  const libraryStore = useLibraryStore();
  const startPlaceSymbol = useSchematicStore((s) => s.startPlaceSymbol);

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["resistor", "capacitor"]));

  const allComponents = libraryStore.getAllComponents();

  // Filter by search
  const filteredComponents = searchQuery
    ? allComponents.filter(
        ({ component }) =>
          component.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          component.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : allComponents;

  // Group by category
  const grouped = filteredComponents.reduce((acc, item) => {
    const cat = item.component.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<ComponentCategory, typeof allComponents>);

  const toggleCategory = (cat: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(cat)) {
      newExpanded.delete(cat);
    } else {
      newExpanded.add(cat);
    }
    setExpandedCategories(newExpanded);
  };

  const handleSelectComponent = (symbolId: string) => {
    startPlaceSymbol(symbolId as any);
  };

  return (
    <div>
      <div style={{ padding: 12 }}>
        <input
          type="text"
          style={styles.input}
          placeholder="Search components..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <div
            style={styles.categoryHeader}
            onClick={() => toggleCategory(category)}
          >
            <span>
              {expandedCategories.has(category) ? "▼" : "▶"} {category}
            </span>
            <span style={styles.badge}>{items.length}</span>
          </div>

          {expandedCategories.has(category) && (
            <div>
              {items.map(({ component }) => (
                <div
                  key={component.id}
                  style={styles.listItem}
                  onClick={() => {
                    // Use the first symbol for this component
                    if (component.symbols.length > 0) {
                      handleSelectComponent(component.symbols[0]);
                    }
                  }}
                >
                  <span>{component.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {filteredComponents.length === 0 && (
        <div style={styles.emptyState}>
          {searchQuery ? "No matching components found." : "No components in library."}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Left Sidebar
// ============================================================================

export function SchematicLeftSidebar() {
  const tabs: TabDefinition[] = [
    {
      id: "components",
      label: "Components",
      content: <ComponentsListContent />,
    },
    {
      id: "nets",
      label: "Nets",
      content: <NetsListContent />,
    },
    {
      id: "sheets",
      label: "Sheets",
      content: <SheetsListContent />,
    },
  ];

  return <TabbedSidebar tabs={tabs} defaultTab="components" />;
}

// ============================================================================
// Right Sidebar
// ============================================================================

export function SchematicRightSidebar() {
  const tabs: TabDefinition[] = [
    {
      id: "properties",
      label: "Properties",
      content: <PropertiesContent />,
    },
    {
      id: "library",
      label: "Library",
      content: <LibraryBrowserContent />,
    },
    {
      id: "info",
      label: "Info",
      content: <DesignInfoContent />,
    },
  ];

  return <TabbedSidebar tabs={tabs} defaultTab="properties" />;
}
