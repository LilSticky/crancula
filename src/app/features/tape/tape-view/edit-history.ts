/** Undo and redo over a sequence of values; every function returns a new history. */
export interface EditHistory<T> {
  /** Entries before the present, oldest first. */
  readonly past: readonly T[];
  /** What is shown and stored. */
  readonly present: T;
  /** Undone entries, next redo first. */
  readonly future: readonly T[];
}

export function editHistory<T>(opened: T): EditHistory<T> {
  return {past: [], present: opened, future: []};
}

/** Makes `next` the present; the old present becomes undoable and redo is cleared. */
export function apply<T>(history: EditHistory<T>, next: T): EditHistory<T> {
  return {past: [...history.past, history.present], present: next, future: []};
}

export function canUndo<T>(history: EditHistory<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: EditHistory<T>): boolean {
  return history.future.length > 0;
}

/** Moves one entry back; the same history when there is nothing to undo. */
export function undo<T>(history: EditHistory<T>): EditHistory<T> {
  if (!canUndo(history)) return history;
  const previous = history.past[history.past.length - 1];
  return {past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future]};
}

/** Moves one entry forward; the same history when there is nothing to redo. */
export function redo<T>(history: EditHistory<T>): EditHistory<T> {
  if (!canRedo(history)) return history;
  const [next, ...rest] = history.future as [T, ...T[]]; // `canRedo` guarantees an entry.
  return {past: [...history.past, history.present], present: next, future: rest};
}
