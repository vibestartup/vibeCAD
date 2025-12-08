/**
 * Library Store - state management for component library browser and management
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ComponentLibrary,
  ComponentLibraryId,
  Component,
  ComponentId,
  ComponentCategory,
  SymbolId,
  FootprintId,
  Symbol,
  Footprint,
  LayerId,
} from "@vibecad/core";
import {
  createComponentLibrary,
  addSymbolToLibrary,
  addFootprintToLibrary,
  addComponentToLibrary,
  removeSymbolFromLibrary,
  removeFootprintFromLibrary,
  removeComponentFromLibrary,
  searchComponents,
  getComponentsByCategory,
  getUsedCategories,
  serializeLibrary,
  deserializeLibrary,
} from "@vibecad/core";
import { createBuiltinBasicsLibrary } from "@vibecad/core";

// ============================================================================
// Types
// ============================================================================

export type LibraryViewMode = "grid" | "list" | "tree";

export type LibrarySortField = "name" | "category" | "dateAdded" | "lastUsed";

export interface LibrarySearchFilters {
  category?: ComponentCategory;
  hasFootprint?: boolean;
  has3dModel?: boolean;
  hasStock?: boolean;
  libraryIds?: ComponentLibraryId[];
}

export interface RecentComponent {
  componentId: ComponentId;
  libraryId: ComponentLibraryId;
  timestamp: number;
}

export interface FavoriteComponent {
  componentId: ComponentId;
  libraryId: ComponentLibraryId;
}

// ============================================================================
// State Interface
// ============================================================================

interface LibraryState {
  // Libraries
  libraries: Map<ComponentLibraryId, ComponentLibrary>;
  builtinLibraryId: ComponentLibraryId | null;
  userLibraryId: ComponentLibraryId | null;

  // Browser state
  isOpen: boolean;
  viewMode: LibraryViewMode;
  sortField: LibrarySortField;
  sortAscending: boolean;

  // Selection
  selectedLibraryId: ComponentLibraryId | null;
  selectedComponentId: ComponentId | null;
  selectedCategory: ComponentCategory | null;

  // Search
  searchQuery: string;
  searchFilters: LibrarySearchFilters;
  searchResults: Component[];

  // Recent & favorites
  recentComponents: RecentComponent[];
  favoriteComponents: FavoriteComponent[];

  // Preview
  previewSymbolId: SymbolId | null;
  previewFootprintId: FootprintId | null;

  // Expanded tree nodes (for tree view)
  expandedLibraries: Set<ComponentLibraryId>;
  expandedCategories: Set<string>;

  // Loading state
  isLoading: boolean;
  loadingLibraryId: ComponentLibraryId | null;
}

// ============================================================================
// Actions Interface
// ============================================================================

interface LibraryActions {
  // Initialization
  initializeLibraries: (layers: {
    topCopper: LayerId;
    topSilk: LayerId;
    topFab: LayerId;
    topCrtYd: LayerId;
  }) => void;

  // Browser controls
  openBrowser: () => void;
  closeBrowser: () => void;
  toggleBrowser: () => void;
  setViewMode: (mode: LibraryViewMode) => void;
  setSortField: (field: LibrarySortField) => void;
  toggleSortOrder: () => void;

  // Library management
  addLibrary: (library: ComponentLibrary) => void;
  removeLibrary: (libraryId: ComponentLibraryId) => void;
  renameLibrary: (libraryId: ComponentLibraryId, name: string) => void;
  createNewLibrary: (name: string) => ComponentLibraryId;
  importLibrary: (json: string) => ComponentLibraryId | null;
  exportLibrary: (libraryId: ComponentLibraryId) => string | null;

  // Selection
  selectLibrary: (libraryId: ComponentLibraryId | null) => void;
  selectComponent: (componentId: ComponentId | null) => void;
  selectCategory: (category: ComponentCategory | null) => void;

  // Search
  setSearchQuery: (query: string) => void;
  setSearchFilters: (filters: LibrarySearchFilters) => void;
  clearSearch: () => void;
  performSearch: () => void;

  // Component operations
  addComponent: (libraryId: ComponentLibraryId, component: Component) => void;
  removeComponent: (libraryId: ComponentLibraryId, componentId: ComponentId) => void;
  duplicateComponent: (libraryId: ComponentLibraryId, componentId: ComponentId) => ComponentId | null;

  // Symbol operations
  addSymbol: (libraryId: ComponentLibraryId, symbol: Symbol) => void;
  removeSymbol: (libraryId: ComponentLibraryId, symbolId: SymbolId) => void;

  // Footprint operations
  addFootprint: (libraryId: ComponentLibraryId, footprint: Footprint) => void;
  removeFootprint: (libraryId: ComponentLibraryId, footprintId: FootprintId) => void;

  // Recent & favorites
  addToRecent: (componentId: ComponentId, libraryId: ComponentLibraryId) => void;
  clearRecent: () => void;
  addToFavorites: (componentId: ComponentId, libraryId: ComponentLibraryId) => void;
  removeFromFavorites: (componentId: ComponentId) => void;
  isFavorite: (componentId: ComponentId) => boolean;

  // Preview
  previewSymbol: (symbolId: SymbolId | null) => void;
  previewFootprint: (footprintId: FootprintId | null) => void;

  // Tree view
  toggleLibraryExpanded: (libraryId: ComponentLibraryId) => void;
  toggleCategoryExpanded: (category: string) => void;
  expandAll: () => void;
  collapseAll: () => void;

  // Query helpers
  getLibrary: (libraryId: ComponentLibraryId) => ComponentLibrary | undefined;
  getComponent: (componentId: ComponentId) => { component: Component; library: ComponentLibrary } | undefined;
  getSymbol: (symbolId: SymbolId) => Symbol | undefined;
  getFootprint: (footprintId: FootprintId) => Footprint | undefined;
  getAllComponents: () => Array<{ component: Component; libraryId: ComponentLibraryId }>;
  getComponentsInCategory: (category: ComponentCategory) => Array<{ component: Component; libraryId: ComponentLibraryId }>;
  getCategories: () => ComponentCategory[];
  getRecentComponents: () => Array<{ component: Component; library: ComponentLibrary }>;
  getFavoriteComponents: () => Array<{ component: Component; library: ComponentLibrary }>;
}

// ============================================================================
// Store
// ============================================================================

export const useLibraryStore = create<LibraryState & LibraryActions>()(
  persist(
    (set, get) => ({
      // Initial state
      libraries: new Map(),
      builtinLibraryId: null,
      userLibraryId: null,

      isOpen: false,
      viewMode: "grid",
      sortField: "name",
      sortAscending: true,

      selectedLibraryId: null,
      selectedComponentId: null,
      selectedCategory: null,

      searchQuery: "",
      searchFilters: {},
      searchResults: [],

      recentComponents: [],
      favoriteComponents: [],

      previewSymbolId: null,
      previewFootprintId: null,

      expandedLibraries: new Set(),
      expandedCategories: new Set(),

      isLoading: false,
      loadingLibraryId: null,

      // ========================================
      // Initialization
      // ========================================

      initializeLibraries: (layers) => {
        const { libraries, builtinLibraryId } = get();

        // Only initialize once
        if (builtinLibraryId && libraries.has(builtinLibraryId)) {
          return;
        }

        // Create built-in library
        const builtinLib = createBuiltinBasicsLibrary(layers);

        // Create user library
        const userLib = createComponentLibrary("My Library", "user");

        const newLibraries = new Map(libraries);
        newLibraries.set(builtinLib.id, builtinLib);
        newLibraries.set(userLib.id, userLib);

        set({
          libraries: newLibraries,
          builtinLibraryId: builtinLib.id,
          userLibraryId: userLib.id,
          expandedLibraries: new Set([builtinLib.id, userLib.id]),
        });
      },

      // ========================================
      // Browser controls
      // ========================================

      openBrowser: () => set({ isOpen: true }),
      closeBrowser: () => set({ isOpen: false }),
      toggleBrowser: () => set((state) => ({ isOpen: !state.isOpen })),

      setViewMode: (mode) => set({ viewMode: mode }),
      setSortField: (field) => set({ sortField: field }),
      toggleSortOrder: () => set((state) => ({ sortAscending: !state.sortAscending })),

      // ========================================
      // Library management
      // ========================================

      addLibrary: (library) => {
        set((state) => {
          const newLibraries = new Map(state.libraries);
          newLibraries.set(library.id, library);
          return { libraries: newLibraries };
        });
      },

      removeLibrary: (libraryId) => {
        const { builtinLibraryId } = get();

        // Cannot remove built-in library
        if (libraryId === builtinLibraryId) {
          console.warn("Cannot remove built-in library");
          return;
        }

        set((state) => {
          const newLibraries = new Map(state.libraries);
          newLibraries.delete(libraryId);

          // Clear selection if removing selected library
          const newSelectedLibraryId =
            state.selectedLibraryId === libraryId ? null : state.selectedLibraryId;

          return {
            libraries: newLibraries,
            selectedLibraryId: newSelectedLibraryId,
          };
        });
      },

      renameLibrary: (libraryId, name) => {
        set((state) => {
          const library = state.libraries.get(libraryId);
          if (!library || library.readOnly) {
            return state;
          }

          const newLibraries = new Map(state.libraries);
          newLibraries.set(libraryId, { ...library, name });
          return { libraries: newLibraries };
        });
      },

      createNewLibrary: (name) => {
        const library = createComponentLibrary(name, "user");
        get().addLibrary(library);
        return library.id;
      },

      importLibrary: (json) => {
        try {
          const library = deserializeLibrary(json);
          // Don't import as read-only
          library.readOnly = false;
          library.source = "user";
          get().addLibrary(library);
          return library.id;
        } catch (e) {
          console.error("Failed to import library:", e);
          return null;
        }
      },

      exportLibrary: (libraryId) => {
        const library = get().libraries.get(libraryId);
        if (!library) return null;
        return serializeLibrary(library);
      },

      // ========================================
      // Selection
      // ========================================

      selectLibrary: (libraryId) => {
        set({
          selectedLibraryId: libraryId,
          selectedComponentId: null,
        });
      },

      selectComponent: (componentId) => {
        if (componentId === null) {
          set({ selectedComponentId: null });
          return;
        }

        // Find which library contains this component
        for (const [libraryId, library] of get().libraries) {
          if (library.components.has(componentId)) {
            set({
              selectedLibraryId: libraryId,
              selectedComponentId: componentId,
            });

            // Add to recent
            get().addToRecent(componentId, libraryId);
            return;
          }
        }
      },

      selectCategory: (category) => {
        set({ selectedCategory: category });
        // Perform search if there's a category filter
        if (category) {
          set((state) => ({
            searchFilters: { ...state.searchFilters, category },
          }));
          get().performSearch();
        }
      },

      // ========================================
      // Search
      // ========================================

      setSearchQuery: (query) => {
        set({ searchQuery: query });
        get().performSearch();
      },

      setSearchFilters: (filters) => {
        set({ searchFilters: filters });
        get().performSearch();
      },

      clearSearch: () => {
        set({
          searchQuery: "",
          searchFilters: {},
          searchResults: [],
        });
      },

      performSearch: () => {
        const { libraries, searchQuery, searchFilters } = get();

        if (!searchQuery && Object.keys(searchFilters).length === 0) {
          set({ searchResults: [] });
          return;
        }

        const results: Component[] = [];

        // Determine which libraries to search
        const librariesToSearch = searchFilters.libraryIds
          ? searchFilters.libraryIds
          : Array.from(libraries.keys());

        for (const libraryId of librariesToSearch) {
          const library = libraries.get(libraryId);
          if (!library) continue;

          const matches = searchComponents(library, searchQuery, {
            category: searchFilters.category,
            hasFootprint: searchFilters.hasFootprint,
            has3dModel: searchFilters.has3dModel,
          });

          results.push(...matches);
        }

        // Sort results
        const { sortField, sortAscending } = get();
        results.sort((a, b) => {
          let comparison = 0;
          switch (sortField) {
            case "name":
              comparison = a.name.localeCompare(b.name);
              break;
            case "category":
              comparison = a.category.localeCompare(b.category);
              break;
            default:
              comparison = a.name.localeCompare(b.name);
          }
          return sortAscending ? comparison : -comparison;
        });

        set({ searchResults: results });
      },

      // ========================================
      // Component operations
      // ========================================

      addComponent: (libraryId, component) => {
        set((state) => {
          const library = state.libraries.get(libraryId);
          if (!library) return state;

          const newLibraries = new Map(state.libraries);
          newLibraries.set(libraryId, addComponentToLibrary(library, component));
          return { libraries: newLibraries };
        });
      },

      removeComponent: (libraryId, componentId) => {
        set((state) => {
          const library = state.libraries.get(libraryId);
          if (!library) return state;

          const newLibraries = new Map(state.libraries);
          newLibraries.set(libraryId, removeComponentFromLibrary(library, componentId));

          // Clear selection if removing selected component
          const newSelectedComponentId =
            state.selectedComponentId === componentId ? null : state.selectedComponentId;

          return {
            libraries: newLibraries,
            selectedComponentId: newSelectedComponentId,
          };
        });
      },

      duplicateComponent: (libraryId, componentId) => {
        const library = get().libraries.get(libraryId);
        if (!library) return null;

        const original = library.components.get(componentId);
        if (!original) return null;

        // Create a copy with a new ID
        const { newId } = require("@vibecad/core");
        const copy: Component = {
          ...original,
          id: newId("Component"),
          name: `${original.name} (Copy)`,
          specs: new Map(original.specs),
        };

        get().addComponent(libraryId, copy);
        return copy.id;
      },

      // ========================================
      // Symbol operations
      // ========================================

      addSymbol: (libraryId, symbol) => {
        set((state) => {
          const library = state.libraries.get(libraryId);
          if (!library) return state;

          const newLibraries = new Map(state.libraries);
          newLibraries.set(libraryId, addSymbolToLibrary(library, symbol));
          return { libraries: newLibraries };
        });
      },

      removeSymbol: (libraryId, symbolId) => {
        set((state) => {
          const library = state.libraries.get(libraryId);
          if (!library) return state;

          const newLibraries = new Map(state.libraries);
          newLibraries.set(libraryId, removeSymbolFromLibrary(library, symbolId));
          return { libraries: newLibraries };
        });
      },

      // ========================================
      // Footprint operations
      // ========================================

      addFootprint: (libraryId, footprint) => {
        set((state) => {
          const library = state.libraries.get(libraryId);
          if (!library) return state;

          const newLibraries = new Map(state.libraries);
          newLibraries.set(libraryId, addFootprintToLibrary(library, footprint));
          return { libraries: newLibraries };
        });
      },

      removeFootprint: (libraryId, footprintId) => {
        set((state) => {
          const library = state.libraries.get(libraryId);
          if (!library) return state;

          const newLibraries = new Map(state.libraries);
          newLibraries.set(libraryId, removeFootprintFromLibrary(library, footprintId));
          return { libraries: newLibraries };
        });
      },

      // ========================================
      // Recent & favorites
      // ========================================

      addToRecent: (componentId, libraryId) => {
        set((state) => {
          const newRecent = [
            { componentId, libraryId, timestamp: Date.now() },
            ...state.recentComponents.filter((r) => r.componentId !== componentId),
          ].slice(0, 20); // Keep last 20

          return { recentComponents: newRecent };
        });
      },

      clearRecent: () => set({ recentComponents: [] }),

      addToFavorites: (componentId, libraryId) => {
        set((state) => {
          // Don't add duplicates
          if (state.favoriteComponents.some((f) => f.componentId === componentId)) {
            return state;
          }
          return {
            favoriteComponents: [...state.favoriteComponents, { componentId, libraryId }],
          };
        });
      },

      removeFromFavorites: (componentId) => {
        set((state) => ({
          favoriteComponents: state.favoriteComponents.filter(
            (f) => f.componentId !== componentId
          ),
        }));
      },

      isFavorite: (componentId) => {
        return get().favoriteComponents.some((f) => f.componentId === componentId);
      },

      // ========================================
      // Preview
      // ========================================

      previewSymbol: (symbolId) => set({ previewSymbolId: symbolId }),
      previewFootprint: (footprintId) => set({ previewFootprintId: footprintId }),

      // ========================================
      // Tree view
      // ========================================

      toggleLibraryExpanded: (libraryId) => {
        set((state) => {
          const newExpanded = new Set(state.expandedLibraries);
          if (newExpanded.has(libraryId)) {
            newExpanded.delete(libraryId);
          } else {
            newExpanded.add(libraryId);
          }
          return { expandedLibraries: newExpanded };
        });
      },

      toggleCategoryExpanded: (category) => {
        set((state) => {
          const newExpanded = new Set(state.expandedCategories);
          if (newExpanded.has(category)) {
            newExpanded.delete(category);
          } else {
            newExpanded.add(category);
          }
          return { expandedCategories: newExpanded };
        });
      },

      expandAll: () => {
        const { libraries } = get();
        const allCategories: string[] = [];
        for (const library of libraries.values()) {
          allCategories.push(...getUsedCategories(library));
        }
        set({
          expandedLibraries: new Set(libraries.keys()),
          expandedCategories: new Set(allCategories),
        });
      },

      collapseAll: () => {
        set({
          expandedLibraries: new Set(),
          expandedCategories: new Set(),
        });
      },

      // ========================================
      // Query helpers
      // ========================================

      getLibrary: (libraryId) => get().libraries.get(libraryId),

      getComponent: (componentId) => {
        for (const [libraryId, library] of get().libraries) {
          const component = library.components.get(componentId);
          if (component) {
            return { component, library };
          }
        }
        return undefined;
      },

      getSymbol: (symbolId) => {
        for (const library of get().libraries.values()) {
          const symbol = library.symbols.get(symbolId);
          if (symbol) return symbol;
        }
        return undefined;
      },

      getFootprint: (footprintId) => {
        for (const library of get().libraries.values()) {
          const footprint = library.footprints.get(footprintId);
          if (footprint) return footprint;
        }
        return undefined;
      },

      getAllComponents: () => {
        const result: Array<{ component: Component; libraryId: ComponentLibraryId }> = [];
        for (const [libraryId, library] of get().libraries) {
          for (const component of library.components.values()) {
            result.push({ component, libraryId });
          }
        }
        return result;
      },

      getComponentsInCategory: (category) => {
        const result: Array<{ component: Component; libraryId: ComponentLibraryId }> = [];
        for (const [libraryId, library] of get().libraries) {
          const components = getComponentsByCategory(library, category);
          for (const component of components) {
            result.push({ component, libraryId });
          }
        }
        return result;
      },

      getCategories: () => {
        const categories = new Set<ComponentCategory>();
        for (const library of get().libraries.values()) {
          for (const cat of getUsedCategories(library)) {
            categories.add(cat);
          }
        }
        return Array.from(categories).sort();
      },

      getRecentComponents: () => {
        const result: Array<{ component: Component; library: ComponentLibrary }> = [];
        for (const recent of get().recentComponents) {
          const library = get().libraries.get(recent.libraryId);
          if (!library) continue;
          const component = library.components.get(recent.componentId);
          if (component) {
            result.push({ component, library });
          }
        }
        return result;
      },

      getFavoriteComponents: () => {
        const result: Array<{ component: Component; library: ComponentLibrary }> = [];
        for (const fav of get().favoriteComponents) {
          const library = get().libraries.get(fav.libraryId);
          if (!library) continue;
          const component = library.components.get(fav.componentId);
          if (component) {
            result.push({ component, library });
          }
        }
        return result;
      },
    }),
    {
      name: "vibecad-library-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist user preferences, not library data
        viewMode: state.viewMode,
        sortField: state.sortField,
        sortAscending: state.sortAscending,
        recentComponents: state.recentComponents,
        favoriteComponents: state.favoriteComponents,
        expandedLibraries: Array.from(state.expandedLibraries),
        expandedCategories: Array.from(state.expandedCategories),
      }),
      onRehydrate: () => {
        return (state) => {
          if (state) {
            // Convert arrays back to Sets
            state.expandedLibraries = new Set(state.expandedLibraries as unknown as ComponentLibraryId[]);
            state.expandedCategories = new Set(state.expandedCategories as unknown as string[]);
          }
        };
      },
    }
  )
);
