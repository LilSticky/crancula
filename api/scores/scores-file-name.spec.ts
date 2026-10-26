/*
 * Expected API of api/scores/scores-file-name.ts (T011, data-model.md "Tempo and file name"):
 *
 *   scoresFileName(tapeName: string): string   // safeFileName(tapeName) + '.musicxml'
 */
import {describe, expect, it} from 'vitest';
import {scoresFileName} from './scores-file-name';

describe('scoresFileName names a Scores file after its Tape (FR-015)', () => {
  it('appends .musicxml to a plain Tape name', () => {
    expect(scoresFileName('Waltz')).toBe('Waltz.musicxml');
  });

  it('replaces the characters Windows forbids with _, as safeFileName does', () => {
    expect(scoresFileName('Waltz: Act/1?')).toBe('Waltz_ Act_1_.musicxml');
  });
});
