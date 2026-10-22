/** An Edit Command the application menu sends to the renderer: Undo or Redo of the Tape. */
export type EditCommand = 'undo' | 'redo';

export function isEditCommand(value: unknown): value is EditCommand {
  return value === 'undo' || value === 'redo';
}
