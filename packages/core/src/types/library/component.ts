/**
 * Component Library - electronic component definitions linking symbols, footprints, and 3D models.
 */

import {
  ComponentId,
  ComponentLibraryId,
  SymbolId,
  FootprintId,
  Model3dRefId,
  newId,
} from "../id";
import { Vec3 } from "../math";

// ============================================================================
// Component Category
// ============================================================================

export type ComponentCategory =
  | "resistor"
  | "capacitor"
  | "inductor"
  | "diode"
  | "transistor"
  | "ic"
  | "connector"
  | "switch"
  | "relay"
  | "crystal"
  | "transformer"
  | "fuse"
  | "led"
  | "display"
  | "sensor"
  | "module"
  | "mechanical"
  | "power"
  | "rf"
  | "other";

// ============================================================================
// 3D Model Reference
// ============================================================================

export type Model3dSourceType = "vibecad" | "step" | "embedded";

export interface Model3dSource {
  type: Model3dSourceType;
  path?: string; // For vibecad and step types
  data?: string; // Base64 encoded for embedded type
}

export interface Model3dRef {
  id: Model3dRefId;
  name: string;
  source: Model3dSource;

  // Placement offset relative to footprint origin
  offset: Vec3;
  rotation: Vec3; // Euler angles in degrees
  scale: Vec3;
}

// ============================================================================
// Supplier Information
// ============================================================================

export interface SupplierPrice {
  quantity: number;
  price: number; // USD
}

export interface SupplierInfo {
  supplier: string; // "DigiKey", "Mouser", "LCSC", "Arrow", etc.
  partNumber: string;
  url?: string;
  prices?: SupplierPrice[];
  stock?: number;
  leadTime?: string; // e.g., "In Stock", "2 weeks"
  minimumQuantity?: number;
}

// ============================================================================
// Component Specifications
// ============================================================================

export type ComponentSpecs = Map<string, string | number | boolean>;

// Common spec keys:
// - "resistance" (ohms)
// - "capacitance" (farads)
// - "inductance" (henrys)
// - "voltage_rating" (volts)
// - "current_rating" (amps)
// - "power_rating" (watts)
// - "tolerance" (percentage)
// - "package" (e.g., "0805", "TQFP-44")
// - "temperature_coefficient" (e.g., "X7R", "C0G")

// ============================================================================
// Component
// ============================================================================

export interface Component {
  id: ComponentId;

  // Identity
  name: string;
  description: string;
  keywords: string[];

  // Classification
  category: ComponentCategory;
  subcategory?: string; // e.g., "op-amp", "voltage-regulator"

  // Symbols (can have multiple for multi-unit parts like quad op-amp)
  symbols: SymbolId[];
  symbolUnits?: number; // Number of units (e.g., 4 for quad op-amp)

  // Footprints (compatible package options)
  footprints: FootprintId[];
  defaultFootprintId?: FootprintId;

  // 3D models (for each footprint variant)
  models3d: Model3dRef[];

  // Electrical specifications
  specs: ComponentSpecs;

  // Supplier/ordering information
  suppliers: SupplierInfo[];

  // Documentation
  datasheetUrl?: string;

  // Manufacturing
  mpn?: string; // Manufacturer Part Number
  manufacturer?: string;

  // Library membership
  libraryId: ComponentLibraryId;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new component.
 */
export function createComponent(
  name: string,
  category: ComponentCategory,
  libraryId: ComponentLibraryId
): Component {
  return {
    id: newId("Component"),
    name,
    description: "",
    keywords: [],
    category,
    symbols: [],
    footprints: [],
    models3d: [],
    specs: new Map(),
    suppliers: [],
    libraryId,
  };
}

/**
 * Create a 3D model reference.
 */
export function createModel3dRef(
  name: string,
  source: Model3dSource
): Model3dRef {
  return {
    id: newId("Model3dRef"),
    name,
    source,
    offset: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

// ============================================================================
// Component Operations (Immutable)
// ============================================================================

/**
 * Set component description.
 */
export function setComponentDescription(
  component: Component,
  description: string
): Component {
  return { ...component, description };
}

/**
 * Add keywords to component.
 */
export function addComponentKeywords(
  component: Component,
  keywords: string[]
): Component {
  const newKeywords = [...new Set([...component.keywords, ...keywords])];
  return { ...component, keywords: newKeywords };
}

/**
 * Add a symbol to component.
 */
export function addComponentSymbol(
  component: Component,
  symbolId: SymbolId
): Component {
  if (component.symbols.includes(symbolId)) {
    return component;
  }
  return { ...component, symbols: [...component.symbols, symbolId] };
}

/**
 * Add a footprint to component.
 */
export function addComponentFootprint(
  component: Component,
  footprintId: FootprintId
): Component {
  if (component.footprints.includes(footprintId)) {
    return component;
  }
  const updated = { ...component, footprints: [...component.footprints, footprintId] };
  // Set as default if first footprint
  if (!updated.defaultFootprintId) {
    updated.defaultFootprintId = footprintId;
  }
  return updated;
}

/**
 * Set default footprint.
 */
export function setComponentDefaultFootprint(
  component: Component,
  footprintId: FootprintId
): Component {
  if (!component.footprints.includes(footprintId)) {
    return component;
  }
  return { ...component, defaultFootprintId: footprintId };
}

/**
 * Add a 3D model to component.
 */
export function addComponentModel3d(
  component: Component,
  model: Model3dRef
): Component {
  return { ...component, models3d: [...component.models3d, model] };
}

/**
 * Set a specification value.
 */
export function setComponentSpec(
  component: Component,
  key: string,
  value: string | number | boolean
): Component {
  const newSpecs = new Map(component.specs);
  newSpecs.set(key, value);
  return { ...component, specs: newSpecs };
}

/**
 * Add supplier information.
 */
export function addComponentSupplier(
  component: Component,
  supplier: SupplierInfo
): Component {
  return { ...component, suppliers: [...component.suppliers, supplier] };
}

/**
 * Set datasheet URL.
 */
export function setComponentDatasheet(
  component: Component,
  url: string
): Component {
  return { ...component, datasheetUrl: url };
}

/**
 * Set manufacturer info.
 */
export function setComponentManufacturer(
  component: Component,
  manufacturer: string,
  mpn?: string
): Component {
  return { ...component, manufacturer, mpn };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get best price for a quantity.
 */
export function getBestPrice(
  component: Component,
  quantity: number
): { supplier: string; price: number; unitPrice: number } | null {
  let best: { supplier: string; price: number; unitPrice: number } | null = null;

  for (const supplier of component.suppliers) {
    if (!supplier.prices || supplier.prices.length === 0) continue;

    // Find the best price tier for this quantity
    let applicablePrice: SupplierPrice | null = null;
    for (const tier of supplier.prices) {
      if (quantity >= tier.quantity) {
        if (!applicablePrice || tier.price < applicablePrice.price) {
          applicablePrice = tier;
        }
      }
    }

    if (applicablePrice) {
      const totalPrice = applicablePrice.price * quantity;
      if (!best || totalPrice < best.price) {
        best = {
          supplier: supplier.supplier,
          price: totalPrice,
          unitPrice: applicablePrice.price,
        };
      }
    }
  }

  return best;
}

/**
 * Check if component has stock at any supplier.
 */
export function hasStock(component: Component): boolean {
  return component.suppliers.some((s) => s.stock !== undefined && s.stock > 0);
}

/**
 * Get total available stock across all suppliers.
 */
export function getTotalStock(component: Component): number {
  return component.suppliers.reduce((sum, s) => sum + (s.stock || 0), 0);
}

/**
 * Find suppliers with stock.
 */
export function getSuppliersWithStock(component: Component): SupplierInfo[] {
  return component.suppliers.filter((s) => s.stock !== undefined && s.stock > 0);
}

/**
 * Get LCSC part number if available.
 */
export function getLcscPartNumber(component: Component): string | undefined {
  const lcsc = component.suppliers.find(
    (s) => s.supplier.toLowerCase() === "lcsc"
  );
  return lcsc?.partNumber;
}
