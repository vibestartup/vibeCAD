/**
 * Library Provider - Abstract interface for component library sources.
 *
 * This abstraction allows vibeCAD to support multiple library sources:
 * - KiCad libraries (local .kicad_sym/.kicad_mod files)
 * - LCSC (API-based, with supply chain integration)
 * - SnapEDA (API-based)
 * - User-created libraries
 * - Built-in libraries
 */

import { Symbol } from "../types/schematic/symbol";
import { Footprint } from "../types/pcb/footprint";
import { Component, ComponentCategory } from "../types/library/component";
import { ComponentLibraryId, SymbolId, FootprintId, ComponentId } from "../types/id";

// ============================================================================
// Library Provider Types
// ============================================================================

/**
 * Identifies the type of library provider.
 */
export type LibraryProviderType =
  | "builtin"    // Built-in components shipped with vibeCAD
  | "kicad"      // KiCad library files (.kicad_sym, .kicad_mod)
  | "lcsc"       // LCSC/JLCPCB parts database (API)
  | "snapeda"    // SnapEDA component search (API)
  | "octopart"   // Octopart aggregator (API)
  | "user"       // User-created local libraries
  | "community"; // Community-shared libraries

/**
 * Search query for components.
 */
export interface ComponentSearchQuery {
  /** Text query (searches name, description, keywords, MPN) */
  text?: string;
  /** Filter by category */
  category?: ComponentCategory;
  /** Filter by categories */
  categories?: ComponentCategory[];
  /** Must have footprint */
  hasFootprint?: boolean;
  /** Must have 3D model */
  has3dModel?: boolean;
  /** Must have stock available (for API providers) */
  hasStock?: boolean;
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Manufacturer filter */
  manufacturer?: string;
  /** Package/footprint filter (e.g., "0805", "TQFP-44") */
  package?: string;
}

/**
 * Result of a component search.
 */
export interface ComponentSearchResult {
  /** Total number of matches (may be more than returned) */
  totalCount: number;
  /** Components matching the search */
  components: ComponentSummary[];
  /** Whether more results are available */
  hasMore: boolean;
}

/**
 * Lightweight summary of a component (for search results).
 */
export interface ComponentSummary {
  id: ComponentId;
  libraryId: ComponentLibraryId;
  providerId: string;
  name: string;
  description: string;
  category: ComponentCategory;
  /** Preview image URL or data URI */
  thumbnailUrl?: string;
  /** Manufacturer Part Number */
  mpn?: string;
  manufacturer?: string;
  /** Package name (e.g., "0805", "TQFP-44") */
  package?: string;
  /** Whether full details are loaded */
  detailsLoaded: boolean;
}

/**
 * Category tree node for hierarchical browsing.
 */
export interface LibraryCategoryNode {
  id: string;
  name: string;
  category?: ComponentCategory;
  subcategory?: string;
  componentCount: number;
  children: LibraryCategoryNode[];
}

/**
 * Library metadata from a provider.
 */
export interface LibraryInfo {
  id: ComponentLibraryId;
  providerId: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  license?: string;
  componentCount: number;
  symbolCount: number;
  footprintCount: number;
  lastUpdated?: number;
}

// ============================================================================
// Library Provider Interface
// ============================================================================

/**
 * Abstract interface for library providers.
 *
 * Implementations handle fetching/parsing from different sources.
 */
export interface LibraryProvider {
  /** Unique identifier for this provider instance */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Provider type */
  readonly type: LibraryProviderType;

  /** Whether this provider requires network access */
  readonly requiresNetwork: boolean;

  /** Whether this provider is read-only */
  readonly readOnly: boolean;

  // ========================================
  // Initialization
  // ========================================

  /**
   * Initialize the provider (load indices, connect to API, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Check if the provider is ready to use.
   */
  isReady(): boolean;

  /**
   * Dispose of resources.
   */
  dispose(): void;

  // ========================================
  // Library Discovery
  // ========================================

  /**
   * Get list of available libraries from this provider.
   */
  getLibraries(): Promise<LibraryInfo[]>;

  /**
   * Get category tree for browsing.
   */
  getCategoryTree(libraryId?: ComponentLibraryId): Promise<LibraryCategoryNode[]>;

  // ========================================
  // Search
  // ========================================

  /**
   * Search for components.
   */
  search(query: ComponentSearchQuery): Promise<ComponentSearchResult>;

  /**
   * Get components by category.
   */
  getComponentsByCategory(
    category: ComponentCategory,
    subcategory?: string,
    limit?: number,
    offset?: number
  ): Promise<ComponentSearchResult>;

  // ========================================
  // Component Access
  // ========================================

  /**
   * Get full component details (lazy-loaded).
   */
  getComponent(componentId: ComponentId): Promise<Component | null>;

  /**
   * Get a symbol by ID.
   */
  getSymbol(symbolId: SymbolId): Promise<Symbol | null>;

  /**
   * Get a footprint by ID.
   */
  getFootprint(footprintId: FootprintId): Promise<Footprint | null>;

  /**
   * Get symbol for a component.
   */
  getComponentSymbol(componentId: ComponentId): Promise<Symbol | null>;

  /**
   * Get default footprint for a component.
   */
  getComponentFootprint(componentId: ComponentId): Promise<Footprint | null>;

  /**
   * Get all available footprints for a component.
   */
  getComponentFootprints(componentId: ComponentId): Promise<Footprint[]>;

  // ========================================
  // Bulk Operations (for initial load/caching)
  // ========================================

  /**
   * Preload components for faster access.
   * Returns the IDs that were successfully preloaded.
   */
  preloadComponents(componentIds: ComponentId[]): Promise<ComponentId[]>;

  /**
   * Get multiple components at once.
   */
  getComponentsBatch(componentIds: ComponentId[]): Promise<Map<ComponentId, Component>>;
}

// ============================================================================
// Provider Registry
// ============================================================================

/**
 * Registry for library providers.
 * Manages multiple providers and routes requests.
 */
export class LibraryProviderRegistry {
  private providers: Map<string, LibraryProvider> = new Map();
  private defaultProviderId: string | null = null;

  /**
   * Register a provider.
   */
  register(provider: LibraryProvider): void {
    this.providers.set(provider.id, provider);
    if (!this.defaultProviderId) {
      this.defaultProviderId = provider.id;
    }
  }

  /**
   * Unregister a provider.
   */
  unregister(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.dispose();
      this.providers.delete(providerId);
    }
    if (this.defaultProviderId === providerId) {
      this.defaultProviderId = this.providers.keys().next().value || null;
    }
  }

  /**
   * Get a provider by ID.
   */
  get(providerId: string): LibraryProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get the default provider.
   */
  getDefault(): LibraryProvider | undefined {
    return this.defaultProviderId ? this.providers.get(this.defaultProviderId) : undefined;
  }

  /**
   * Set the default provider.
   */
  setDefault(providerId: string): void {
    if (this.providers.has(providerId)) {
      this.defaultProviderId = providerId;
    }
  }

  /**
   * Get all registered providers.
   */
  getAll(): LibraryProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers by type.
   */
  getByType(type: LibraryProviderType): LibraryProvider[] {
    return this.getAll().filter(p => p.type === type);
  }

  /**
   * Initialize all providers.
   */
  async initializeAll(): Promise<void> {
    await Promise.all(
      this.getAll().map(p => p.initialize().catch(err => {
        console.error(`Failed to initialize provider ${p.id}:`, err);
      }))
    );
  }

  /**
   * Search across all providers.
   */
  async searchAll(query: ComponentSearchQuery): Promise<Map<string, ComponentSearchResult>> {
    const results = new Map<string, ComponentSearchResult>();

    await Promise.all(
      this.getAll().map(async provider => {
        if (!provider.isReady()) return;
        try {
          const result = await provider.search(query);
          results.set(provider.id, result);
        } catch (err) {
          console.error(`Search failed for provider ${provider.id}:`, err);
        }
      })
    );

    return results;
  }

  /**
   * Dispose all providers.
   */
  disposeAll(): void {
    for (const provider of this.providers.values()) {
      provider.dispose();
    }
    this.providers.clear();
    this.defaultProviderId = null;
  }
}

// Global registry instance
export const libraryProviderRegistry = new LibraryProviderRegistry();
