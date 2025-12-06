/**
 * History module - undo/redo functionality.
 */

// ============================================================================
// Types
// ============================================================================

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new history state with an initial value.
 */
export function createHistory<T>(initial: T): HistoryState<T> {
  return {
    past: [],
    present: initial,
    future: [],
  };
}

// ============================================================================
// Operations
// ============================================================================

/**
 * Push a new state onto the history.
 * Clears the future (redo stack).
 */
export function pushState<T>(history: HistoryState<T>, state: T): HistoryState<T> {
  return {
    past: [...history.past, history.present],
    present: state,
    future: [], // Clear redo stack
  };
}

/**
 * Undo the last action.
 * Returns the same history if nothing to undo.
 */
export function undo<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.past.length === 0) {
    return history;
  }

  const newPast = [...history.past];
  const previous = newPast.pop()!;

  return {
    past: newPast,
    present: previous,
    future: [history.present, ...history.future],
  };
}

/**
 * Redo the last undone action.
 * Returns the same history if nothing to redo.
 */
export function redo<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.future.length === 0) {
    return history;
  }

  const [next, ...newFuture] = history.future;

  return {
    past: [...history.past, history.present],
    present: next,
    future: newFuture,
  };
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Check if undo is possible.
 */
export function canUndo<T>(history: HistoryState<T>): boolean {
  return history.past.length > 0;
}

/**
 * Check if redo is possible.
 */
export function canRedo<T>(history: HistoryState<T>): boolean {
  return history.future.length > 0;
}

/**
 * Get the number of undo steps available.
 */
export function undoCount<T>(history: HistoryState<T>): number {
  return history.past.length;
}

/**
 * Get the number of redo steps available.
 */
export function redoCount<T>(history: HistoryState<T>): number {
  return history.future.length;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Clear all history (past and future), keeping only the present.
 */
export function clearHistory<T>(history: HistoryState<T>): HistoryState<T> {
  return {
    past: [],
    present: history.present,
    future: [],
  };
}

/**
 * Replace the present state without creating a new history entry.
 * Useful for "silent" updates that shouldn't be undoable.
 */
export function replacePresent<T>(history: HistoryState<T>, state: T): HistoryState<T> {
  return {
    ...history,
    present: state,
  };
}

/**
 * Limit the history to a maximum number of undo steps.
 */
export function limitHistory<T>(
  history: HistoryState<T>,
  maxUndo: number
): HistoryState<T> {
  if (history.past.length <= maxUndo) {
    return history;
  }

  return {
    past: history.past.slice(-maxUndo),
    present: history.present,
    future: history.future,
  };
}

/**
 * Go to a specific point in history by index.
 * Index 0 is the oldest state, index past.length is the present.
 */
export function goTo<T>(history: HistoryState<T>, index: number): HistoryState<T> {
  const all = [...history.past, history.present, ...history.future];
  const clampedIndex = Math.max(0, Math.min(index, all.length - 1));

  return {
    past: all.slice(0, clampedIndex),
    present: all[clampedIndex],
    future: all.slice(clampedIndex + 1),
  };
}
