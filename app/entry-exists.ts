import * as fs from 'fs';

/**
 * Whether anything is at `filePath`, a file, a folder or a symlink. Uses lstat, not access: a broken symlink is an existing
 * entry that a save would replace, so it counts as existing.
 */
export function entryExists(filePath: string): Promise<boolean> {
  return fs.promises.lstat(filePath).then(
    () => true,
    () => false,
  );
}
