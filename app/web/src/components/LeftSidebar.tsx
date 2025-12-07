/**
 * LeftSidebar - tabbed sidebar for the left panel.
 * Contains: Operations (timeline), and extensible for more tabs.
 */

import React from "react";
import { TabbedSidebar, type TabDefinition } from "./TabbedSidebar";
import { OpTimelineContent } from "./OpTimeline";

export function LeftSidebar() {
  const tabs: TabDefinition[] = [
    {
      id: "operations",
      label: "Operations",
      content: <OpTimelineContent />,
    },
    // Future tabs can be added here:
    // { id: "parts", label: "Parts", content: <PartsPanel /> },
    // { id: "assemblies", label: "Assemblies", content: <AssembliesPanel /> },
  ];

  return <TabbedSidebar tabs={tabs} defaultTab="operations" />;
}

export default LeftSidebar;
