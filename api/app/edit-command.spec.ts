import {describe, expect, it} from 'vitest';
import * as api from '../index';
import {isEditCommand, type EditCommand} from './edit-command';

describe('isEditCommand', () => {
  it.each(['undo', 'redo'])('accepts the Edit Command %s', (value) => {
    expect(isEditCommand(value)).toBe(true);
  });

  it.each([['cut'], ['Undo'], ['REDO'], ['paste'], [''], [null], [undefined], [42], [{}]])(
    'rejects %j',
    (value) => {
      expect(isEditCommand(value)).toBe(false);
    },
  );

  it('narrows to EditCommand', () => {
    const value: unknown = 'redo';
    if (!isEditCommand(value)) throw new Error('expected an Edit Command');
    const command: EditCommand = value;
    expect(command).toBe('redo');
  });

  it('is exported from the api entry point', () => {
    expect(api.isEditCommand).toBe(isEditCommand);
  });
});
