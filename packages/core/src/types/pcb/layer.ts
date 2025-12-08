/**
 * PCB Layer system - copper layers, silkscreen, soldermask, etc.
 */

import { LayerId, newId } from "../id";

// ============================================================================
// Layer Types
// ============================================================================

export type CopperLayerType = "signal" | "plane" | "mixed";

export type LayerType =
  | "copper"
  | "silkscreen"
  | "soldermask"
  | "solderpaste"
  | "mechanical"
  | "keepout"
  | "courtyard"
  | "fabrication"
  | "adhesive";

// ============================================================================
// Layer
// ============================================================================

export interface Layer {
  id: LayerId;
  name: string;
  type: LayerType;

  // For copper layers
  copperType?: CopperLayerType;
  stackPosition?: number; // 0 = top, N = bottom

  // Visibility
  visible: boolean;
  color: string; // Hex color for rendering
  opacity: number; // 0-1
}

// ============================================================================
// Layer Stack
// ============================================================================

export interface LayerStack {
  layers: LayerId[]; // Ordered from top to bottom
  copperLayers: LayerId[]; // Just copper layers, ordered
  totalThickness: number; // mm
}

// ============================================================================
// Default Layer Colors
// ============================================================================

export const DEFAULT_LAYER_COLORS: Record<string, string> = {
  "F.Cu": "#840000", // Top copper - red
  "B.Cu": "#0000C8", // Bottom copper - blue
  "In1.Cu": "#C2C200", // Inner 1 - yellow
  "In2.Cu": "#C200C2", // Inner 2 - magenta
  "F.SilkS": "#F0F0F0", // Top silkscreen - white
  "B.SilkS": "#00C8C8", // Bottom silkscreen - cyan
  "F.Mask": "#840084", // Top soldermask - purple
  "B.Mask": "#008400", // Bottom soldermask - green
  "F.Paste": "#C8C8C8", // Top paste - gray
  "B.Paste": "#808080", // Bottom paste - dark gray
  "Edge.Cuts": "#C8C800", // Board outline - yellow
  "F.CrtYd": "#A0A0A0", // Top courtyard - light gray
  "B.CrtYd": "#606060", // Bottom courtyard - dark gray
  "F.Fab": "#FF8000", // Top fabrication - orange
  "B.Fab": "#0080FF", // Bottom fabrication - light blue
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a copper layer.
 */
export function createCopperLayer(
  name: string,
  stackPosition: number,
  copperType: CopperLayerType = "signal"
): Layer {
  const colorKey = stackPosition === 0 ? "F.Cu" : stackPosition === 1 ? "B.Cu" : `In${stackPosition}.Cu`;
  return {
    id: newId("Layer"),
    name,
    type: "copper",
    copperType,
    stackPosition,
    visible: true,
    color: DEFAULT_LAYER_COLORS[colorKey] || "#C8C800",
    opacity: 1,
  };
}

/**
 * Create a non-copper layer.
 */
export function createLayer(name: string, type: LayerType): Layer {
  return {
    id: newId("Layer"),
    name,
    type,
    visible: true,
    color: DEFAULT_LAYER_COLORS[name] || "#808080",
    opacity: type === "soldermask" ? 0.6 : 1,
  };
}

/**
 * Create a standard 2-layer PCB layer stack.
 */
export function create2LayerStack(): { layers: Map<LayerId, Layer>; stack: LayerStack } {
  const layers = new Map<LayerId, Layer>();

  // Copper layers
  const fCu = createCopperLayer("F.Cu", 0);
  const bCu = createCopperLayer("B.Cu", 1);
  layers.set(fCu.id, fCu);
  layers.set(bCu.id, bCu);

  // Silkscreen
  const fSilk = createLayer("F.SilkS", "silkscreen");
  const bSilk = createLayer("B.SilkS", "silkscreen");
  layers.set(fSilk.id, fSilk);
  layers.set(bSilk.id, bSilk);

  // Soldermask
  const fMask = createLayer("F.Mask", "soldermask");
  const bMask = createLayer("B.Mask", "soldermask");
  layers.set(fMask.id, fMask);
  layers.set(bMask.id, bMask);

  // Paste
  const fPaste = createLayer("F.Paste", "solderpaste");
  const bPaste = createLayer("B.Paste", "solderpaste");
  layers.set(fPaste.id, fPaste);
  layers.set(bPaste.id, bPaste);

  // Mechanical
  const edgeCuts = createLayer("Edge.Cuts", "mechanical");
  layers.set(edgeCuts.id, edgeCuts);

  // Courtyard
  const fCrtYd = createLayer("F.CrtYd", "courtyard");
  const bCrtYd = createLayer("B.CrtYd", "courtyard");
  layers.set(fCrtYd.id, fCrtYd);
  layers.set(bCrtYd.id, bCrtYd);

  // Fabrication
  const fFab = createLayer("F.Fab", "fabrication");
  const bFab = createLayer("B.Fab", "fabrication");
  layers.set(fFab.id, fFab);
  layers.set(bFab.id, bFab);

  const stack: LayerStack = {
    layers: [
      fSilk.id,
      fMask.id,
      fPaste.id,
      fCu.id,
      bCu.id,
      bPaste.id,
      bMask.id,
      bSilk.id,
      edgeCuts.id,
      fCrtYd.id,
      bCrtYd.id,
      fFab.id,
      bFab.id,
    ],
    copperLayers: [fCu.id, bCu.id],
    totalThickness: 1.6, // Standard 1.6mm PCB
  };

  return { layers, stack };
}

/**
 * Create a 4-layer PCB stack.
 */
export function create4LayerStack(): { layers: Map<LayerId, Layer>; stack: LayerStack } {
  const { layers, stack } = create2LayerStack();

  // Add inner layers
  const in1Cu = createCopperLayer("In1.Cu", 1, "signal");
  const in2Cu = createCopperLayer("In2.Cu", 2, "plane"); // Usually ground plane
  layers.set(in1Cu.id, in1Cu);
  layers.set(in2Cu.id, in2Cu);

  // Update bottom copper position
  const bCu = Array.from(layers.values()).find((l) => l.name === "B.Cu");
  if (bCu) {
    layers.set(bCu.id, { ...bCu, stackPosition: 3 });
  }

  // Update copper layers order
  stack.copperLayers = [
    stack.copperLayers[0], // F.Cu
    in1Cu.id,
    in2Cu.id,
    stack.copperLayers[1], // B.Cu
  ];

  stack.totalThickness = 1.6;

  return { layers, stack };
}

// ============================================================================
// Layer Operations
// ============================================================================

/**
 * Toggle layer visibility.
 */
export function toggleLayerVisibility(layer: Layer): Layer {
  return { ...layer, visible: !layer.visible };
}

/**
 * Set layer color.
 */
export function setLayerColor(layer: Layer, color: string): Layer {
  return { ...layer, color };
}

/**
 * Set layer opacity.
 */
export function setLayerOpacity(layer: Layer, opacity: number): Layer {
  return { ...layer, opacity: Math.max(0, Math.min(1, opacity)) };
}

/**
 * Check if a layer is a copper layer.
 */
export function isCopperLayer(layer: Layer): boolean {
  return layer.type === "copper";
}

/**
 * Check if a layer is a top-side layer.
 */
export function isTopLayer(layer: Layer): boolean {
  return layer.name.startsWith("F.");
}

/**
 * Check if a layer is a bottom-side layer.
 */
export function isBottomLayer(layer: Layer): boolean {
  return layer.name.startsWith("B.");
}

/**
 * Get the corresponding layer on the opposite side.
 */
export function getFlippedLayerName(layerName: string): string {
  if (layerName.startsWith("F.")) {
    return "B." + layerName.slice(2);
  }
  if (layerName.startsWith("B.")) {
    return "F." + layerName.slice(2);
  }
  return layerName;
}
