import * as nodeFs from 'node:fs/promises';
import {join} from 'node:path';
import {
  type OrganLibraryLoadResult,
  type OrganLibrarySaveResult,
  type OrganLibrarySnapshot,
  parseOrganLibrarySnapshot,
  toSnapshot,
} from '../api';

/** The file operations the store needs; replaceable in tests. */
export type FileSystem = Pick<typeof nodeFs, 'mkdir' | 'readFile' | 'rename' | 'writeFile'>;

export interface OrganLibraryFileOptions {
  /** Trailing debounce for coalescing quick saves (ADR 8). */
  readonly debounceMs?: number;
  readonly fs?: FileSystem;
  readonly now?: () => Date;
}

export interface OrganLibraryFile {
  load(): Promise<OrganLibraryLoadResult>;
  /** Validates untrusted `input` (e.g. from IPC) and writes it, coalesced with other quick saves. */
  save(input: unknown): Promise<OrganLibrarySaveResult>;
  /** Writes any pending snapshot right away. */
  flush(): Promise<void>;
}

interface PendingSave {
  readonly snapshot: OrganLibrarySnapshot;
  readonly waiters: readonly ((result: OrganLibrarySaveResult) => void)[];
}

const FILE_NAME = 'organs.json';

/** The Organ library snapshot `<dir>/organs.json` (ADR 3, ADR 8). */
export function createOrganLibraryFile(dir: string, options: OrganLibraryFileOptions = {}): OrganLibraryFile {
  const {debounceMs = 250, fs = nodeFs, now = () => new Date()} = options;
  const filePath = join(dir, FILE_NAME);

  let pending: PendingSave | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing: Promise<void> | undefined;

  async function load(): Promise<OrganLibraryLoadResult> {
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (isMissingFile(error)) return {status: 'empty'};
      return {status: 'unreadable', backupPath: filePath, reason: messageOf(error)};
    }

    const parsed = parseJson(content);
    const snapshot = parsed.ok ? parseOrganLibrarySnapshot(parsed.value) : parsed;
    if (snapshot.ok) return {status: 'loaded', snapshot: toSnapshot(snapshot.value)};

    const backupPath = join(dir, `organs.unreadable-${now().toISOString().replace(/[:.]/g, '-')}.json`);
    await fs.rename(filePath, backupPath);
    return {status: 'unreadable', backupPath, reason: snapshot.error};
  }

  function save(input: unknown): Promise<OrganLibrarySaveResult> {
    const parsed = parseOrganLibrarySnapshot(input);
    if (!parsed.ok) return Promise.resolve({status: 'rejected', reason: parsed.error});

    return new Promise((resolve) => {
      pending = {snapshot: toSnapshot(parsed.value), waiters: [...(pending?.waiters ?? []), resolve]};
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
    writing = write(job.snapshot).then((result) => job.waiters.forEach((resolve) => resolve(result)));
    await writing;
    writing = undefined;
  }

  async function write(snapshot: OrganLibrarySnapshot): Promise<OrganLibrarySaveResult> {
    const tempPath = `${filePath}.tmp`;
    try {
      await fs.mkdir(dir, {recursive: true});
      await fs.writeFile(tempPath, JSON.stringify(snapshot, null, 2), 'utf8');
      await fs.rename(tempPath, filePath);
      return {status: 'saved'};
    } catch (error) {
      return {status: 'failed', reason: messageOf(error)};
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

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
