/**
 * Component Library - collection of components, symbols, and footprints.
 */

import {
  ComponentLibraryId,
  ComponentId,
  SymbolId,
  FootprintId,
  Model3dRefId,
  newId,
} from "../id";
import { Symbol } from "../schematic/symbol";
import { Footprint } from "../pcb/footprint";
import { Component, Model3dRef, ComponentCategory } from "./component";

// ============================================================================
// Library Source
// ============================================================================

export type LibrarySource =
  | "builtin" // Built-in with vibeCAD
  | "user" // User-created
  | "community" // Community-shared
  | "kicad" // Imported from KiCad
  | "altium" // Imported from Altium
  | "snapeda" // Downloaded from SnapEDA
  | "lcsc"; // Downloaded from LCSC

// ============================================================================
// Library Metadata
// ============================================================================

export interface LibraryMetadata {
  author?: string;
  license?: string;
  url?: string;
  description?: string;
  version?: string;
  lastUpdated?: number;
}

// ============================================================================
// Component Library
// ============================================================================

export interface ComponentLibrary {
  id: ComponentLibraryId;
  name: string;
  version: string;

  // Contents
  symbols: Map<SymbolId, Symbol>;
  footprints: Map<FootprintId, Footprint>;
  components: Map<ComponentId, Component>;
  models3d: Map<Model3dRefId, Model3dRef>;

  // Source information
  source: LibrarySource;

  // Metadata
  meta: LibraryMetadata;

  // Read-only flag (built-in libraries)
  readOnly: boolean;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new empty library.
 */
export function createComponentLibrary(
  name: string,
  source: LibrarySource = "user"
): ComponentLibrary {
  return {
    id: newId("ComponentLibrary"),
    name,
    version: "1.0.0",
    symbols: new Map(),
    footprints: new Map(),
    components: new Map(),
    models3d: new Map(),
    source,
    meta: {
      lastUpdated: Date.now(),
    },
    readOnly: false,
  };
}

/**
 * Create a built-in library.
 */
export function createBuiltinLibrary(
  name: string,
  description: string
): ComponentLibrary {
  const lib = createComponentLibrary(name, "builtin");
  lib.readOnly = true;
  lib.meta.description = description;
  return lib;
}

// ============================================================================
// Library Operations (Immutable)
// ============================================================================

/**
 * Add a symbol to the library.
 */
export function addSymbolToLibrary(
  library: ComponentLibrary,
  symbol: Symbol
): ComponentLibrary {
  if (library.readOnly) {
    console.warn("Cannot modify read-only library");
    return library;
  }
  const newSymbols = new Map(library.symbols);
  newSymbols.set(symbol.id, symbol);
  return {
    ...library,
    symbols: newSymbols,
    meta: { ...library.meta, lastUpdated: Date.now() },
  };
}

/**
 * Add a footprint to the library.
 */
export function addFootprintToLibrary(
  library: ComponentLibrary,
  footprint: Footprint
): ComponentLibrary {
  if (library.readOnly) {
    console.warn("Cannot modify read-only library");
    return library;
  }
  const newFootprints = new Map(library.footprints);
  newFootprints.set(footprint.id, footprint);
  return {
    ...library,
    footprints: newFootprints,
    meta: { ...library.meta, lastUpdated: Date.now() },
  };
}

/**
 * Add a component to the library.
 */
export function addComponentToLibrary(
  library: ComponentLibrary,
  component: Component
): ComponentLibrary {
  if (library.readOnly) {
    console.warn("Cannot modify read-only library");
    return library;
  }

  // Ensure component references this library
  const updatedComponent = { ...component, libraryId: library.id };

  const newComponents = new Map(library.components);
  newComponents.set(updatedComponent.id, updatedComponent);
  return {
    ...library,
    components: newComponents,
    meta: { ...library.meta, lastUpdated: Date.now() },
  };
}

/**
 * Add a 3D model to the library.
 */
export function addModel3dToLibrary(
  library: ComponentLibrary,
  model: Model3dRef
): ComponentLibrary {
  if (library.readOnly) {
    console.warn("Cannot modify read-only library");
    return library;
  }
  const newModels = new Map(library.models3d);
  newModels.set(model.id, model);
  return {
    ...library,
    models3d: newModels,
    meta: { ...library.meta, lastUpdated: Date.now() },
  };
}

/**
 * Remove a symbol from the library.
 */
export function removeSymbolFromLibrary(
  library: ComponentLibrary,
  symbolId: SymbolId
): ComponentLibrary {
  if (library.readOnly) {
    console.warn("Cannot modify read-only library");
    return library;
  }
  const newSymbols = new Map(library.symbols);
  newSymbols.delete(symbolId);
  return {
    ...library,
    symbols: newSymbols,
    meta: { ...library.meta, lastUpdated: Date.now() },
  };
}

/**
 * Remove a footprint from the library.
 */
export function removeFootprintFromLibrary(
  library: ComponentLibrary,
  footprintId: FootprintId
): ComponentLibrary {
  if (library.readOnly) {
    console.warn("Cannot modify read-only library");
    return library;
  }
  const newFootprints = new Map(library.footprints);
  newFootprints.delete(footprintId);
  return {
    ...library,
    footprints: newFootprints,
    meta: { ...library.meta, lastUpdated: Date.now() },
  };
}

/**
 * Remove a component from the library.
 */
export function removeComponentFromLibrary(
  library: ComponentLibrary,
  componentId: ComponentId
): ComponentLibrary {
  if (library.readOnly) {
    console.warn("Cannot modify read-only library");
    return library;
  }
  const newComponents = new Map(library.components);
  newComponents.delete(componentId);
  return {
    ...library,
    components: newComponents,
    meta: { ...library.meta, lastUpdated: Date.now() },
  };
}

/**
 * Update library metadata.
 */
export function updateLibraryMetadata(
  library: ComponentLibrary,
  meta: Partial<LibraryMetadata>
): ComponentLibrary {
  return {
    ...library,
    meta: { ...library.meta, ...meta, lastUpdated: Date.now() },
  };
}

/**
 * Rename the library.
 */
export function renameLibrary(
  library: ComponentLibrary,
  name: string
): ComponentLibrary {
  return {
    ...library,
    name,
    meta: { ...library.meta, lastUpdated: Date.now() },
  };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Search components by name or keywords.
 */
export function searchComponents(
  library: ComponentLibrary,
  query: string,
  filters?: {
    category?: ComponentCategory;
    hasFootprint?: boolean;
    has3dModel?: boolean;
  }
): Component[] {
  const lowerQuery = query.toLowerCase();

  return Array.from(library.components.values()).filter((comp) => {
    // Text search
    const matchesQuery =
      comp.name.toLowerCase().includes(lowerQuery) ||
      comp.description.toLowerCase().includes(lowerQuery) ||
      comp.keywords.some((k) => k.toLowerCase().includes(lowerQuery)) ||
      comp.mpn?.toLowerCase().includes(lowerQuery) ||
      comp.manufacturer?.toLowerCase().includes(lowerQuery);

    if (!matchesQuery) return false;

    // Apply filters
    if (filters?.category && comp.category !== filters.category) {
      return false;
    }

    if (filters?.hasFootprint && comp.footprints.length === 0) {
      return false;
    }

    if (filters?.has3dModel && comp.models3d.length === 0) {
      return false;
    }

    return true;
  });
}

/**
 * Get all components in a category.
 */
export function getComponentsByCategory(
  library: ComponentLibrary,
  category: ComponentCategory
): Component[] {
  return Array.from(library.components.values()).filter(
    (c) => c.category === category
  );
}

/**
 * Get component by ID.
 */
export function getComponent(
  library: ComponentLibrary,
  componentId: ComponentId
): Component | undefined {
  return library.components.get(componentId);
}

/**
 * Get symbol by ID.
 */
export function getSymbol(
  library: ComponentLibrary,
  symbolId: SymbolId
): Symbol | undefined {
  return library.symbols.get(symbolId);
}

/**
 * Get footprint by ID.
 */
export function getFootprint(
  library: ComponentLibrary,
  footprintId: FootprintId
): Footprint | undefined {
  return library.footprints.get(footprintId);
}

/**
 * Get 3D model by ID.
 */
export function getModel3d(
  library: ComponentLibrary,
  modelId: Model3dRefId
): Model3dRef | undefined {
  return library.models3d.get(modelId);
}

/**
 * Get all categories used in the library.
 */
export function getUsedCategories(library: ComponentLibrary): ComponentCategory[] {
  const categories = new Set<ComponentCategory>();
  for (const comp of library.components.values()) {
    categories.add(comp.category);
  }
  return Array.from(categories).sort();
}

/**
 * Get statistics about the library.
 */
export function getLibraryStats(library: ComponentLibrary): {
  symbolCount: number;
  footprintCount: number;
  componentCount: number;
  model3dCount: number;
} {
  return {
    symbolCount: library.symbols.size,
    footprintCount: library.footprints.size,
    componentCount: library.components.size,
    model3dCount: library.models3d.size,
  };
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize a library to JSON.
 */
export function serializeLibrary(library: ComponentLibrary): string {
  const serializable = {
    ...library,
    symbols: Array.from(library.symbols.entries()).map(([id, sym]) => [
      id,
      {
        ...sym,
        pins: Array.from(sym.pins.entries()),
      },
    ]),
    footprints: Array.from(library.footprints.entries()).map(([id, fp]) => [
      id,
      {
        ...fp,
        pads: Array.from(fp.pads.entries()),
        graphics: Array.from(fp.graphics.entries()),
      },
    ]),
    components: Array.from(library.components.entries()).map(([id, comp]) => [
      id,
      {
        ...comp,
        specs: Array.from(comp.specs.entries()),
      },
    ]),
    models3d: Array.from(library.models3d.entries()),
  };

  return JSON.stringify(serializable, null, 2);
}

/**
 * Deserialize a library from JSON.
 */
export function deserializeLibrary(json: string): ComponentLibrary {
  const data = JSON.parse(json);

  return {
    ...data,
    symbols: new Map(
      data.symbols.map(([id, sym]: [string, any]) => [
        id,
        {
          ...sym,
          pins: new Map(sym.pins),
        },
      ])
    ),
    footprints: new Map(
      data.footprints.map(([id, fp]: [string, any]) => [
        id,
        {
          ...fp,
          pads: new Map(fp.pads),
          graphics: new Map(fp.graphics),
        },
      ])
    ),
    components: new Map(
      data.components.map(([id, comp]: [string, any]) => [
        id,
        {
          ...comp,
          specs: new Map(comp.specs),
        },
      ])
    ),
    models3d: new Map(data.models3d),
  };
}
