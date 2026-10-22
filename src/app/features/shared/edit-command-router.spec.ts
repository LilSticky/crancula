import {TestBed} from '@angular/core/testing';
import {vi} from 'vitest';
import type {CranculaApi, EditCommand} from '@api/index';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../core/crancula-api.token';
import {EditCommandRouter} from './edit-command-router';

/** A CranculaApi whose edit.onCommand keeps the listener, so a test can send Edit Commands as the menu would. */
function setup(): {readonly send: (command: EditCommand) => void} {
  let listener: ((command: EditCommand) => void) | undefined;
  const api: CranculaApi = {
    ...createInMemoryCranculaApi(),
    edit: {
      onCommand: (received) => {
        listener = received;
        return () => {
          listener = undefined;
        };
      },
    },
  };
  TestBed.configureTestingModule({providers: [{provide: CRANCULA_API, useValue: api}]});
  TestBed.inject(EditCommandRouter);
  return {
    send: (command) => {
      if (!listener) throw new Error('the router does not subscribe to edit.onCommand');
      listener(command);
    },
  };
}

const focused: HTMLElement[] = [];

/** Puts the element in the document and gives it the focus, as a user would by clicking it. */
function focus(element: HTMLElement): void {
  document.body.append(element);
  focused.push(element);
  element.focus();
}

const editableFields: readonly [string, () => HTMLElement][] = [
  ['an input', () => document.createElement('input')],
  ['a textarea', () => document.createElement('textarea')],
  [
    'a contenteditable element',
    () => {
      const element = document.createElement('div');
      element.setAttribute('contenteditable', 'true');
      element.tabIndex = 0;
      return element;
    },
  ],
];

describe('EditCommandRouter', () => {
  let execCommand: ReturnType<typeof vi.fn<(commandId: string) => boolean>>;

  beforeEach(() => {
    // The text history is the browser's; jsdom may not provide execCommand at all, so the test provides one.
    execCommand = vi.fn<(commandId: string) => boolean>(() => true);
    Object.defineProperty(document, 'execCommand', {configurable: true, writable: true, value: execCommand});
  });

  afterEach(() => {
    for (const element of focused.splice(0)) element.remove();
    Reflect.deleteProperty(document, 'execCommand');
  });

  it.each(['undo', 'redo'] as const)('hands the %s command to the registered handler', (command) => {
    const {send} = setup();
    const handler = vi.fn<(received: EditCommand) => void>();
    TestBed.inject(EditCommandRouter).register(handler);

    send(command);

    expect(handler).toHaveBeenCalledExactlyOnceWith(command);
    expect(execCommand).not.toHaveBeenCalled();
  });

  it.each(editableFields)('runs the text undo, not the handler, while %s has the focus', (_label, create) => {
    const {send} = setup();
    const handler = vi.fn<(received: EditCommand) => void>();
    TestBed.inject(EditCommandRouter).register(handler);
    focus(create());

    send('undo');

    expect(execCommand).toHaveBeenCalledExactlyOnceWith('undo');
    expect(handler).not.toHaveBeenCalled();
  });

  it('runs the text command when no handler is registered', () => {
    const {send} = setup();
    TestBed.inject(EditCommandRouter);

    send('redo');

    expect(execCommand).toHaveBeenCalledExactlyOnceWith('redo');
  });

  it('runs the text command again once the handler is unregistered', () => {
    const {send} = setup();
    const handler = vi.fn<(received: EditCommand) => void>();
    const unregister = TestBed.inject(EditCommandRouter).register(handler);

    unregister();
    send('undo');

    expect(handler).not.toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledExactlyOnceWith('undo');
  });
});
