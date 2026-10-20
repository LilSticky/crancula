import {editIntent, historyIntent, type EditKeyEvent} from './edit-keys';

function key(name: string, modifiers: Partial<Omit<EditKeyEvent, 'key'>> = {}): EditKeyEvent {
  return {key: name, altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, ...modifiers};
}

describe('editIntent', () => {
  it('moves the Hole one Column earlier or later with Alt + left or right', () => {
    expect(editIntent(key('ArrowLeft', {altKey: true}))).toEqual({kind: 'move-column', by: -1});
    expect(editIntent(key('ArrowRight', {altKey: true}))).toEqual({kind: 'move-column', by: 1});
  });

  it('moves the Hole to the row above or below with Alt + up or down', () => {
    expect(editIntent(key('ArrowUp', {altKey: true}))).toEqual({kind: 'move-row', by: -1});
    expect(editIntent(key('ArrowDown', {altKey: true}))).toEqual({kind: 'move-row', by: 1});
  });

  it('moves the end one Column with Shift + left or right', () => {
    expect(editIntent(key('ArrowLeft', {shiftKey: true}))).toEqual({kind: 'move-end', by: -1});
    expect(editIntent(key('ArrowRight', {shiftKey: true}))).toEqual({kind: 'move-end', by: 1});
  });

  it('moves the start one Column with Alt + Shift + left or right', () => {
    expect(editIntent(key('ArrowLeft', {altKey: true, shiftKey: true}))).toEqual({kind: 'move-start', by: -1});
    expect(editIntent(key('ArrowRight', {altKey: true, shiftKey: true}))).toEqual({kind: 'move-start', by: 1});
  });

  it('removes the Hole with Delete or Backspace', () => {
    expect(editIntent(key('Delete'))).toEqual({kind: 'remove'});
    expect(editIntent(key('Backspace'))).toEqual({kind: 'remove'});
  });

  it('has no edit intent for the selection keys', () => {
    for (const name of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ', 'Escape']) {
      expect(editIntent(key(name))).toBeUndefined();
    }
  });

  it('has no edit intent for Ctrl or Meta combinations', () => {
    expect(editIntent(key('ArrowRight', {altKey: true, ctrlKey: true}))).toBeUndefined();
    expect(editIntent(key('ArrowRight', {shiftKey: true, metaKey: true}))).toBeUndefined();
    expect(editIntent(key('Delete', {ctrlKey: true}))).toBeUndefined();
  });

  it('has no edit intent for Shift or Alt + Shift with up or down', () => {
    expect(editIntent(key('ArrowUp', {shiftKey: true}))).toBeUndefined();
    expect(editIntent(key('ArrowDown', {altKey: true, shiftKey: true}))).toBeUndefined();
  });
});

describe('historyIntent', () => {
  function historyKey(
    name: string,
    modifiers: Partial<Omit<EditKeyEvent, 'key'>> = {},
    tagName = 'svg',
  ): EditKeyEvent & {readonly target: {readonly tagName: string}} {
    return {...key(name, modifiers), target: {tagName}};
  }

  it('undoes with Ctrl + Z on Windows and Linux', () => {
    for (const platform of ['win32', 'linux'] as const) {
      expect(historyIntent(historyKey('z', {ctrlKey: true}), platform)).toEqual({kind: 'undo'});
    }
  });

  it('redoes with Ctrl + Y and Ctrl + Shift + Z on Windows and Linux', () => {
    for (const platform of ['win32', 'linux'] as const) {
      expect(historyIntent(historyKey('y', {ctrlKey: true}), platform)).toEqual({kind: 'redo'});
      expect(historyIntent(historyKey('Z', {ctrlKey: true, shiftKey: true}), platform)).toEqual({kind: 'redo'});
    }
  });

  it('undoes with Cmd + Z and redoes with Cmd + Shift + Z on macOS', () => {
    expect(historyIntent(historyKey('z', {metaKey: true}), 'darwin')).toEqual({kind: 'undo'});
    expect(historyIntent(historyKey('Z', {metaKey: true, shiftKey: true}), 'darwin')).toEqual({kind: 'redo'});
  });

  it('ignores the other modifier on each platform', () => {
    expect(historyIntent(historyKey('z', {metaKey: true}), 'win32')).toBeUndefined();
    expect(historyIntent(historyKey('z', {metaKey: true}), 'linux')).toBeUndefined();
    expect(historyIntent(historyKey('z', {ctrlKey: true}), 'darwin')).toBeUndefined();
    expect(historyIntent(historyKey('y', {ctrlKey: true}), 'darwin')).toBeUndefined();
  });

  it('has no history intent without a modifier or for other keys', () => {
    expect(historyIntent(historyKey('z'), 'win32')).toBeUndefined();
    expect(historyIntent(historyKey('x', {ctrlKey: true}), 'win32')).toBeUndefined();
  });

  it('has no history intent for events from an input or textarea', () => {
    expect(historyIntent(historyKey('z', {ctrlKey: true}, 'INPUT'), 'win32')).toBeUndefined();
    expect(historyIntent(historyKey('z', {ctrlKey: true}, 'TEXTAREA'), 'linux')).toBeUndefined();
    expect(historyIntent(historyKey('z', {metaKey: true}, 'input'), 'darwin')).toBeUndefined();
  });
});
