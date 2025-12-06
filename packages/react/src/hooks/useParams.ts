/**
 * Parameter manipulation hooks.
 */

import { useCallback } from "react";
import { ParamId, Parameter, createParam, createParamExpr } from "@vibecad/core";
import { params } from "@vibecad/core";
import { useDocumentContext, useParams } from "../context";

/**
 * Hook for parameter operations.
 */
export function useParamOperations() {
  const { document, setDocument } = useDocumentContext();
  const paramEnv = useParams();

  const addParameter = useCallback(
    (name: string, value: number, unit?: string) => {
      const param = createParam(name, value, unit);
      const newEnv = params.addParam(paramEnv, param);
      setDocument({ ...document, params: newEnv });
      return param.id;
    },
    [document, setDocument, paramEnv]
  );

  const addParameterExpr = useCallback(
    (name: string, expression: string, unit?: string) => {
      const param = createParamExpr(name, expression, 0, unit);
      const newEnv = params.addParam(paramEnv, param);
      setDocument({ ...document, params: newEnv });
      return param.id;
    },
    [document, setDocument, paramEnv]
  );

  const updateExpression = useCallback(
    (paramId: ParamId, expression: string) => {
      const newEnv = params.updateParamExpression(paramEnv, paramId, expression);
      setDocument({ ...document, params: newEnv });
    },
    [document, setDocument, paramEnv]
  );

  const updateName = useCallback(
    (paramId: ParamId, name: string) => {
      const newEnv = params.updateParamName(paramEnv, paramId, name);
      setDocument({ ...document, params: newEnv });
    },
    [document, setDocument, paramEnv]
  );

  const removeParameter = useCallback(
    (paramId: ParamId) => {
      const newEnv = params.removeParam(paramEnv, paramId);
      setDocument({ ...document, params: newEnv });
    },
    [document, setDocument, paramEnv]
  );

  const getByName = useCallback(
    (name: string): Parameter | undefined => {
      return params.getParamByName
        ? params.getParamByName(paramEnv, name)
        : undefined;
    },
    [paramEnv]
  );

  const getValue = useCallback(
    (name: string): number | undefined => {
      return params.getParamValue ? params.getParamValue(paramEnv, name) : undefined;
    },
    [paramEnv]
  );

  return {
    addParameter,
    addParameterExpr,
    updateExpression,
    updateName,
    removeParameter,
    getByName,
    getValue,
    // Direct access
    params: paramEnv,
    errors: paramEnv.errors,
  };
}

/**
 * Hook to get a specific parameter by ID.
 */
export function useParameter(paramId: ParamId): Parameter | undefined {
  const paramEnv = useParams();
  return paramEnv.params.get(paramId);
}

/**
 * Hook to get a parameter error by ID.
 */
export function useParamError(paramId: ParamId): string | undefined {
  const paramEnv = useParams();
  return paramEnv.errors.get(paramId);
}
