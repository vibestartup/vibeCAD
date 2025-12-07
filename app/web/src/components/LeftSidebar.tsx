/**
 * LeftSidebar - tabbed sidebar for the left panel.
 * Contains: Explorer (file browser) and Operations (timeline).
 */

import React from "react";
import { TabbedSidebar, type TabDefinition } from "./TabbedSidebar";
import { OpTimelineContent } from "./OpTimeline";
import { FileExplorer } from "./FileExplorer";

export function LeftSidebar() {
  const tabs: TabDefinition[] = [
    {
      id: "explorer",
      label: "Explorer",
      content: <FileExplorer />,
    },
    {
      id: "operations",
      label: "Operations",
      content: <OpTimelineContent />,
    },
  ];

  return <TabbedSidebar tabs={tabs} defaultTab="explorer" />;
}

export default LeftSidebar;
