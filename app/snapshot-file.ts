import * as nodeFs from 'node:fs/promises';
import {join} from 'node:path';
import type {Result, SnapshotLoadResult, SnapshotSaveResult} from '../api';

/** The file operations the store needs; replaceable in tests. */
export type FileSystem = Pick<typeof nodeFs, 'mkdir' | 'readFile' | 'rename' | 'writeFile'>;

const RENAME_ATTEMPTS = 7;

export interface SnapshotFileOptions {
  /** Trailing debounce for coalescing quick saves (ADR 8). */
  readonly debounceMs?: number;
  /** First delay between attempts when the final rename is blocked (EPERM, EBUSY, EACCES); doubled after each blocked attempt. */
  readonly renameRetryDelayMs?: number;
  readonly fs?: FileSystem;
  readonly now?: () => Date;
}

/** What distinguishes one snapshot file: its name, how to validate it and how to write it out. */
export interface SnapshotFileConfig<S, V> {
  /** Name inside the snapshot folder, e.g. `organs.json`. */
  readonly fileName: string;
  readonly parse: (input: unknown) => Result<V, string>;
  /** Turns a validated value into the snapshot to write. */
  readonly normalise: (value: V) => S;
}

export interface SnapshotFile<S> {
  load(): Promise<SnapshotLoadResult<S>>;
  /** Validates untrusted `input` (e.g. from IPC) and writes it, coalesced with other quick saves. */
  save(input: unknown): Promise<SnapshotSaveResult>;
  /** Writes any pending snapshot right away. */
  flush(): Promise<void>;
}

interface PendingSave<S> {
  readonly snapshot: S;
  readonly waiters: readonly ((result: SnapshotSaveResult) => void)[];
}

/** A versioned snapshot file `<dir>/<fileName>`, written atomically and debounced (ADR 3, ADR 8). */
export function createSnapshotFile<S, V>(
  dir: string,
  config: SnapshotFileConfig<S, V>,
  options: SnapshotFileOptions = {},
): SnapshotFile<S> {
  const {fileName, parse, normalise} = config;
  const baseName = fileName.replace(/\.json$/, '');
  const {debounceMs = 250, renameRetryDelayMs = 40, fs = nodeFs, now = () => new Date()} = options;
  const filePath = join(dir, fileName);

  let pending: PendingSave<S> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing: Promise<void> | undefined;
  let blockedReason: string | undefined;

  async function load(): Promise<SnapshotLoadResult<S>> {
    let problem: string;
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = parseJson(content);
      const snapshot = parsed.ok ? parse(parsed.value) : parsed;
      if (snapshot.ok) return {status: 'loaded', snapshot: normalise(snapshot.value)};
      problem = snapshot.error;
    } catch (error) {
      if (isMissingFile(error)) return {status: 'empty'};
      problem = messageOf(error);
    }
    return moveAside(problem);
  }

  /** Moves the unusable file out of the way; if that fails, saving stays blocked so the file is never overwritten. */
  async function moveAside(problem: string): Promise<SnapshotLoadResult<S>> {
    const backupPath = join(dir, `${baseName}.unreadable-${now().toISOString().replace(/[:.]/g, '-')}.json`);
    try {
      await fs.rename(filePath, backupPath);
    } catch (error) {
      blockedReason = `the unreadable ${fileName} could not be moved aside: ${messageOf(error)}`;
      return {status: 'unreadable', backupPath: filePath, reason: `${problem}; ${blockedReason}`};
    }
    return {status: 'unreadable', backupPath, reason: problem};
  }

  function save(input: unknown): Promise<SnapshotSaveResult> {
    const parsed = parse(input);
    if (!parsed.ok) return Promise.resolve({status: 'rejected', reason: parsed.error});
    if (blockedReason) return Promise.resolve({status: 'failed', reason: blockedReason});

    return new Promise((resolve) => {
      pending = {snapshot: normalise(parsed.value), waiters: [...(pending?.waiters ?? []), resolve]};
      clearTimeout(timer);
      timer = setTimeout(() => void drain(), debounceMs);
    });
  }

  async function flush(): Promise<void> {
    clearTimeout(timer);
    await drain();
  }

  /** Writes the latest pending snapshot; at most one write runs at a time. */
  async function drain(): Promise<void> {
    timer = undefined;
    while (writing) await writing;
    if (!pending) return;

    const job = pending;
    pending = undefined;
    writing = write(job.snapshot).then((result) => {
      // A failed write stays pending for the next flush; it is not retried on its own, so there is no retry loop.
      if (result.status === 'failed') pending ??= {snapshot: job.snapshot, waiters: []};
      job.waiters.forEach((resolve) => resolve(result));
    });
    await writing;
    writing = undefined;
  }

  async function write(snapshot: S): Promise<SnapshotSaveResult> {
    const tempPath = `${filePath}.tmp`;
    try {
      await fs.mkdir(dir, {recursive: true});
      await fs.writeFile(tempPath, JSON.stringify(snapshot, null, 2), 'utf8');
      await renameWithRetry(tempPath);
      return {status: 'saved'};
    } catch (error) {
      return {status: 'failed', reason: messageOf(error)};
    }
  }

  /**
   * Windows briefly locks the target (antivirus, indexer), so a blocked final rename is retried with an
   * exponential backoff: the wait starts at `renameRetryDelayMs` and doubles after each blocked attempt.
   */
  async function renameWithRetry(tempPath: string): Promise<void> {
    let delayMs = renameRetryDelayMs;
    for (let attempt = 1; ; attempt++) {
      try {
        await fs.rename(tempPath, filePath);
        return;
      } catch (error) {
        if (attempt >= RENAME_ATTEMPTS || !isBlockedRename(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
      }
    }
  }

  return {load, save, flush};
}

function parseJson(content: string): {ok: true; value: unknown} | {ok: false; error: string} {
  try {
    return {ok: true, value: JSON.parse(content) as unknown};
  } catch (error) {
    return {ok: false, error: `not valid JSON: ${messageOf(error)}`};
  }
}

function isBlockedRename(error: unknown): boolean {
  return error instanceof Error && 'code' in error && ['EPERM', 'EBUSY', 'EACCES'].includes(String(error.code));
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
