/**
 * Schematic Sidebars - left and right sidebars for schematic editor.
 */

import React, { useState, useCallback, useEffect } from "react";
import { TabbedSidebar, type TabDefinition } from "./TabbedSidebar";
import { useSchematicStore } from "../store/schematic-store";
import { useLibraryStore } from "../store/library-store";
import type { ComponentCategory, Component, ComponentId } from "@vibecad/core";
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

  if (!schematic) return null;

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
// Properties Panel (Right Sidebar)
// ============================================================================

function PropertiesContent() {
  const selectedInstances = useSchematicStore((s) => s.selectedInstances);
  const schematic = useSchematicStore((s) => s.schematic);
  const getSymbol = useSchematicStore((s) => s.getSymbol);
  const setInstanceRefDes = useSchematicStore((s) => s.setInstanceRefDes);
  const setInstanceValue = useSchematicStore((s) => s.setInstanceValue);
  const setInstanceProperty = useSchematicStore((s) => s.setInstanceProperty);
  const setInstanceComponent = useSchematicStore((s) => s.setInstanceComponent);
  const changeInstanceSymbol = useSchematicStore((s) => s.changeInstanceSymbol);

  // Library store for component lookup
  const libraryStore = useLibraryStore();

  // Search state for variant picker
  const [variantSearch, setVariantSearch] = useState("");
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ component: Component; libraryId: string }>>([]);

  // Get first selected instance
  const selectedId = selectedInstances.size > 0 ? Array.from(selectedInstances)[0] : null;
  const instance = selectedId && schematic ? schematic.symbolInstances.get(selectedId) : null;
  const symbol = instance ? getSymbol(instance.symbolId) : null;

  // Get linked library component if any
  const linkedComponent = instance?.componentId
    ? libraryStore.getComponent(instance.componentId as ComponentId)
    : undefined;

  // Search for variants when search term changes
  useEffect(() => {
    if (variantSearch.length >= 2) {
      const results = libraryStore.searchComponents(variantSearch);
      setSearchResults(results.slice(0, 10));
    } else {
      setSearchResults([]);
    }
  }, [variantSearch, libraryStore]);

  // Handle selecting a variant from search
  const handleSelectVariant = useCallback(
    (component: Component, libraryId: string) => {
      if (!instance) return;

      // Link the component
      setInstanceComponent(instance.id, component.id, libraryId);

      // If the component has a symbol, use it
      if (component.symbols.length > 0) {
        const symbolId = component.symbols[0];
        // Find the symbol in library
        const allComponents = libraryStore.getAllComponents();
        for (const { component: c, library } of allComponents) {
          if (c.id === component.id && library.symbols) {
            const sym = library.symbols.get(symbolId);
            if (sym) {
              changeInstanceSymbol(instance.id, sym as unknown as Symbol);
              break;
            }
          }
        }
      }

      // Update value if component has specs
      if (component.specs && component.specs.size > 0) {
        const resistance = component.specs.get("resistance");
        const capacitance = component.specs.get("capacitance");
        if (resistance) {
          setInstanceValue(instance.id, String(resistance));
        } else if (capacitance) {
          setInstanceValue(instance.id, String(capacitance));
        }
      }

      // Close picker
      setShowVariantPicker(false);
      setVariantSearch("");
    },
    [instance, setInstanceComponent, changeInstanceSymbol, setInstanceValue, libraryStore]
  );

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
        {linkedComponent && (
          <>
            <div style={styles.row}>
              <span style={styles.label}>Category</span>
              <span style={styles.value}>{linkedComponent.component.category}</span>
            </div>
            {linkedComponent.component.manufacturer && (
              <div style={styles.row}>
                <span style={styles.label}>Manufacturer</span>
                <span style={styles.value}>{linkedComponent.component.manufacturer}</span>
              </div>
            )}
            {linkedComponent.component.mpn && (
              <div style={styles.row}>
                <span style={styles.label}>MPN</span>
                <span style={styles.value}>{linkedComponent.component.mpn}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Variant Selection */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Library Component</div>
        {linkedComponent ? (
          <div style={{ marginBottom: 8 }}>
            <div style={{ ...styles.value, marginBottom: 4 }}>
              {linkedComponent.component.name}
            </div>
            <button
              style={{ ...styles.button, backgroundColor: "rgba(255, 100, 100, 0.2)" }}
              onClick={() => setInstanceComponent(instance.id, undefined, undefined)}
            >
              Unlink
            </button>
          </div>
        ) : (
          <div style={{ color: "#666", fontSize: 11, marginBottom: 8 }}>
            No library component linked
          </div>
        )}

        <button
          style={styles.button}
          onClick={() => setShowVariantPicker(!showVariantPicker)}
        >
          {showVariantPicker ? "Cancel" : "Change Component..."}
        </button>

        {showVariantPicker && (
          <div style={{ marginTop: 8 }}>
            <input
              type="text"
              style={styles.input}
              placeholder="Search components..."
              value={variantSearch}
              onChange={(e) => setVariantSearch(e.target.value)}
              autoFocus
            />
            {searchResults.length > 0 && (
              <div style={{ maxHeight: 200, overflow: "auto" }}>
                {searchResults.map(({ component, libraryId }) => (
                  <div
                    key={component.id}
                    style={{
                      ...styles.listItem,
                      padding: "6px 8px",
                      fontSize: 11,
                    }}
                    onClick={() => handleSelectVariant(component, libraryId)}
                  >
                    <span style={{ fontWeight: 500 }}>{component.name}</span>
                    {component.manufacturer && (
                      <span style={{ color: "#888", marginLeft: 8 }}>
                        {component.manufacturer}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {variantSearch.length >= 2 && searchResults.length === 0 && (
              <div style={{ color: "#666", fontSize: 11, padding: 8 }}>
                No matching components found
              </div>
            )}
          </div>
        )}
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

      {/* Custom Properties */}
      {instance.properties.size > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Properties</div>
          {Array.from(instance.properties.entries()).map(([key, value]) => (
            <div key={key} style={styles.row}>
              <span style={styles.label}>{key}</span>
              <input
                type="text"
                style={{ ...styles.input, marginBottom: 0, width: "50%" }}
                value={value}
                onChange={(e) => setInstanceProperty(instance.id, key, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Supplier Info from linked component */}
      {linkedComponent && linkedComponent.component.suppliers.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Suppliers</div>
          {linkedComponent.component.suppliers.slice(0, 3).map((supplier, idx) => (
            <div key={idx} style={{ ...styles.row, marginBottom: 4 }}>
              <span style={styles.label}>{supplier.supplier}</span>
              <span style={styles.value}>
                {supplier.partNumber}
                {supplier.stock !== undefined && (
                  <span style={{ color: supplier.stock > 0 ? "#4caf50" : "#f44336", marginLeft: 8 }}>
                    {supplier.stock > 0 ? `${supplier.stock} in stock` : "Out of stock"}
                  </span>
                )}
              </span>
            </div>
          ))}
          {linkedComponent.component.datasheetUrl && (
            <a
              href={linkedComponent.component.datasheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#4dabf7", fontSize: 11, textDecoration: "none" }}
            >
              View Datasheet
            </a>
          )}
        </div>
      )}

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

  if (!schematic) return null;

  const componentCount = schematic.symbolInstances.size;
  const netCount = schematic.nets.size;
  const wireCount = schematic.wires.size;

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Document</div>
        <div style={styles.row}>
          <span style={styles.label}>Name</span>
          <span style={styles.value}>{schematic.name}</span>
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
// Library Browser Content (uses enhanced LibraryBrowser component)
// ============================================================================

import { LibraryBrowser } from "./LibraryBrowser";

function LibraryBrowserContent() {
  return <LibraryBrowser mode="schematic" />;
}

// ============================================================================
// Exported Content Components (for flat tabs in AppLayout)
// ============================================================================

export { ComponentsListContent as SchematicComponentsContent };
export { NetsListContent as SchematicNetsContent };
export { PropertiesContent as SchematicPropertiesContent };
export { LibraryBrowserContent as SchematicLibraryContent };
export { DesignInfoContent as SchematicInfoContent };

// ============================================================================
// Legacy Wrapped Sidebars (deprecated - use individual content exports)
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
  ];

  return <TabbedSidebar tabs={tabs} defaultTab="components" />;
}

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
