/**
 * RightSidebar - tabbed sidebar for the right panel.
 * Contains: Properties, Parameters, Render tabs.
 */

import React from "react";
import { TabbedSidebar, type TabDefinition } from "./TabbedSidebar";
import { PropertiesContent, ParametersContent, RenderContent } from "./PropertiesPanel";

export function RightSidebar() {
  const tabs: TabDefinition[] = [
    {
      id: "properties",
      label: "Properties",
      content: <PropertiesContent />,
    },
    {
      id: "parameters",
      label: "Parameters",
      content: <ParametersContent />,
    },
    {
      id: "render",
      label: "Render",
      content: <RenderContent />,
    },
  ];

  return <TabbedSidebar tabs={tabs} defaultTab="properties" />;
}

export default RightSidebar;
