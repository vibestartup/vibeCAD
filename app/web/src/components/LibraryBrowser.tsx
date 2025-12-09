/**
 * LibraryBrowser - Component library browser with search, categories, and server integration.
 *
 * Features:
 * - Search components by name, keywords, MPN
 * - Browse by category (accordion style)
 * - Lazy loading from server
 * - Component preview (symbol/footprint)
 * - Click to place component
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSchematicStore } from "../store/schematic-store";
import { usePcbStore } from "../store/pcb-store";
import { useLibraryStore } from "../store/library-store";
import type { ComponentCategory } from "@vibecad/core";

// ============================================================================
// Types
// ============================================================================

interface ComponentEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  package?: string;
  symbolFile?: string;
  footprintFile?: string;
}

interface CategoryNode {
  id: string;
  name: string;
  count: number;
}

interface ServerIndex {
  components: ComponentEntry[];
  categories: Record<string, string[]>;
}

// ============================================================================
// Configuration
// ============================================================================

const LIBRARY_SERVER_URL = import.meta.env.VITE_LIBRARY_SERVER_URL || "http://localhost:3001";

const CATEGORY_ICONS: Record<string, string> = {
  resistor: "Ω",
  capacitor: "⫴",
  inductor: "⌇",
  diode: "▷|",
  transistor: "⋔",
  ic: "▣",
  connector: "⊞",
  switch: "⊗",
  relay: "⎍",
  crystal: "◇",
  transformer: "⌖",
  fuse: "—|—",
  led: "◐",
  display: "▭",
  sensor: "◎",
  module: "▦",
  mechanical: "⚙",
  power: "⚡",
  rf: "∿",
  other: "•",
};

const CATEGORY_ORDER: ComponentCategory[] = [
  "resistor",
  "capacitor",
  "inductor",
  "diode",
  "led",
  "transistor",
  "ic",
  "connector",
  "switch",
  "power",
  "crystal",
  "sensor",
  "module",
  "fuse",
  "relay",
  "transformer",
  "display",
  "rf",
  "mechanical",
  "other",
];

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  } as React.CSSProperties,

  searchBox: {
    padding: 12,
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    flexShrink: 0,
  } as React.CSSProperties,

  searchInput: {
    width: "100%",
    padding: "8px 12px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    borderRadius: 6,
    color: "#fff",
    fontSize: 13,
    outline: "none",
  } as React.CSSProperties,

  content: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
  } as React.CSSProperties,

  categoryHeader: {
    padding: "10px 12px",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 12,
    fontWeight: 500,
    color: "#aaa",
    userSelect: "none",
  } as React.CSSProperties,

  categoryHeaderExpanded: {
    backgroundColor: "rgba(100, 108, 255, 0.1)",
    color: "#fff",
  } as React.CSSProperties,

  categoryIcon: {
    width: 20,
    textAlign: "center",
    fontSize: 14,
    marginRight: 8,
  } as React.CSSProperties,

  categoryBadge: {
    padding: "2px 6px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    fontSize: 10,
    color: "#888",
  } as React.CSSProperties,

  componentList: {
    padding: 4,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  } as React.CSSProperties,

  componentItem: {
    padding: "8px 12px",
    marginBottom: 2,
    borderRadius: 4,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    fontSize: 12,
    color: "#ccc",
    transition: "background-color 0.1s",
  } as React.CSSProperties,

  componentItemHover: {
    backgroundColor: "rgba(100, 108, 255, 0.2)",
    color: "#fff",
  } as React.CSSProperties,

  componentName: {
    fontWeight: 500,
    color: "inherit",
  } as React.CSSProperties,

  componentMeta: {
    fontSize: 10,
    color: "#888",
    display: "flex",
    gap: 8,
  } as React.CSSProperties,

  packageBadge: {
    padding: "1px 4px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 3,
    fontSize: 9,
  } as React.CSSProperties,

  loading: {
    padding: 24,
    textAlign: "center",
    color: "#666",
    fontSize: 12,
  } as React.CSSProperties,

  error: {
    padding: 16,
    margin: 12,
    backgroundColor: "rgba(255, 100, 100, 0.1)",
    borderRadius: 4,
    color: "#f88",
    fontSize: 12,
    textAlign: "center",
  } as React.CSSProperties,

  emptyState: {
    padding: 24,
    textAlign: "center",
    color: "#666",
    fontSize: 12,
  } as React.CSSProperties,

  serverStatus: {
    padding: "6px 12px",
    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
    fontSize: 10,
    color: "#666",
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  } as React.CSSProperties,

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    backgroundColor: "#888",
  } as React.CSSProperties,

  statusDotOnline: {
    backgroundColor: "#4caf50",
  } as React.CSSProperties,

  statusDotOffline: {
    backgroundColor: "#f44336",
  } as React.CSSProperties,

  primitiveSection: {
    padding: 12,
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
  } as React.CSSProperties,

  primitiveSectionTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase",
    marginBottom: 8,
  } as React.CSSProperties,

  primitiveGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 4,
  } as React.CSSProperties,

  primitiveButton: {
    padding: "8px 4px",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: 4,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    fontSize: 10,
    color: "#aaa",
    transition: "all 0.1s",
  } as React.CSSProperties,

  primitiveButtonHover: {
    backgroundColor: "rgba(100, 108, 255, 0.2)",
    borderColor: "rgba(100, 108, 255, 0.4)",
    color: "#fff",
  } as React.CSSProperties,

  primitiveIcon: {
    fontSize: 16,
    lineHeight: 1,
  } as React.CSSProperties,
};

// ============================================================================
// Primitive Components Section
// ============================================================================

interface PrimitiveDef {
  id: string;
  name: string;
  icon: string;
  category: ComponentCategory;
}

const PRIMITIVES: PrimitiveDef[] = [
  { id: "resistor", name: "R", icon: "Ω", category: "resistor" },
  { id: "capacitor", name: "C", icon: "⫴", category: "capacitor" },
  { id: "inductor", name: "L", icon: "⌇", category: "inductor" },
  { id: "diode", name: "D", icon: "▷", category: "diode" },
  { id: "led", name: "LED", icon: "◐", category: "led" },
  { id: "transistor_npn", name: "NPN", icon: "⋔", category: "transistor" },
  { id: "gnd", name: "GND", icon: "⏚", category: "power" },
  { id: "vcc", name: "VCC", icon: "△", category: "power" },
];

function PrimitiveSection({ onSelect }: { onSelect: (primitiveId: string) => void }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div style={styles.primitiveSection}>
      <div style={styles.primitiveSectionTitle}>Quick Place</div>
      <div style={styles.primitiveGrid}>
        {PRIMITIVES.map((prim) => (
          <button
            key={prim.id}
            style={{
              ...styles.primitiveButton,
              ...(hoveredId === prim.id ? styles.primitiveButtonHover : {}),
            }}
            onMouseEnter={() => setHoveredId(prim.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelect(prim.id)}
            title={`Place ${prim.name}`}
          >
            <span style={styles.primitiveIcon}>{prim.icon}</span>
            <span>{prim.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Category Component
// ============================================================================

interface CategoryProps {
  category: string;
  categoryName: string;
  components: ComponentEntry[];
  expanded: boolean;
  onToggle: () => void;
  onSelectComponent: (component: ComponentEntry) => void;
}

function Category({
  category,
  categoryName,
  components,
  expanded,
  onToggle,
  onSelectComponent,
}: CategoryProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const icon = CATEGORY_ICONS[category] || "•";

  return (
    <div>
      <div
        style={{
          ...styles.categoryHeader,
          ...(expanded ? styles.categoryHeaderExpanded : {}),
        }}
        onClick={onToggle}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={styles.categoryIcon}>{icon}</span>
          <span>{expanded ? "▼" : "▶"} {categoryName}</span>
        </div>
        <span style={styles.categoryBadge}>{components.length}</span>
      </div>

      {expanded && (
        <div style={styles.componentList}>
          {components.slice(0, 50).map((comp) => (
            <div
              key={comp.id}
              style={{
                ...styles.componentItem,
                ...(hoveredId === comp.id ? styles.componentItemHover : {}),
              }}
              onMouseEnter={() => setHoveredId(comp.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSelectComponent(comp)}
            >
              <span style={styles.componentName}>{comp.name}</span>
              <div style={styles.componentMeta}>
                {comp.package && (
                  <span style={styles.packageBadge}>{comp.package}</span>
                )}
                {comp.description && (
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {comp.description.slice(0, 40)}
                  </span>
                )}
              </div>
            </div>
          ))}
          {components.length > 50 && (
            <div style={{ ...styles.emptyState, padding: 8 }}>
              +{components.length - 50} more...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Library Browser Component
// ============================================================================

interface LibraryBrowserProps {
  mode: "schematic" | "pcb";
}

export function LibraryBrowser({ mode }: LibraryBrowserProps) {
  // Store connections
  const startPlaceSymbol = useSchematicStore((s) => s.startPlaceSymbol);
  const addSymbolAndStartPlace = useSchematicStore((s) => s.addSymbolAndStartPlace);
  const startPlaceFootprint = usePcbStore((s) => s.startPlaceFootprint);
  const libraryStore = useLibraryStore();

  // Local state
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["resistor", "capacitor"])
  );
  const [serverIndex, setServerIndex] = useState<ServerIndex | null>(null);
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch index from server
  useEffect(() => {
    let cancelled = false;

    async function fetchIndex() {
      try {
        setServerStatus("checking");
        setLoadError(null);

        const response = await fetch(`${LIBRARY_SERVER_URL}/api/libraries/kicad/index`, {
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        if (!cancelled) {
          setServerIndex(data);
          setServerStatus("online");
        }
      } catch (err: any) {
        if (!cancelled) {
          console.warn("Library server not available:", err.message);
          setServerStatus("offline");
          // Fall back to built-in library
        }
      }
    }

    fetchIndex();

    return () => {
      cancelled = true;
    };
  }, []);

  // Get components from either server or built-in library
  const allComponents = useMemo(() => {
    if (serverIndex?.components?.length) {
      return serverIndex.components;
    }

    // Fall back to built-in library
    return libraryStore.getAllComponents().map(({ component }) => ({
      id: component.id,
      name: component.name,
      description: component.description,
      category: component.category,
      package: component.defaultFootprintId ? "Generic" : undefined,
    }));
  }, [serverIndex, libraryStore]);

  // Filter by search
  const filteredComponents = useMemo(() => {
    if (!searchQuery) return allComponents;

    const query = searchQuery.toLowerCase();
    return allComponents.filter(
      (comp) =>
        comp.name.toLowerCase().includes(query) ||
        comp.description?.toLowerCase().includes(query) ||
        comp.package?.toLowerCase().includes(query)
    );
  }, [allComponents, searchQuery]);

  // Group by category
  const groupedComponents = useMemo(() => {
    const grouped: Record<string, ComponentEntry[]> = {};

    for (const comp of filteredComponents) {
      const cat = comp.category || "other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(comp);
    }

    return grouped;
  }, [filteredComponents]);

  // Sort categories by predefined order
  const sortedCategories = useMemo(() => {
    const categories = Object.keys(groupedComponents);
    return categories.sort((a, b) => {
      const aIdx = CATEGORY_ORDER.indexOf(a as ComponentCategory);
      const bIdx = CATEGORY_ORDER.indexOf(b as ComponentCategory);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  }, [groupedComponents]);

  // Handlers
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleSelectPrimitive = useCallback(
    (primitiveId: string) => {
      // Find the primitive in built-in library
      const builtinComponents = libraryStore.getAllComponents();
      const match = builtinComponents.find(({ component }) => {
        const name = component.name.toLowerCase();
        return (
          name === primitiveId ||
          name.includes(primitiveId) ||
          (primitiveId === "transistor_npn" && name.includes("npn")) ||
          (primitiveId === "gnd" && name === "gnd") ||
          (primitiveId === "vcc" && name === "vcc")
        );
      });

      if (match && match.component.symbols.length > 0 && match.library.symbols) {
        if (mode === "schematic") {
          const symbolId = match.component.symbols[0];
          const symbol = match.library.symbols.get(symbolId);
          if (symbol) {
            addSymbolAndStartPlace(symbol as any);
          }
        }
      }
    },
    [libraryStore, mode, addSymbolAndStartPlace]
  );

  const handleSelectComponent = useCallback(
    (component: ComponentEntry) => {
      if (mode === "schematic") {
        // For schematic, we need to get the symbol
        // First check built-in library
        const builtinComponents = libraryStore.getAllComponents();
        const match = builtinComponents.find(
          ({ component: c }) => c.name === component.name
        );

        if (match && match.component.symbols.length > 0 && match.library.symbols) {
          const symbolId = match.component.symbols[0];
          const symbol = match.library.symbols.get(symbolId);
          if (symbol) {
            addSymbolAndStartPlace(symbol as any);
          }
        } else if (serverStatus === "online" && component.symbolFile) {
          // Fetch symbol from server
          fetchSymbolFromServer(component);
        }
      } else {
        // For PCB, we need the footprint
        const builtinComponents = libraryStore.getAllComponents();
        const match = builtinComponents.find(
          ({ component: c }) => c.name === component.name
        );

        if (match && match.component.defaultFootprintId) {
          startPlaceFootprint(match.component.defaultFootprintId as any);
        }
      }
    },
    [libraryStore, mode, addSymbolAndStartPlace, startPlaceFootprint, serverStatus]
  );

  // Fetch symbol from server and place it
  const fetchSymbolFromServer = useCallback(
    async (component: ComponentEntry) => {
      if (!component.symbolFile) return;

      try {
        const response = await fetch(
          `${LIBRARY_SERVER_URL}/api/libraries/kicad/symbol/${encodeURIComponent(component.symbolFile)}`
        );
        if (!response.ok) {
          console.error("Failed to fetch symbol:", response.statusText);
          return;
        }

        const data = await response.json();
        // The server returns the symbol data - we need to parse and convert it
        // For now, log it - full implementation requires KiCad symbol parser on client
        console.log("Fetched symbol data:", data);
        // TODO: Parse data.content with KiCad symbol parser and add to schematic
      } catch (error) {
        console.error("Error fetching symbol:", error);
      }
    },
    []
  );

  const formatCategoryName = (category: string): string => {
    const names: Record<string, string> = {
      resistor: "Resistors",
      capacitor: "Capacitors",
      inductor: "Inductors",
      diode: "Diodes",
      transistor: "Transistors",
      ic: "Integrated Circuits",
      connector: "Connectors",
      switch: "Switches",
      relay: "Relays",
      crystal: "Crystals",
      transformer: "Transformers",
      fuse: "Fuses",
      led: "LEDs",
      display: "Displays",
      sensor: "Sensors",
      module: "Modules",
      mechanical: "Mechanical",
      power: "Power",
      rf: "RF",
      other: "Other",
    };
    return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <div style={styles.container}>
      {/* Primitive quick-place buttons */}
      <PrimitiveSection onSelect={handleSelectPrimitive} />

      {/* Search box */}
      <div style={styles.searchBox}>
        <input
          type="text"
          style={styles.searchInput}
          placeholder="Search components..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Loading state */}
      {serverStatus === "checking" && (
        <div style={styles.loading}>Loading library...</div>
      )}

      {/* Error state */}
      {loadError && <div style={styles.error}>{loadError}</div>}

      {/* Category list */}
      <div style={styles.content}>
        {sortedCategories.map((category) => (
          <Category
            key={category}
            category={category}
            categoryName={formatCategoryName(category)}
            components={groupedComponents[category]}
            expanded={expandedCategories.has(category)}
            onToggle={() => toggleCategory(category)}
            onSelectComponent={handleSelectComponent}
          />
        ))}

        {filteredComponents.length === 0 && serverStatus !== "checking" && (
          <div style={styles.emptyState}>
            {searchQuery
              ? "No matching components found."
              : "No components available."}
          </div>
        )}
      </div>

      {/* Server status footer */}
      <div style={styles.serverStatus}>
        <div
          style={{
            ...styles.statusDot,
            ...(serverStatus === "online"
              ? styles.statusDotOnline
              : serverStatus === "offline"
              ? styles.statusDotOffline
              : {}),
          }}
        />
        <span>
          {serverStatus === "online"
            ? `KiCad Library (${allComponents.length} components)`
            : serverStatus === "offline"
            ? "Using built-in library"
            : "Connecting..."}
        </span>
      </div>
    </div>
  );
}

// Default export for backward compatibility
export default LibraryBrowser;
