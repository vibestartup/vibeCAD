/**
 * KiCad Library Provider
 *
 * Implements the LibraryProvider interface for KiCad libraries.
 * Supports loading from:
 * - Local files (.kicad_sym, .kicad_mod)
 * - Remote server (for pre-indexed KiCad libraries)
 *
 * The provider uses lazy loading - symbols and footprints are only
 * fully parsed when requested.
 */

import {
  LibraryProvider,
  LibraryProviderType,
  LibraryInfo,
  LibraryCategoryNode,
  ComponentSearchQuery,
  ComponentSearchResult,
  ComponentSummary,
} from "../provider";
import {
  parseKicadSymbolLibrary,
  convertKicadSymbolsToVibecad,
  KicadSymbolLibrary,
  KicadSymbol,
} from "./symbol-parser";
import {
  parseKicadFootprint,
  convertKicadFootprintToVibecad,
  KicadFootprint,
  LayerResolver,
  KICAD_LAYER_MAP,
} from "./footprint-parser";
import { Symbol } from "../../types/schematic/symbol";
import { Footprint } from "../../types/pcb/footprint";
import { Component, ComponentCategory, createComponent, setComponentDescription, addComponentKeywords } from "../../types/library/component";
import { ComponentLibraryId, SymbolId, FootprintId, ComponentId, LayerId, newId } from "../../types/id";

// ============================================================================
// Types
// ============================================================================

/**
 * Index entry for a symbol in a library.
 * Used for search without loading full symbol data.
 */
export interface SymbolIndexEntry {
  id: SymbolId;
  name: string;
  description: string;
  keywords: string[];
  refDesPrefix: string;
  category: ComponentCategory;
  libraryFile: string;
}

/**
 * Index entry for a footprint.
 */
export interface FootprintIndexEntry {
  id: FootprintId;
  name: string;
  description: string;
  keywords: string[];
  package: string;
  libraryFile: string;
}

/**
 * Component index entry (symbol + footprint mapping).
 */
export interface ComponentIndexEntry {
  id: ComponentId;
  name: string;
  description: string;
  keywords: string[];
  category: ComponentCategory;
  symbolId: SymbolId;
  footprintIds: FootprintId[];
  defaultFootprintId?: FootprintId;
}

/**
 * Library index for fast searching.
 */
export interface KicadLibraryIndex {
  libraryId: ComponentLibraryId;
  name: string;
  version: string;
  symbols: Map<SymbolId, SymbolIndexEntry>;
  footprints: Map<FootprintId, FootprintIndexEntry>;
  components: Map<ComponentId, ComponentIndexEntry>;
  categories: Map<ComponentCategory, ComponentId[]>;
  lastUpdated: number;
}

/**
 * Configuration for KiCad provider.
 */
export interface KicadProviderConfig {
  /** Base URL for library server (if using remote) */
  serverUrl?: string;
  /** Layer ID resolver */
  layerResolver: LayerResolver;
  /** Whether to use server for heavy files */
  useServer?: boolean;
}

// ============================================================================
// Category Detection
// ============================================================================

/**
 * Detect component category from name/description/keywords.
 */
function detectCategory(name: string, description: string, keywords: string[]): ComponentCategory {
  const text = `${name} ${description} ${keywords.join(" ")}`.toLowerCase();

  // Order matters - more specific matches first
  if (/\b(led|light.?emit|indicator)\b/.test(text)) return "led";
  if (/\b(resistor|res|ohm)\b/.test(text)) return "resistor";
  if (/\b(capacitor|cap|farad)\b/.test(text)) return "capacitor";
  if (/\b(inductor|coil|choke|henry)\b/.test(text)) return "inductor";
  if (/\b(diode|rectifier|schottky|zener)\b/.test(text)) return "diode";
  if (/\b(transistor|mosfet|jfet|bjt|npn|pnp)\b/.test(text)) return "transistor";
  if (/\b(op.?amp|comparator|amplifier|adc|dac|mcu|microcontroller|cpu|fpga|memory|eeprom|flash|ic|chip)\b/.test(text)) return "ic";
  if (/\b(connector|header|socket|jack|plug|usb|hdmi|rj45|barrel)\b/.test(text)) return "connector";
  if (/\b(switch|button|pushbutton|toggle|dip.?switch)\b/.test(text)) return "switch";
  if (/\b(relay)\b/.test(text)) return "relay";
  if (/\b(crystal|oscillator|resonator)\b/.test(text)) return "crystal";
  if (/\b(transformer|inductor.?coupled)\b/.test(text)) return "transformer";
  if (/\b(fuse|ptc|polyfuse)\b/.test(text)) return "fuse";
  if (/\b(display|lcd|oled|segment|screen)\b/.test(text)) return "display";
  if (/\b(sensor|thermistor|photodiode|accelerometer|gyro)\b/.test(text)) return "sensor";
  if (/\b(module|board|breakout)\b/.test(text)) return "module";
  if (/\b(mount|standoff|screw|mechanical)\b/.test(text)) return "mechanical";
  if (/\b(power|regulator|vreg|ldo|dcdc|pwr|gnd|vcc|vdd)\b/.test(text)) return "power";
  if (/\b(rf|antenna|balun|filter|sma)\b/.test(text)) return "rf";

  return "other";
}

/**
 * Extract package name from footprint name.
 */
function extractPackage(name: string): string {
  // Common patterns: R_0805, C_0402, TQFP-44, SOT-23, etc.
  const match = name.match(/([A-Z]+[-_]?\d+[-_]?\d*)/i);
  return match ? match[1] : name.split("_")[0];
}

// ============================================================================
// KiCad Library Provider
// ============================================================================

export class KicadLibraryProvider implements LibraryProvider {
  readonly id: string;
  readonly name: string;
  readonly type: LibraryProviderType = "kicad";
  readonly requiresNetwork: boolean;
  readonly readOnly = true;

  private config: KicadProviderConfig;
  private index: KicadLibraryIndex | null = null;
  private ready = false;

  // Caches for loaded data
  private symbolCache = new Map<SymbolId, Symbol>();
  private footprintCache = new Map<FootprintId, Footprint>();
  private componentCache = new Map<ComponentId, Component>();

  // Raw KiCad data cache (for lazy parsing)
  private rawSymbolLibraries = new Map<string, KicadSymbolLibrary>();
  private rawFootprints = new Map<string, KicadFootprint>();

  constructor(id: string, name: string, config: KicadProviderConfig) {
    this.id = id;
    this.name = name;
    this.config = config;
    this.requiresNetwork = !!config.serverUrl && !!config.useServer;
  }

  // ========================================
  // Initialization
  // ========================================

  async initialize(): Promise<void> {
    if (this.ready) return;

    if (this.config.serverUrl && this.config.useServer) {
      // Load index from server
      await this.loadIndexFromServer();
    } else {
      // Create empty index (will be populated as files are loaded)
      this.index = this.createEmptyIndex();
    }

    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  dispose(): void {
    this.symbolCache.clear();
    this.footprintCache.clear();
    this.componentCache.clear();
    this.rawSymbolLibraries.clear();
    this.rawFootprints.clear();
    this.index = null;
    this.ready = false;
  }

  private createEmptyIndex(): KicadLibraryIndex {
    return {
      libraryId: newId("ComponentLibrary") as ComponentLibraryId,
      name: this.name,
      version: "1.0.0",
      symbols: new Map(),
      footprints: new Map(),
      components: new Map(),
      categories: new Map(),
      lastUpdated: Date.now(),
    };
  }

  private async loadIndexFromServer(): Promise<void> {
    if (!this.config.serverUrl) {
      throw new Error("Server URL not configured");
    }

    const response = await fetch(`${this.config.serverUrl}/api/libraries/kicad/index`);
    if (!response.ok) {
      throw new Error(`Failed to load index: ${response.statusText}`);
    }

    const data = await response.json();
    this.index = this.deserializeIndex(data);
  }

  private deserializeIndex(data: any): KicadLibraryIndex {
    // Convert object entries to typed maps
    const symbolEntries = Object.entries(data.symbols || {}) as Array<[string, SymbolIndexEntry]>;
    const footprintEntries = Object.entries(data.footprints || {}) as Array<[string, FootprintIndexEntry]>;
    const componentEntries = Object.entries(data.components || {}) as Array<[string, ComponentIndexEntry]>;
    const categoryEntries = Object.entries(data.categories || {}) as Array<[string, ComponentId[]]>;

    return {
      libraryId: data.libraryId,
      name: data.name,
      version: data.version,
      symbols: new Map(symbolEntries.map(([k, v]) => [k as SymbolId, v])),
      footprints: new Map(footprintEntries.map(([k, v]) => [k as FootprintId, v])),
      components: new Map(componentEntries.map(([k, v]) => [k as ComponentId, v])),
      categories: new Map(categoryEntries.map(([k, v]) => [k as ComponentCategory, v])),
      lastUpdated: data.lastUpdated || Date.now(),
    };
  }

  // ========================================
  // Loading from Files
  // ========================================

  /**
   * Load a symbol library file.
   */
  async loadSymbolLibrary(content: string, filename: string): Promise<SymbolId[]> {
    const kicadLib = parseKicadSymbolLibrary(content);
    this.rawSymbolLibraries.set(filename, kicadLib);

    const symbolIds: SymbolId[] = [];

    for (const kicadSymbol of kicadLib.symbols) {
      // Skip symbols that extend other symbols (they're handled as part of parent)
      if (kicadSymbol.extendsSymbol) continue;

      const symbolId = newId("Symbol") as SymbolId;
      const description = kicadSymbol.properties.get("Description")?.value || "";
      const keywords = kicadSymbol.properties.get("ki_keywords")?.value?.split(/\s+/) || [];
      const refDesPrefix = kicadSymbol.properties.get("Reference")?.value || "U";

      const category = detectCategory(kicadSymbol.name, description, keywords);

      // Add to index
      const indexEntry: SymbolIndexEntry = {
        id: symbolId,
        name: kicadSymbol.name,
        description,
        keywords,
        refDesPrefix,
        category,
        libraryFile: filename,
      };

      this.index!.symbols.set(symbolId, indexEntry);

      // Create component entry
      const componentId = newId("Component") as ComponentId;
      const componentEntry: ComponentIndexEntry = {
        id: componentId,
        name: kicadSymbol.name,
        description,
        keywords,
        category,
        symbolId,
        footprintIds: [],
      };

      this.index!.components.set(componentId, componentEntry);

      // Add to category index
      const categoryComponents = this.index!.categories.get(category) || [];
      categoryComponents.push(componentId);
      this.index!.categories.set(category, categoryComponents);

      symbolIds.push(symbolId);
    }

    return symbolIds;
  }

  /**
   * Load a footprint file.
   */
  async loadFootprint(content: string, filename: string): Promise<FootprintId> {
    const kicadFootprint = parseKicadFootprint(content);
    this.rawFootprints.set(filename, kicadFootprint);

    const footprintId = newId("Footprint") as FootprintId;
    const description = kicadFootprint.description || "";
    const keywords = kicadFootprint.tags || [];
    const packageName = extractPackage(kicadFootprint.name);

    // Add to index
    const indexEntry: FootprintIndexEntry = {
      id: footprintId,
      name: kicadFootprint.name,
      description,
      keywords,
      package: packageName,
      libraryFile: filename,
    };

    this.index!.footprints.set(footprintId, indexEntry);

    return footprintId;
  }

  /**
   * Link a footprint to a component.
   */
  linkFootprintToComponent(componentId: ComponentId, footprintId: FootprintId, isDefault = false): void {
    const component = this.index!.components.get(componentId);
    if (!component) return;

    if (!component.footprintIds.includes(footprintId)) {
      component.footprintIds.push(footprintId);
    }

    if (isDefault || !component.defaultFootprintId) {
      component.defaultFootprintId = footprintId;
    }
  }

  // ========================================
  // Library Discovery
  // ========================================

  async getLibraries(): Promise<LibraryInfo[]> {
    if (!this.index) return [];

    return [{
      id: this.index.libraryId,
      providerId: this.id,
      name: this.index.name,
      description: `KiCad library: ${this.name}`,
      version: this.index.version,
      componentCount: this.index.components.size,
      symbolCount: this.index.symbols.size,
      footprintCount: this.index.footprints.size,
      lastUpdated: this.index.lastUpdated,
    }];
  }

  async getCategoryTree(): Promise<LibraryCategoryNode[]> {
    if (!this.index) return [];

    const categories: LibraryCategoryNode[] = [];

    for (const [category, componentIds] of this.index.categories) {
      categories.push({
        id: category,
        name: this.formatCategoryName(category),
        category,
        componentCount: componentIds.length,
        children: [],
      });
    }

    // Sort by name
    categories.sort((a, b) => a.name.localeCompare(b.name));

    return categories;
  }

  private formatCategoryName(category: ComponentCategory): string {
    const names: Record<ComponentCategory, string> = {
      resistor: "Resistors",
      capacitor: "Capacitors",
      inductor: "Inductors",
      diode: "Diodes",
      transistor: "Transistors",
      ic: "Integrated Circuits",
      connector: "Connectors",
      switch: "Switches",
      relay: "Relays",
      crystal: "Crystals & Oscillators",
      transformer: "Transformers",
      fuse: "Fuses",
      led: "LEDs",
      display: "Displays",
      sensor: "Sensors",
      module: "Modules",
      mechanical: "Mechanical",
      power: "Power",
      rf: "RF Components",
      other: "Other",
    };
    return names[category] || category;
  }

  // ========================================
  // Search
  // ========================================

  async search(query: ComponentSearchQuery): Promise<ComponentSearchResult> {
    if (!this.index) {
      return { totalCount: 0, components: [], hasMore: false };
    }

    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const searchText = query.text?.toLowerCase() || "";

    let results: ComponentSummary[] = [];

    for (const [componentId, entry] of this.index.components) {
      // Category filter
      if (query.category && entry.category !== query.category) continue;
      if (query.categories && !query.categories.includes(entry.category)) continue;

      // Footprint filter
      if (query.hasFootprint && entry.footprintIds.length === 0) continue;

      // Text search
      if (searchText) {
        const searchable = `${entry.name} ${entry.description} ${entry.keywords.join(" ")}`.toLowerCase();
        if (!searchable.includes(searchText)) continue;
      }

      // Package filter
      if (query.package) {
        const hasMatchingPackage = entry.footprintIds.some(fpId => {
          const fp = this.index!.footprints.get(fpId);
          return fp && fp.package.toLowerCase().includes(query.package!.toLowerCase());
        });
        if (!hasMatchingPackage) continue;
      }

      // Get package from default footprint
      let packageName: string | undefined;
      if (entry.defaultFootprintId) {
        const fp = this.index.footprints.get(entry.defaultFootprintId);
        packageName = fp?.package;
      }

      results.push({
        id: componentId,
        libraryId: this.index.libraryId,
        providerId: this.id,
        name: entry.name,
        description: entry.description,
        category: entry.category,
        package: packageName,
        detailsLoaded: this.componentCache.has(componentId),
      });
    }

    const totalCount = results.length;

    // Apply pagination
    results = results.slice(offset, offset + limit);

    return {
      totalCount,
      components: results,
      hasMore: offset + results.length < totalCount,
    };
  }

  async getComponentsByCategory(
    category: ComponentCategory,
    _subcategory?: string,
    limit = 50,
    offset = 0
  ): Promise<ComponentSearchResult> {
    return this.search({ category, limit, offset });
  }

  // ========================================
  // Component Access
  // ========================================

  async getComponent(componentId: ComponentId): Promise<Component | null> {
    // Check cache first
    if (this.componentCache.has(componentId)) {
      return this.componentCache.get(componentId)!;
    }

    if (!this.index) return null;

    const entry = this.index.components.get(componentId);
    if (!entry) return null;

    // Create component
    const component = createComponent(entry.name, entry.category, this.index.libraryId);
    const updated = {
      ...setComponentDescription(component, entry.description),
      id: componentId,
      keywords: entry.keywords,
      symbols: [entry.symbolId],
      footprints: entry.footprintIds,
      defaultFootprintId: entry.defaultFootprintId,
    };

    this.componentCache.set(componentId, updated);
    return updated;
  }

  async getSymbol(symbolId: SymbolId): Promise<Symbol | null> {
    // Check cache first
    if (this.symbolCache.has(symbolId)) {
      return this.symbolCache.get(symbolId)!;
    }

    if (!this.index) return null;

    const entry = this.index.symbols.get(symbolId);
    if (!entry) return null;

    // Load and parse the symbol
    const symbol = await this.loadSymbolFromFile(entry);
    if (symbol) {
      // Override the ID with our indexed ID
      const symbolWithId = { ...symbol, id: symbolId };
      this.symbolCache.set(symbolId, symbolWithId);
      return symbolWithId;
    }

    return null;
  }

  private async loadSymbolFromFile(entry: SymbolIndexEntry): Promise<Symbol | null> {
    // Check if we have the raw library cached
    let kicadLib = this.rawSymbolLibraries.get(entry.libraryFile);

    if (!kicadLib && this.config.serverUrl && this.config.useServer) {
      // Fetch from server
      const response = await fetch(
        `${this.config.serverUrl}/api/libraries/kicad/symbol/${encodeURIComponent(entry.libraryFile)}`
      );
      if (!response.ok) return null;

      const content = await response.text();
      kicadLib = parseKicadSymbolLibrary(content);
      this.rawSymbolLibraries.set(entry.libraryFile, kicadLib);
    }

    if (!kicadLib) return null;

    // Find the symbol by name
    const kicadSymbol = kicadLib.symbols.find(s => s.name === entry.name);
    if (!kicadSymbol) return null;

    // Convert to vibeCAD format
    const symbols = convertKicadSymbolsToVibecad({ ...kicadLib, symbols: [kicadSymbol] });
    return symbols[0] || null;
  }

  async getFootprint(footprintId: FootprintId): Promise<Footprint | null> {
    // Check cache first
    if (this.footprintCache.has(footprintId)) {
      return this.footprintCache.get(footprintId)!;
    }

    if (!this.index) return null;

    const entry = this.index.footprints.get(footprintId);
    if (!entry) return null;

    // Load and parse the footprint
    const footprint = await this.loadFootprintFromFile(entry);
    if (footprint) {
      // Override the ID with our indexed ID
      const footprintWithId = { ...footprint, id: footprintId };
      this.footprintCache.set(footprintId, footprintWithId);
      return footprintWithId;
    }

    return null;
  }

  private async loadFootprintFromFile(entry: FootprintIndexEntry): Promise<Footprint | null> {
    // Check if we have the raw footprint cached
    let kicadFootprint = this.rawFootprints.get(entry.libraryFile);

    if (!kicadFootprint && this.config.serverUrl && this.config.useServer) {
      // Fetch from server
      const response = await fetch(
        `${this.config.serverUrl}/api/libraries/kicad/footprint/${encodeURIComponent(entry.libraryFile)}`
      );
      if (!response.ok) return null;

      const content = await response.text();
      kicadFootprint = parseKicadFootprint(content);
      this.rawFootprints.set(entry.libraryFile, kicadFootprint);
    }

    if (!kicadFootprint) return null;

    // Convert to vibeCAD format
    return convertKicadFootprintToVibecad(kicadFootprint, this.config.layerResolver);
  }

  async getComponentSymbol(componentId: ComponentId): Promise<Symbol | null> {
    const entry = this.index?.components.get(componentId);
    if (!entry) return null;
    return this.getSymbol(entry.symbolId);
  }

  async getComponentFootprint(componentId: ComponentId): Promise<Footprint | null> {
    const entry = this.index?.components.get(componentId);
    if (!entry?.defaultFootprintId) return null;
    return this.getFootprint(entry.defaultFootprintId);
  }

  async getComponentFootprints(componentId: ComponentId): Promise<Footprint[]> {
    const entry = this.index?.components.get(componentId);
    if (!entry) return [];

    const footprints: Footprint[] = [];
    for (const fpId of entry.footprintIds) {
      const fp = await this.getFootprint(fpId);
      if (fp) footprints.push(fp);
    }
    return footprints;
  }

  // ========================================
  // Bulk Operations
  // ========================================

  async preloadComponents(componentIds: ComponentId[]): Promise<ComponentId[]> {
    const loaded: ComponentId[] = [];

    for (const id of componentIds) {
      const component = await this.getComponent(id);
      if (component) loaded.push(id);
    }

    return loaded;
  }

  async getComponentsBatch(componentIds: ComponentId[]): Promise<Map<ComponentId, Component>> {
    const result = new Map<ComponentId, Component>();

    for (const id of componentIds) {
      const component = await this.getComponent(id);
      if (component) result.set(id, component);
    }

    return result;
  }

  // ========================================
  // Index Management
  // ========================================

  /**
   * Get the current index (for serialization/caching).
   */
  getIndex(): KicadLibraryIndex | null {
    return this.index;
  }

  /**
   * Set the index (for loading from cache).
   */
  setIndex(index: KicadLibraryIndex): void {
    this.index = index;
  }

  /**
   * Serialize the index to JSON for caching.
   */
  serializeIndex(): string {
    if (!this.index) return "{}";

    return JSON.stringify({
      libraryId: this.index.libraryId,
      name: this.index.name,
      version: this.index.version,
      symbols: Object.fromEntries(this.index.symbols),
      footprints: Object.fromEntries(this.index.footprints),
      components: Object.fromEntries(this.index.components),
      categories: Object.fromEntries(this.index.categories),
      lastUpdated: this.index.lastUpdated,
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a KiCad library provider.
 */
export function createKicadProvider(
  name: string,
  config: KicadProviderConfig
): KicadLibraryProvider {
  const id = `kicad-${name.toLowerCase().replace(/\s+/g, "-")}`;
  return new KicadLibraryProvider(id, name, config);
}
