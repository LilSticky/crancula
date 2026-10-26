import {type ElectronApplication} from '@playwright/test';

/** The options of one `dialog.showOpenDialog` call that tests look at. */
export interface FolderDialogCall {
  readonly title?: string;
  readonly buttonLabel?: string;
  readonly defaultPath?: string;
  readonly properties?: readonly string[];
}

/** The options of one `dialog.showMessageBox` call that tests look at. */
export interface MessageBoxCall {
  readonly message?: string;
  readonly detail?: string;
  readonly buttons?: readonly string[];
}

/** What the stubbed folder dialog resolves with: the chosen folder, or `canceled`. */
export interface FolderDialogAnswer {
  readonly canceled: boolean;
  readonly filePaths: readonly string[];
}

/** What the stubbed message box resolves with: the index of the button that was pressed. */
export interface MessageBoxAnswer {
  readonly response: number;
}

/** Answers queued for one replaced dialog method, and the options of every call to it. */
export interface DialogStub<Options, Answer> {
  /** Queues the answer for the next call; a call without a queued answer gets the fallback. */
  answerWith(answer: Answer): Promise<void>;
  /** The options of every call since the stub was installed. */
  calls(): Promise<readonly Options[]>;
}

interface StubState {
  answers: unknown[];
  calls: unknown[];
}

type ReplacedMethod = 'showOpenDialog' | 'showMessageBox';

/**
 * Replaces one `dialog` method in the main process, so no native dialog opens in a test.
 * It answers the queued answers in order, then the fallback, and records every call's options.
 */
async function stubDialog<Options, Answer>(
  app: ElectronApplication,
  method: ReplacedMethod,
  fallback: Answer,
): Promise<DialogStub<Options, Answer>> {
  const key = `__cranculaStub_${method}`;
  await app.evaluate(
    ({dialog}, {method, key, fallback}) => {
      const store = globalThis as unknown as Record<string, StubState>;
      const state: StubState = {answers: [], calls: []};
      store[key] = state;
      const stub = (...args: unknown[]): Promise<unknown> => {
        state.calls.push(args[args.length - 1]);
        return Promise.resolve(state.answers.shift() ?? fallback);
      };
      (dialog as unknown as Record<string, unknown>)[method] = stub;
    },
    {method, key, fallback},
  );
  return {
    answerWith: (answer) =>
      app.evaluate(
        (_electron, {key, answer}) => {
          (globalThis as unknown as Record<string, StubState>)[key]?.answers.push(answer);
        },
        {key, answer},
      ),
    calls: async () =>
      (await app.evaluate(
        (_electron, key) => (globalThis as unknown as Record<string, StubState>)[key]?.calls ?? [],
        key,
      )) as Options[],
  };
}

/** Replaces `dialog.showOpenDialog` (the folder dialog of the Tape pieces). Unanswered calls are cancelled. */
export function stubFolderDialog(app: ElectronApplication): Promise<DialogStub<FolderDialogCall, FolderDialogAnswer>> {
  return stubDialog<FolderDialogCall, FolderDialogAnswer>(app, 'showOpenDialog', {canceled: true, filePaths: []});
}

/** Replaces `dialog.showMessageBox` (the replace question). Unanswered calls press the second button, Cancel. */
export function stubMessageBox(app: ElectronApplication): Promise<DialogStub<MessageBoxCall, MessageBoxAnswer>> {
  return stubDialog<MessageBoxCall, MessageBoxAnswer>(app, 'showMessageBox', {response: 1});
}
