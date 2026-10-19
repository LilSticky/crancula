export interface EditKeyEvent {
  readonly key: string;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}

export type EditIntent =
  | {readonly kind: 'move-column' | 'move-row' | 'move-start' | 'move-end'; readonly by: -1 | 1}
  | {readonly kind: 'remove'};

/** What a key press edits on the selected Hole, if anything. Plain arrows only select. */
export function editIntent(event: EditKeyEvent): EditIntent | undefined {
  if (event.ctrlKey || event.metaKey) return undefined;
  if (event.key === 'Delete' || event.key === 'Backspace') return {kind: 'remove'};
  const horizontal = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : undefined;
  if (horizontal !== undefined) {
    if (event.altKey && event.shiftKey) return {kind: 'move-start', by: horizontal};
    if (event.altKey) return {kind: 'move-column', by: horizontal};
    if (event.shiftKey) return {kind: 'move-end', by: horizontal};
    return undefined;
  }
  const vertical = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : undefined;
  if (vertical !== undefined && event.altKey && !event.shiftKey) return {kind: 'move-row', by: vertical};
  return undefined;
}

export type Platform = 'win32' | 'linux' | 'darwin';

export interface HistoryKeyEvent extends EditKeyEvent {
  readonly target: {readonly tagName: string} | null;
}

export type HistoryIntent = {readonly kind: 'undo' | 'redo'};

/** Undo or redo for a key press: Ctrl on Windows and Linux, Cmd on macOS. Text fields keep their own history. */
export function historyIntent(event: HistoryKeyEvent, platform: Platform): HistoryIntent | undefined {
  const tag = event.target?.tagName.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA') return undefined;
  const mac = platform === 'darwin';
  if (mac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) return undefined;
  const key = event.key.toLowerCase();
  if (key === 'z') return {kind: event.shiftKey ? 'redo' : 'undo'};
  if (key === 'y' && !mac && !event.shiftKey) return {kind: 'redo'};
  return undefined;
}
