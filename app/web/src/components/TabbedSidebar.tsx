/**
 * TabbedSidebar - shared tabbed sidebar component for left and right panels.
 */

import React from "react";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: "transparent",
  } as React.CSSProperties,

  tabs: {
    display: "flex",
    flexWrap: "wrap",
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    flexShrink: 0,
  } as React.CSSProperties,

  tab: {
    flex: "1 1 auto",
    minWidth: "fit-content",
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
  } as React.CSSProperties,

  tabActive: {
    color: "#fff",
    borderBottomColor: "#646cff",
  } as React.CSSProperties,

  content: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
  } as React.CSSProperties,
};

// ============================================================================
// Types
// ============================================================================

export interface TabDefinition {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface TabbedSidebarProps {
  tabs: TabDefinition[];
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function TabbedSidebar({
  tabs,
  defaultTab,
  activeTab: controlledActiveTab,
  onTabChange,
}: TabbedSidebarProps) {
  const [internalActiveTab, setInternalActiveTab] = React.useState(
    defaultTab || tabs[0]?.id || ""
  );

  // Support both controlled and uncontrolled modes
  const activeTab = controlledActiveTab ?? internalActiveTab;

  const handleTabClick = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId);
    } else {
      setInternalActiveTab(tabId);
    }
  };

  const activeTabContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <div style={styles.container}>
      <div style={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={styles.content}>{activeTabContent}</div>
    </div>
  );
}

export default TabbedSidebar;
