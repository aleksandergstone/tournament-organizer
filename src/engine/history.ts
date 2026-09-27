// Minimal undo/redo: snapshot-based, capped history. Snapshots are cheap
// (local projects are small). Domain state only — settings excluded.
export interface Snapshot<T> { past: T[]; present: T; future: T[]; }

export function initHistory<T>(present: T): Snapshot<T> {
  return { past: [], present, future: [] };
}

export function commit<T>(h: Snapshot<T>, next: T, cap = 100): Snapshot<T> {
  const past = [...h.past, h.present];
  if (past.length > cap) past.shift();
  return { past, present: structuredClone(next), future: [] };
}

export function undo<T>(h: Snapshot<T>): Snapshot<T> {
  if (h.past.length === 0) return h;
  const past = [...h.past];
  const present = past.pop()!;
  return { past, present, future: [h.present, ...h.future] };
}

export function redo<T>(h: Snapshot<T>): Snapshot<T> {
  if (h.future.length === 0) return h;
  const [next, ...future] = h.future;
  return { past: [...h.past, h.present], present: next, future };
}

export function canUndo<T>(h: Snapshot<T>): boolean { return h.past.length > 0; }
export function canRedo<T>(h: Snapshot<T>): boolean { return h.future.length > 0; }
