/**
 * Library Index Service
 *
 * Manages the component index for fast searching.
 * The index is pre-built from KiCad library files and cached to disk.
 */

import fs from "fs/promises";
import path from "path";
import {
  library,
} from "@vibecad/core";

const {
  parseKicadSymbolLibrary,
  parseKicadFootprint,
} = library;

// ============================================================================
// Types
// ============================================================================

export interface ComponentIndexEntry {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  category: string;
  symbolFile: string;
  symbolName: string;
  footprintFiles: string[];
  defaultFootprint?: string;
  package?: string;
}

export interface CategoryNode {
  id: string;
  name: string;
  count: number;
  children: CategoryNode[];
}

export interface LibraryIndex {
  version: string;
  lastUpdated: number;
  components: ComponentIndexEntry[];
  categories: Record<string, string[]>; // category -> component IDs
  symbolFiles: string[];
  footprintLibraries: string[];
}

export interface SearchQuery {
  text?: string;
  category?: string;
  package?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  totalCount: number;
  components: ComponentIndexEntry[];
  hasMore: boolean;
}

// ============================================================================
// Category Detection
// ============================================================================

const CATEGORY_PATTERNS: Array<[RegExp, string]> = [
  [/\b(led|light.?emit|indicator)\b/i, "led"],
  [/\b(resistor|res|ohm)\b/i, "resistor"],
  [/\b(capacitor|cap|farad)\b/i, "capacitor"],
  [/\b(inductor|coil|choke|henry)\b/i, "inductor"],
  [/\b(diode|rectifier|schottky|zener)\b/i, "diode"],
  [/\b(transistor|mosfet|jfet|bjt|npn|pnp)\b/i, "transistor"],
  [/\b(op.?amp|comparator|amplifier|adc|dac|mcu|microcontroller|cpu|fpga|memory|eeprom|flash|ic|chip)\b/i, "ic"],
  [/\b(connector|header|socket|jack|plug|usb|hdmi|rj45|barrel)\b/i, "connector"],
  [/\b(switch|button|pushbutton|toggle|dip.?switch)\b/i, "switch"],
  [/\b(relay)\b/i, "relay"],
  [/\b(crystal|oscillator|resonator)\b/i, "crystal"],
  [/\b(transformer)\b/i, "transformer"],
  [/\b(fuse|ptc|polyfuse)\b/i, "fuse"],
  [/\b(display|lcd|oled|segment|screen)\b/i, "display"],
  [/\b(sensor|thermistor|photodiode|accelerometer|gyro)\b/i, "sensor"],
  [/\b(module|board|breakout)\b/i, "module"],
  [/\b(mount|standoff|screw|mechanical)\b/i, "mechanical"],
  [/\b(power|regulator|vreg|ldo|dcdc|pwr|gnd|vcc|vdd)\b/i, "power"],
  [/\b(rf|antenna|balun|filter|sma)\b/i, "rf"],
];

function detectCategory(name: string, description: string, keywords: string[]): string {
  const text = `${name} ${description} ${keywords.join(" ")}`;

  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(text)) {
      return category;
    }
  }

  return "other";
}

function extractPackage(name: string): string | undefined {
  // Common patterns: R_0805, C_0402, TQFP-44, SOT-23, etc.
  const match = name.match(/([A-Z]+[-_]?\d+[-_]?\d*)/i);
  return match ? match[1] : undefined;
}

const CATEGORY_NAMES: Record<string, string> = {
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

// ============================================================================
// Library Index Service
// ============================================================================

export class LibraryIndexService {
  private libraryPath: string;
  private indexPath: string;
  private index: LibraryIndex | null = null;

  constructor(libraryPath: string, indexPath: string) {
    this.libraryPath = libraryPath;
    this.indexPath = indexPath;
  }

  async initialize(): Promise<void> {
    // Try to load cached index
    try {
      const cached = await fs.readFile(this.indexPath, "utf-8");
      this.index = JSON.parse(cached);
      console.log(`Loaded index with ${this.index!.components.length} components`);
    } catch {
      // No cached index, create empty one
      console.log("No cached index found, creating empty index");
      this.index = {
        version: "1.0.0",
        lastUpdated: Date.now(),
        components: [],
        categories: {},
        symbolFiles: [],
        footprintLibraries: [],
      };
    }
  }

  getIndex(): LibraryIndex {
    if (!this.index) {
      throw new Error("Index not initialized");
    }
    return this.index;
  }

  /**
   * Build index from KiCad library files.
   * This should be run as a build step, not at runtime.
   */
  async buildIndex(): Promise<void> {
    console.log("Building library index...");

    const components: ComponentIndexEntry[] = [];
    const categories: Record<string, string[]> = {};
    const symbolFiles: string[] = [];
    const footprintLibraries: string[] = [];

    // Scan symbol files
    const symbolsDir = path.join(this.libraryPath, "symbols");
    try {
      const symbolDirEntries = await fs.readdir(symbolsDir);

      for (const entry of symbolDirEntries) {
        if (!entry.endsWith(".kicad_sym")) continue;

        symbolFiles.push(entry);
        console.log(`Processing symbol library: ${entry}`);

        try {
          const content = await fs.readFile(path.join(symbolsDir, entry), "utf-8");
          const kicadLib = parseKicadSymbolLibrary(content);

          for (const symbol of kicadLib.symbols) {
            // Skip symbols that extend other symbols
            if (symbol.extendsSymbol) continue;

            const description = symbol.properties.get("Description")?.value || "";
            const keywordsStr = symbol.properties.get("ki_keywords")?.value || "";
            const keywords = keywordsStr.split(/\s+/).filter(k => k);

            const category = detectCategory(symbol.name, description, keywords);
            const id = `${entry}:${symbol.name}`;

            const component: ComponentIndexEntry = {
              id,
              name: symbol.name,
              description,
              keywords,
              category,
              symbolFile: entry,
              symbolName: symbol.name,
              footprintFiles: [],
            };

            components.push(component);

            // Add to category index
            if (!categories[category]) {
              categories[category] = [];
            }
            categories[category].push(id);
          }
        } catch (err) {
          console.error(`Failed to parse ${entry}:`, err);
        }
      }
    } catch {
      console.log("No symbols directory found");
    }

    // Scan footprint directories
    const footprintsDir = path.join(this.libraryPath, "footprints");
    try {
      const fpDirEntries = await fs.readdir(footprintsDir);

      for (const libDir of fpDirEntries) {
        if (!libDir.endsWith(".pretty")) continue;

        footprintLibraries.push(libDir);

        const fpPath = path.join(footprintsDir, libDir);
        const fpFiles = await fs.readdir(fpPath);

        for (const fpFile of fpFiles) {
          if (!fpFile.endsWith(".kicad_mod")) continue;

          try {
            const content = await fs.readFile(path.join(fpPath, fpFile), "utf-8");
            const kicadFp = parseKicadFootprint(content);

            // Try to match footprint to component by name similarity
            const fpName = kicadFp.name.toLowerCase();
            const packageName = extractPackage(kicadFp.name);

            for (const component of components) {
              const compName = component.name.toLowerCase();

              // Match if footprint name contains component name patterns
              if (fpName.includes(compName.split("_")[0]) ||
                  (component.keywords.some(k => fpName.includes(k.toLowerCase())))) {
                component.footprintFiles.push(`${libDir}/${fpFile}`);
                if (!component.defaultFootprint) {
                  component.defaultFootprint = `${libDir}/${fpFile}`;
                }
                if (packageName && !component.package) {
                  component.package = packageName;
                }
              }
            }
          } catch (err) {
            // Skip unparseable footprints
          }
        }
      }
    } catch {
      console.log("No footprints directory found");
    }

    this.index = {
      version: "1.0.0",
      lastUpdated: Date.now(),
      components,
      categories,
      symbolFiles,
      footprintLibraries,
    };

    // Save index to disk
    await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
    await fs.writeFile(this.indexPath, JSON.stringify(this.index, null, 2));

    console.log(`Index built: ${components.length} components in ${Object.keys(categories).length} categories`);
  }

  search(query: SearchQuery): SearchResult {
    if (!this.index) {
      return { totalCount: 0, components: [], hasMore: false };
    }

    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const searchText = query.text?.toLowerCase() || "";

    let results = this.index.components.filter(component => {
      // Category filter
      if (query.category && component.category !== query.category) {
        return false;
      }

      // Package filter
      if (query.package && component.package !== query.package) {
        return false;
      }

      // Text search
      if (searchText) {
        const searchable = `${component.name} ${component.description} ${component.keywords.join(" ")}`.toLowerCase();
        if (!searchable.includes(searchText)) {
          return false;
        }
      }

      return true;
    });

    const totalCount = results.length;
    results = results.slice(offset, offset + limit);

    return {
      totalCount,
      components: results,
      hasMore: offset + results.length < totalCount,
    };
  }

  getComponentsByCategory(category: string, limit = 50, offset = 0): SearchResult {
    return this.search({ category, limit, offset });
  }

  getCategoryTree(): CategoryNode[] {
    if (!this.index) return [];

    const nodes: CategoryNode[] = [];

    for (const [category, componentIds] of Object.entries(this.index.categories)) {
      nodes.push({
        id: category,
        name: CATEGORY_NAMES[category] || category,
        count: componentIds.length,
        children: [],
      });
    }

    // Sort by name
    nodes.sort((a, b) => a.name.localeCompare(b.name));

    return nodes;
  }

  getStats(): {
    componentCount: number;
    categoryCount: number;
    symbolFileCount: number;
    footprintLibraryCount: number;
  } {
    if (!this.index) {
      return {
        componentCount: 0,
        categoryCount: 0,
        symbolFileCount: 0,
        footprintLibraryCount: 0,
      };
    }

    return {
      componentCount: this.index.components.length,
      categoryCount: Object.keys(this.index.categories).length,
      symbolFileCount: this.index.symbolFiles.length,
      footprintLibraryCount: this.index.footprintLibraries.length,
    };
  }
}
