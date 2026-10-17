import {type ElectronApplication} from '@playwright/test';

/** The options of one `dialog.showSaveDialog` call that tests look at. */
export interface SaveDialogCall {
  readonly title?: string;
  readonly defaultPath?: string;
  readonly filters?: readonly {readonly name: string; readonly extensions: readonly string[]}[];
}

/** What the stubbed dialog answers next: the chosen path, or `'cancel'`. */
export type SaveDialogAnswer = string;

export interface SaveDialogStub {
  /** Queues the answer for the next dialog; later dialogs without an answer are cancelled. */
  answerWith(answer: SaveDialogAnswer): Promise<void>;
  /** The options of every dialog opened since the stub was installed. */
  calls(): Promise<readonly SaveDialogCall[]>;
}

interface StubState {
  answers: SaveDialogAnswer[];
  calls: SaveDialogCall[];
}

const STATE_KEY = '__cranculaSaveDialogStub';

/**
 * Replaces `dialog.showSaveDialog` in the main process, so no native dialog opens in a test.
 * It answers the queued paths in order and records every call's options.
 */
export async function stubSaveDialog(app: ElectronApplication): Promise<SaveDialogStub> {
  await app.evaluate(({dialog}, key) => {
    const store = globalThis as unknown as Record<string, StubState | undefined>;
    const state: StubState = {answers: [], calls: []};
    store[key] = state;
    const stub = (...args: unknown[]): Promise<{canceled: boolean; filePath: string}> => {
      state.calls.push(args[args.length - 1] as SaveDialogCall);
      const answer = state.answers.shift() ?? 'cancel';
      return Promise.resolve(answer === 'cancel' ? {canceled: true, filePath: ''} : {canceled: false, filePath: answer});
    };
    (dialog as unknown as {showSaveDialog: typeof stub}).showSaveDialog = stub;
  }, STATE_KEY);
  return {
    answerWith: (answer) =>
      app.evaluate(
        (_electron, {key, value}) => {
          (globalThis as unknown as Record<string, StubState>)[key].answers.push(value);
        },
        {key: STATE_KEY, value: answer},
      ),
    calls: () =>
      app.evaluate(
        (_electron, key) => (globalThis as unknown as Record<string, StubState>)[key].calls,
        STATE_KEY,
      ),
  };
}
