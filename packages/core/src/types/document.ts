/**
 * Document - top-level container for a CAD project.
 */

import {
  AssemblyId,
  DocumentId,
  PartId,
  PartStudioId,
  newId,
} from "./id";
import { ParamEnv, createParamEnv } from "./params";
import { PartStudio, createPartStudio, createPartStudioWithCube } from "./part-studio";
import { Part } from "./part";
import { Assembly } from "./assembly";

// ============================================================================
// Document
// ============================================================================

export interface Document {
  id: DocumentId;
  name: string;

  /** Global parameters */
  params: ParamEnv;

  /** Part studios (contain sketches and operations) */
  partStudios: Map<PartStudioId, PartStudio>;

  /** Parts (materialized from part studios) */
  parts: Map<PartId, Part>;

  /** Assemblies */
  assemblies: Map<AssemblyId, Assembly>;

  /** Metadata */
  meta: {
    createdAt: number;
    modifiedAt: number;
    version: number;
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new empty document.
 */
export function createDocument(name: string): Document {
  const now = Date.now();
  return {
    id: newId("Document"),
    name,
    params: createParamEnv(),
    partStudios: new Map(),
    parts: new Map(),
    assemblies: new Map(),
    meta: {
      createdAt: now,
      modifiedAt: now,
      version: 1,
    },
  };
}

/**
 * Create a document with a default part studio (empty).
 */
export function createDocumentWithStudio(name: string): Document {
  const doc = createDocument(name);
  const studio = createPartStudio("Part Studio 1");
  doc.partStudios.set(studio.id, studio);
  return doc;
}

/**
 * Create a document with a default part studio containing a 10cm cube.
 * This is the default for new users to have something to start with.
 */
export function createDocumentWithCube(name: string): Document {
  const doc = createDocument(name);
  const studio = createPartStudioWithCube("Part Studio 1");
  doc.partStudios.set(studio.id, studio);
  return doc;
}

// ============================================================================
// Accessors
// ============================================================================

/**
 * Get the first part studio (convenience for single-studio docs).
 */
export function getDefaultStudio(doc: Document): PartStudio | undefined {
  const first = doc.partStudios.values().next();
  return first.done ? undefined : first.value;
}

/**
 * Get all part studio IDs.
 */
export function getPartStudioIds(doc: Document): PartStudioId[] {
  return Array.from(doc.partStudios.keys());
}

/**
 * Get all part IDs.
 */
export function getPartIds(doc: Document): PartId[] {
  return Array.from(doc.parts.keys());
}

/**
 * Get all assembly IDs.
 */
export function getAssemblyIds(doc: Document): AssemblyId[] {
  return Array.from(doc.assemblies.keys());
}

// ============================================================================
// Immutable Updates
// ============================================================================

/**
 * Update document metadata (modifiedAt, version).
 */
export function touchDocument(doc: Document): Document {
  return {
    ...doc,
    meta: {
      ...doc.meta,
      modifiedAt: Date.now(),
      version: doc.meta.version + 1,
    },
  };
}

/**
 * Update a part studio in the document.
 */
export function updatePartStudio(
  doc: Document,
  studio: PartStudio
): Document {
  const newStudios = new Map(doc.partStudios);
  newStudios.set(studio.id, studio);
  return touchDocument({
    ...doc,
    partStudios: newStudios,
  });
}

/**
 * Add a new part studio to the document.
 */
export function addPartStudio(doc: Document, studio: PartStudio): Document {
  return updatePartStudio(doc, studio);
}

/**
 * Remove a part studio from the document.
 */
export function removePartStudio(
  doc: Document,
  studioId: PartStudioId
): Document {
  const newStudios = new Map(doc.partStudios);
  newStudios.delete(studioId);
  return touchDocument({
    ...doc,
    partStudios: newStudios,
  });
}

/**
 * Update a part in the document.
 */
export function updatePart(doc: Document, part: Part): Document {
  const newParts = new Map(doc.parts);
  newParts.set(part.id, part);
  return touchDocument({
    ...doc,
    parts: newParts,
  });
}

/**
 * Update an assembly in the document.
 */
export function updateAssembly(doc: Document, assembly: Assembly): Document {
  const newAssemblies = new Map(doc.assemblies);
  newAssemblies.set(assembly.id, assembly);
  return touchDocument({
    ...doc,
    assemblies: newAssemblies,
  });
}

/**
 * Update the parameter environment.
 */
export function updateParams(doc: Document, params: ParamEnv): Document {
  return touchDocument({
    ...doc,
    params,
  });
}
