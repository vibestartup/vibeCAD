/**
 * Sketch manipulation hooks.
 */

import { useCallback } from "react";
import {
  PrimitiveId,
  ConstraintId,
  DimValue,
  SketchPrimitive,
  SketchConstraint,
} from "@vibecad/core";
import { sketch } from "@vibecad/core";
import { useDocumentContext, useActiveSketch, useActiveStudio } from "../context";

/**
 * Hook for sketch primitive operations.
 */
export function useSketchPrimitives() {
  const { document, setDocument, activeSketchId, activeStudioId } =
    useDocumentContext();
  const activeSketch = useActiveSketch();
  const activeStudio = useActiveStudio();

  const updateSketch = useCallback(
    (updater: (s: typeof activeSketch) => typeof activeSketch) => {
      if (!activeSketch || !activeStudio || !activeStudioId) return;

      const newSketch = updater(activeSketch);
      if (!newSketch || newSketch === activeSketch) return;

      const newSketches = new Map(activeStudio.sketches);
      newSketches.set(activeSketch.id, newSketch);

      const newStudio = { ...activeStudio, sketches: newSketches };
      const newStudios = new Map(document.partStudios);
      newStudios.set(activeStudioId, newStudio);

      setDocument({ ...document, partStudios: newStudios });
    },
    [document, setDocument, activeSketch, activeStudio, activeStudioId]
  );

  const addPoint = useCallback(
    (x: number, y: number, construction = false) => {
      if (!activeSketch) return null;
      const result = sketch.addPoint(activeSketch, x, y, construction);
      updateSketch(() => result.sketch);
      return result.pointId;
    },
    [activeSketch, updateSketch]
  );

  const addLine = useCallback(
    (
      start: PrimitiveId | { x: number; y: number },
      end: PrimitiveId | { x: number; y: number },
      construction = false
    ) => {
      if (!activeSketch) return null;
      const result = sketch.addLine(activeSketch, start, end, construction);
      updateSketch(() => result.sketch);
      return {
        lineId: result.lineId,
        startId: result.startId,
        endId: result.endId,
      };
    },
    [activeSketch, updateSketch]
  );

  const addCircle = useCallback(
    (
      center: PrimitiveId | { x: number; y: number },
      radius: number,
      construction = false
    ) => {
      if (!activeSketch) return null;
      const result = sketch.addCircle(activeSketch, center, radius, construction);
      updateSketch(() => result.sketch);
      return { circleId: result.circleId, centerId: result.centerId };
    },
    [activeSketch, updateSketch]
  );

  const addRectangle = useCallback(
    (x1: number, y1: number, x2: number, y2: number, construction = false) => {
      if (!activeSketch) return null;
      const result = sketch.addRectangle(activeSketch, x1, y1, x2, y2, construction);
      updateSketch(() => result.sketch);
      return { pointIds: result.pointIds, lineIds: result.lineIds };
    },
    [activeSketch, updateSketch]
  );

  const removePrimitive = useCallback(
    (primitiveId: PrimitiveId) => {
      updateSketch((s) => (s ? sketch.removePrimitive(s, primitiveId) : s));
    },
    [updateSketch]
  );

  const movePoint = useCallback(
    (pointId: PrimitiveId, x: number, y: number) => {
      updateSketch((s) => (s ? sketch.movePoint(s, pointId, x, y) : s));
    },
    [updateSketch]
  );

  const toggleConstruction = useCallback(
    (primitiveId: PrimitiveId) => {
      updateSketch((s) => (s ? sketch.toggleConstruction(s, primitiveId) : s));
    },
    [updateSketch]
  );

  return {
    addPoint,
    addLine,
    addCircle,
    addRectangle,
    removePrimitive,
    movePoint,
    toggleConstruction,
  };
}

/**
 * Hook for sketch constraint operations.
 */
export function useSketchConstraints() {
  const { document, setDocument, activeSketchId, activeStudioId } =
    useDocumentContext();
  const activeSketch = useActiveSketch();
  const activeStudio = useActiveStudio();

  const updateSketch = useCallback(
    (updater: (s: typeof activeSketch) => typeof activeSketch) => {
      if (!activeSketch || !activeStudio || !activeStudioId) return;

      const newSketch = updater(activeSketch);
      if (!newSketch || newSketch === activeSketch) return;

      const newSketches = new Map(activeStudio.sketches);
      newSketches.set(activeSketch.id, newSketch);

      const newStudio = { ...activeStudio, sketches: newSketches };
      const newStudios = new Map(document.partStudios);
      newStudios.set(activeStudioId, newStudio);

      setDocument({ ...document, partStudios: newStudios });
    },
    [document, setDocument, activeSketch, activeStudio, activeStudioId]
  );

  const addCoincident = useCallback(
    (entity1: PrimitiveId, entity2: PrimitiveId) => {
      if (!activeSketch) return null;
      const result = sketch.addCoincident(activeSketch, entity1, entity2);
      updateSketch(() => result.sketch);
      return result.constraintId;
    },
    [activeSketch, updateSketch]
  );

  const addHorizontal = useCallback(
    (...entities: PrimitiveId[]) => {
      if (!activeSketch) return null;
      const result = sketch.addHorizontal(activeSketch, ...entities);
      updateSketch(() => result.sketch);
      return result.constraintId;
    },
    [activeSketch, updateSketch]
  );

  const addVertical = useCallback(
    (...entities: PrimitiveId[]) => {
      if (!activeSketch) return null;
      const result = sketch.addVertical(activeSketch, ...entities);
      updateSketch(() => result.sketch);
      return result.constraintId;
    },
    [activeSketch, updateSketch]
  );

  const addDistance = useCallback(
    (entity1: PrimitiveId, entity2: PrimitiveId | undefined, value: number | DimValue) => {
      if (!activeSketch) return null;
      const result = sketch.addDistance(activeSketch, entity1, entity2, value);
      updateSketch(() => result.sketch);
      return result.constraintId;
    },
    [activeSketch, updateSketch]
  );

  const addAngle = useCallback(
    (line1: PrimitiveId, line2: PrimitiveId, value: number | DimValue) => {
      if (!activeSketch) return null;
      const result = sketch.addAngle(activeSketch, line1, line2, value);
      updateSketch(() => result.sketch);
      return result.constraintId;
    },
    [activeSketch, updateSketch]
  );

  const addRadius = useCallback(
    (entity: PrimitiveId, value: number | DimValue) => {
      if (!activeSketch) return null;
      const result = sketch.addRadius(activeSketch, entity, value);
      updateSketch(() => result.sketch);
      return result.constraintId;
    },
    [activeSketch, updateSketch]
  );

  const removeConstraint = useCallback(
    (constraintId: ConstraintId) => {
      updateSketch((s) => (s ? sketch.removeConstraint(s, constraintId) : s));
    },
    [updateSketch]
  );

  const setDimension = useCallback(
    (constraintId: ConstraintId, dim: DimValue) => {
      updateSketch((s) =>
        s ? sketch.setConstraintDimension(s, constraintId, dim) : s
      );
    },
    [updateSketch]
  );

  return {
    addCoincident,
    addHorizontal,
    addVertical,
    addDistance,
    addAngle,
    addRadius,
    removeConstraint,
    setDimension,
  };
}
