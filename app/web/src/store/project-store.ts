/**
 * Project Store - project save/load/download/upload functionality
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Document } from "@vibecad/core";

// ============================================================================
// Types
// ============================================================================

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: number;
  modifiedAt: number;
  thumbnail?: string; // Base64 encoded thumbnail
}

export interface SavedProject {
  metadata: ProjectMetadata;
  document: SerializedDocument;
}

// Serializable version of Document (Maps converted to arrays)
export interface SerializedDocument {
  id: string;
  name: string;
  params: {
    params: Array<[string, unknown]>;
    errors: Array<[string, string]>;
  };
  partStudios: Array<[string, SerializedPartStudio]>;
  parts: Array<[string, unknown]>;
  assemblies: Array<[string, unknown]>;
  meta: {
    createdAt: number;
    modifiedAt: number;
    version: number;
  };
}

export interface SerializedPartStudio {
  id: string;
  name: string;
  planes: Array<[string, unknown]>;
  sketches: Array<[string, SerializedSketch]>;
  opGraph: Array<[string, unknown]>;
  opOrder: string[];
  results?: Array<[string, unknown]>;
}

export interface SerializedSketch {
  id: string;
  name: string;
  planeId: string;
  primitives: Array<[string, unknown]>;
  constraints: Array<[string, unknown]>;
  solvedPositions?: Array<[string, unknown]>;
  solveStatus?: string;
  dof?: number;
}

interface ProjectState {
  // List of saved project metadata
  projectList: ProjectMetadata[];
  // Currently loaded project ID
  currentProjectId: string | null;

  // Actions
  saveProject: (document: Document, thumbnail?: string) => string;
  loadProject: (projectId: string) => Document | null;
  deleteProject: (projectId: string) => void;
  renameProject: (projectId: string, newName: string) => void;
  exportProject: (document: Document) => string;
  importProject: (jsonString: string) => Document | null;
  downloadProject: (document: Document, filename?: string) => void;
  setCurrentProjectId: (id: string | null) => void;
  getProjectMetadata: (projectId: string) => ProjectMetadata | undefined;
}

// ============================================================================
// Serialization Helpers
// ============================================================================

function serializeMap<K, V>(map: Map<K, V>): Array<[K, V]> {
  return Array.from(map.entries());
}

function deserializeMap<K, V>(entries: Array<[K, V]>): Map<K, V> {
  return new Map(entries);
}

function serializeSketch(sketch: any): SerializedSketch {
  return {
    id: sketch.id,
    name: sketch.name,
    planeId: sketch.planeId,
    primitives: serializeMap(sketch.primitives),
    constraints: serializeMap(sketch.constraints),
    solvedPositions: sketch.solvedPositions
      ? serializeMap(sketch.solvedPositions)
      : undefined,
    solveStatus: sketch.solveStatus,
    dof: sketch.dof,
  };
}

function deserializeSketch(data: SerializedSketch): any {
  return {
    id: data.id,
    name: data.name,
    planeId: data.planeId,
    primitives: deserializeMap(data.primitives),
    constraints: deserializeMap(data.constraints),
    solvedPositions: data.solvedPositions
      ? deserializeMap(data.solvedPositions)
      : undefined,
    solveStatus: data.solveStatus,
    dof: data.dof,
  };
}

function serializePartStudio(studio: any): SerializedPartStudio {
  const serializedSketches = Array.from(studio.sketches.entries()).map(
    ([id, sketch]: [string, any]) => [id, serializeSketch(sketch)] as [string, SerializedSketch]
  );

  return {
    id: studio.id,
    name: studio.name,
    planes: serializeMap(studio.planes),
    sketches: serializedSketches,
    opGraph: serializeMap(studio.opGraph),
    opOrder: studio.opOrder,
    results: studio.results ? serializeMap(studio.results) : undefined,
  };
}

function deserializePartStudio(data: SerializedPartStudio): any {
  const deserializedSketches = new Map(
    data.sketches.map(([id, sketch]) => [id, deserializeSketch(sketch)])
  );

  return {
    id: data.id,
    name: data.name,
    planes: deserializeMap(data.planes),
    sketches: deserializedSketches,
    opGraph: deserializeMap(data.opGraph),
    opOrder: data.opOrder,
    results: data.results ? deserializeMap(data.results) : undefined,
  };
}

export function serializeDocument(doc: Document): SerializedDocument {
  const serializedPartStudios = Array.from(doc.partStudios.entries()).map(
    ([id, studio]) => [id, serializePartStudio(studio)] as [string, SerializedPartStudio]
  );

  return {
    id: doc.id,
    name: doc.name,
    params: {
      params: serializeMap(doc.params.params),
      errors: serializeMap(doc.params.errors),
    },
    partStudios: serializedPartStudios,
    parts: serializeMap(doc.parts),
    assemblies: serializeMap(doc.assemblies),
    meta: doc.meta,
  };
}

export function deserializeDocument(data: SerializedDocument): Document {
  const deserializedPartStudios = new Map(
    data.partStudios.map(([id, studio]) => [id, deserializePartStudio(studio)])
  );

  return {
    id: data.id,
    name: data.name,
    params: {
      params: deserializeMap(data.params.params),
      errors: deserializeMap(data.params.errors),
    },
    partStudios: deserializedPartStudios,
    parts: deserializeMap(data.parts),
    assemblies: deserializeMap(data.assemblies),
    meta: data.meta,
  } as Document;
}

// ============================================================================
// Local Storage Helpers
// ============================================================================

const PROJECT_STORAGE_PREFIX = "vibecad-project-";

function getProjectStorageKey(projectId: string): string {
  return `${PROJECT_STORAGE_PREFIX}${projectId}`;
}

function generateProjectId(): string {
  return `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Store
// ============================================================================

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projectList: [],
      currentProjectId: null,

      saveProject: (document, thumbnail) => {
        const state = get();
        const now = Date.now();

        // Check if we're updating an existing project
        let projectId = state.currentProjectId;
        let isNew = false;

        if (!projectId) {
          projectId = generateProjectId();
          isNew = true;
        }

        const metadata: ProjectMetadata = {
          id: projectId,
          name: document.name,
          createdAt: isNew ? now : (state.getProjectMetadata(projectId)?.createdAt ?? now),
          modifiedAt: now,
          thumbnail,
        };

        const savedProject: SavedProject = {
          metadata,
          document: serializeDocument(document),
        };

        // Save to localStorage
        localStorage.setItem(
          getProjectStorageKey(projectId),
          JSON.stringify(savedProject)
        );

        // Update project list
        set((state) => {
          const existingIndex = state.projectList.findIndex(
            (p) => p.id === projectId
          );
          const newList = [...state.projectList];

          if (existingIndex >= 0) {
            newList[existingIndex] = metadata;
          } else {
            newList.unshift(metadata);
          }

          return {
            projectList: newList,
            currentProjectId: projectId,
          };
        });

        return projectId;
      },

      loadProject: (projectId) => {
        try {
          const stored = localStorage.getItem(getProjectStorageKey(projectId));
          if (!stored) return null;

          const savedProject: SavedProject = JSON.parse(stored);
          const document = deserializeDocument(savedProject.document);

          set({ currentProjectId: projectId });

          return document;
        } catch (error) {
          console.error("Failed to load project:", error);
          return null;
        }
      },

      deleteProject: (projectId) => {
        localStorage.removeItem(getProjectStorageKey(projectId));

        set((state) => ({
          projectList: state.projectList.filter((p) => p.id !== projectId),
          currentProjectId:
            state.currentProjectId === projectId
              ? null
              : state.currentProjectId,
        }));
      },

      renameProject: (projectId, newName) => {
        try {
          const stored = localStorage.getItem(getProjectStorageKey(projectId));
          if (!stored) return;

          const savedProject: SavedProject = JSON.parse(stored);
          savedProject.metadata.name = newName;
          savedProject.document.name = newName;
          savedProject.metadata.modifiedAt = Date.now();

          localStorage.setItem(
            getProjectStorageKey(projectId),
            JSON.stringify(savedProject)
          );

          set((state) => ({
            projectList: state.projectList.map((p) =>
              p.id === projectId ? { ...p, name: newName, modifiedAt: Date.now() } : p
            ),
          }));
        } catch (error) {
          console.error("Failed to rename project:", error);
        }
      },

      exportProject: (document) => {
        const serialized = serializeDocument(document);
        return JSON.stringify(serialized, null, 2);
      },

      importProject: (jsonString) => {
        try {
          const data = JSON.parse(jsonString) as SerializedDocument;
          return deserializeDocument(data);
        } catch (error) {
          console.error("Failed to import project:", error);
          return null;
        }
      },

      downloadProject: (document, filename) => {
        const json = get().exportProject(document);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = window.document.createElement("a");
        a.href = url;
        a.download = filename || `${document.name}.vibecad.json`;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },

      setCurrentProjectId: (id) => {
        set({ currentProjectId: id });
      },

      getProjectMetadata: (projectId) => {
        return get().projectList.find((p) => p.id === projectId);
      },
    }),
    {
      name: "vibecad-projects",
      partialize: (state) => ({
        projectList: state.projectList,
        currentProjectId: state.currentProjectId,
      }),
    }
  )
);

// ============================================================================
// File Upload Helper
// ============================================================================

export function uploadProjectFile(): Promise<Document | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.vibecad.json";

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const text = await file.text();
        const { importProject } = useProjectStore.getState();
        const doc = importProject(text);
        resolve(doc);
      } catch (error) {
        console.error("Failed to read file:", error);
        resolve(null);
      }
    };

    input.click();
  });
}
