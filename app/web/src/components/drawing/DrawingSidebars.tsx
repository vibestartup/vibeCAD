/**
 * Drawing Sidebars - left and right sidebars for drawing editor.
 */

import React, { useState } from "react";
import { TabbedSidebar, type TabDefinition } from "../TabbedSidebar";
import { useDrawingStore } from "../../store/drawing-store";

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

  emptyState: {
    padding: 24,
    textAlign: "center",
    color: "#666",
    fontSize: 12,
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
};

// ============================================================================
// Views List (Left Sidebar)
// ============================================================================

function ViewsListContent() {
  const drawing = useDrawingStore((s) => s.drawing);
  const selectedViews = useDrawingStore((s) => s.selectedViews);
  const selectView = useDrawingStore((s) => s.selectView);
  const clearSelection = useDrawingStore((s) => s.clearSelection);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!drawing) {
    return <div style={styles.emptyState}>Loading drawing...</div>;
  }

  const views = Array.from(drawing.views.values());

  if (views.length === 0) {
    return (
      <div style={styles.emptyState}>
        No views added yet.
        <br />
        Use Add View to add a projection.
      </div>
    );
  }

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Views ({views.length})</div>
        {views.map((view) => {
          const isSelected = selectedViews.has(view.id);
          const isHovered = hoveredId === view.id;

          return (
            <div
              key={view.id}
              style={{
                ...styles.listItem,
                ...(isSelected ? styles.listItemSelected : {}),
                ...(isHovered && !isSelected ? styles.listItemHover : {}),
              }}
              onClick={() => {
                clearSelection();
                selectView(view.id);
              }}
              onMouseEnter={() => setHoveredId(view.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <span style={{ fontWeight: 500 }}>{view.name}</span>
              <span style={{ flex: 1 }} />
              <span style={styles.badge}>{view.projection}</span>
              <span style={styles.badge}>1:{(1 / view.scale).toFixed(0)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Dimensions List (Left Sidebar)
// ============================================================================

function DimensionsListContent() {
  const drawing = useDrawingStore((s) => s.drawing);
  const selectedDimensions = useDrawingStore((s) => s.selectedDimensions);
  const selectDimension = useDrawingStore((s) => s.selectDimension);
  const clearSelection = useDrawingStore((s) => s.clearSelection);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!drawing) {
    return <div style={styles.emptyState}>Loading drawing...</div>;
  }

  const dimensions = Array.from(drawing.dimensions.values());

  if (dimensions.length === 0) {
    return (
      <div style={styles.emptyState}>
        No dimensions added yet.
        <br />
        Select a view edge to add dimensions.
      </div>
    );
  }

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Dimensions ({dimensions.length})</div>
        {dimensions.map((dim, index) => {
          const isSelected = selectedDimensions.has(dim.id);
          const isHovered = hoveredId === dim.id;

          return (
            <div
              key={dim.id}
              style={{
                ...styles.listItem,
                ...(isSelected ? styles.listItemSelected : {}),
                ...(isHovered && !isSelected ? styles.listItemHover : {}),
              }}
              onClick={() => {
                clearSelection();
                selectDimension(dim.id);
              }}
              onMouseEnter={() => setHoveredId(dim.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <span>Dim {index + 1}</span>
              <span style={{ flex: 1 }} />
              <span style={styles.badge}>{dim.type}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Sheet Info (Left Sidebar)
// ============================================================================

function SheetInfoContent() {
  const drawing = useDrawingStore((s) => s.drawing);

  if (!drawing) {
    return <div style={styles.emptyState}>Loading drawing...</div>;
  }

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Sheet Info</div>
        <div style={styles.row}>
          <span style={styles.label}>Size</span>
          <span style={styles.value}>{drawing.sheet.size}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Width</span>
          <span style={styles.value}>{drawing.sheet.width} mm</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Height</span>
          <span style={styles.value}>{drawing.sheet.height} mm</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Orientation</span>
          <span style={styles.value}>{drawing.sheet.orientation}</span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Statistics</div>
        <div style={styles.row}>
          <span style={styles.label}>Views</span>
          <span style={styles.value}>{drawing.views.size}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Dimensions</span>
          <span style={styles.value}>{drawing.dimensions.size}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Annotations</span>
          <span style={styles.value}>{drawing.annotations.size}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Properties Panel (Right Sidebar) - uses content component directly
// ============================================================================

import { DrawingPropertiesContent } from "./DrawingPropertiesPanel";

function PropertiesContent() {
  return <DrawingPropertiesContent />;
}

// ============================================================================
// Exported Content Components (for flat tabs in AppLayout)
// ============================================================================

export { ViewsListContent as DrawingViewsContent };
export { DimensionsListContent as DrawingDimensionsContent };
export { SheetInfoContent as DrawingSheetContent };
export { PropertiesContent as DrawingPropertiesContent };

// ============================================================================
// Legacy Wrapped Sidebars (deprecated - use individual content exports)
// ============================================================================

export function DrawingLeftSidebar() {
  const tabs: TabDefinition[] = [
    {
      id: "views",
      label: "Views",
      content: <ViewsListContent />,
    },
    {
      id: "dimensions",
      label: "Dims",
      content: <DimensionsListContent />,
    },
    {
      id: "sheet",
      label: "Sheet",
      content: <SheetInfoContent />,
    },
  ];

  return <TabbedSidebar tabs={tabs} defaultTab="views" />;
}

export function DrawingRightSidebar() {
  const tabs: TabDefinition[] = [
    {
      id: "properties",
      label: "Properties",
      content: <PropertiesContent />,
    },
  ];

  return <TabbedSidebar tabs={tabs} defaultTab="properties" />;
}
