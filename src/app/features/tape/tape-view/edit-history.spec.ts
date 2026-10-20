import {apply, canRedo, canUndo, editHistory, redo, undo} from './edit-history';

describe('EditHistory', () => {
  it('starts with the opened value as present and nothing to undo or redo', () => {
    const history = editHistory('opened');

    expect(history).toEqual({past: [], present: 'opened', future: []});
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it('apply pushes the present onto past, oldest first, and makes the next the present', () => {
    const history = apply(apply(editHistory('a'), 'b'), 'c');

    expect(history).toEqual({past: ['a', 'b'], present: 'c', future: []});
    expect(canUndo(history)).toBe(true);
  });

  it('undo moves one entry back and makes the undone present the next redo', () => {
    const history = undo(apply(apply(editHistory('a'), 'b'), 'c'));

    expect(history).toEqual({past: ['a'], present: 'b', future: ['c']});
    expect(canUndo(history)).toBe(true);
    expect(canRedo(history)).toBe(true);
  });

  it('redo moves one entry forward, the next redo first', () => {
    const twice = undo(undo(apply(apply(editHistory('a'), 'b'), 'c')));

    expect(twice).toEqual({past: [], present: 'a', future: ['b', 'c']});
    expect(redo(twice)).toEqual({past: ['a'], present: 'b', future: ['c']});
  });

  it('a new apply after an undo clears redo', () => {
    const history = apply(undo(apply(editHistory('a'), 'b')), 'c');

    expect(history).toEqual({past: ['a'], present: 'c', future: []});
    expect(canRedo(history)).toBe(false);
  });

  it('undo at the start and redo at the end return the same history', () => {
    const start = editHistory('a');
    const end = apply(start, 'b');

    expect(undo(start)).toBe(start);
    expect(redo(end)).toBe(end);
  });

  it('is immutable: each call returns a new history and leaves the old one alone', () => {
    const before = editHistory('a');
    const after = apply(before, 'b');

    expect(after).not.toBe(before);
    expect(before).toEqual({past: [], present: 'a', future: []});
    expect(undo(after)).not.toBe(after);
    expect(after).toEqual({past: ['a'], present: 'b', future: []});
  });

  it('n applies followed by n undos give the opening present', () => {
    const edits = Array.from({length: 25}, (_, index) => index + 1);
    const applied = edits.reduce(apply, editHistory(0));
    const undone = edits.reduce((history) => undo(history), applied);

    expect(applied.present).toBe(25);
    expect(undone.present).toBe(0);
    expect(canUndo(undone)).toBe(false);
  });
});
