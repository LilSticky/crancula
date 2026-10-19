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
