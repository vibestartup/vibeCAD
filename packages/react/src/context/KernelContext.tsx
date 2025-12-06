/**
 * Kernel context - provides access to OCC and SLVS APIs.
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Kernel } from "@vibecad/kernel";
import { loadKernel } from "@vibecad/kernel";

// ============================================================================
// Context
// ============================================================================

interface KernelContextValue {
  kernel: Kernel | null;
  loading: boolean;
  error: string | null;
}

const KernelContext = createContext<KernelContextValue>({
  kernel: null,
  loading: true,
  error: null,
});

// ============================================================================
// Provider
// ============================================================================

interface KernelProviderProps {
  children: React.ReactNode;
  /** Optional fallback while loading */
  loadingFallback?: React.ReactNode;
  /** Optional error fallback */
  errorFallback?: React.ReactNode | ((error: string) => React.ReactNode);
}

export function KernelProvider({
  children,
  loadingFallback,
  errorFallback,
}: KernelProviderProps) {
  const [kernel, setKernel] = useState<Kernel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    loadKernel()
      .then((k) => {
        if (mounted) {
          setKernel(k);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (mounted) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading && loadingFallback) {
    return <>{loadingFallback}</>;
  }

  if (error && errorFallback) {
    return (
      <>
        {typeof errorFallback === "function" ? errorFallback(error) : errorFallback}
      </>
    );
  }

  return (
    <KernelContext.Provider value={{ kernel, loading, error }}>
      {children}
    </KernelContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Access the kernel context.
 */
export function useKernelContext(): KernelContextValue {
  return useContext(KernelContext);
}

/**
 * Get the kernel, throwing if not loaded.
 */
export function useKernel(): Kernel {
  const { kernel, loading, error } = useKernelContext();

  if (error) {
    throw new Error(`Kernel failed to load: ${error}`);
  }

  if (loading || !kernel) {
    throw new Error("Kernel not yet loaded. Use KernelProvider.");
  }

  return kernel;
}

/**
 * Get the OCC API, throwing if not loaded.
 */
export function useOcc() {
  return useKernel().occ;
}

/**
 * Get the SLVS API, throwing if not loaded.
 */
export function useSlvs() {
  return useKernel().slvs;
}
