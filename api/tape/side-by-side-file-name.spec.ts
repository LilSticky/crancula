import {describe, expect, it} from 'vitest';
import {isSafeFileName} from '../app/svg-save-request';
import {plotterFileName} from './plotter-file-name';
import {sideBySideFileName} from './side-by-side-file-name';

/** The English words of the count of further Lanes (TAPE.SIDE_BY_SIDE.FILE_NAME_MORE). */
const more = (count: string): string => `and ${count} more`;

describe('sideBySideFileName', () => {
  it('names the first Tape and the number of Tapes more (Story 1 scenario 4)', () => {
    expect(sideBySideFileName('Reference', 2, more)).toBe('Reference and 1 more.svg');
  });

  it('counts every Tape after the first', () => {
    expect(sideBySideFileName('Reference', 3, more)).toBe('Reference and 2 more.svg');
  });

  it('names one Lane as a single Tape file (plotterFileName)', () => {
    expect(sideBySideFileName('Reference', 1, more)).toBe('Reference.svg');
    expect(sideBySideFileName('Reference', 1, more)).toBe(plotterFileName('Reference'));
  });

  it.each([0, 1])('uses plotterFileName for %i Lanes, which never asks for the count', (laneCount) => {
    const asked = (count: string): string => `${count} more`;

    expect(sideBySideFileName('Waltz', laneCount, asked)).toBe(plotterFileName('Waltz'));
  });

  it('replaces the characters Windows forbids in the first Tape name with _', () => {
    expect(sideBySideFileName('a/b', 2, more)).toBe('a_b and 1 more.svg');
  });

  it('falls back to the name Tape for a blank first Tape name, as plotterFileName does', () => {
    expect(sideBySideFileName('   ', 2, more)).toBe('Tape and 1 more.svg');
  });

  it('puts a _ in front of a Windows device name', () => {
    expect(sideBySideFileName('CON', 2, more)).toBe('_CON and 1 more.svg');
  });

  it('shortens a 300 character name so "and 2 more" stays whole and the stem stays within 200 characters', () => {
    const name = 'a'.repeat(300);

    const result = sideBySideFileName(name, 3, more);

    expect(result).toBe(`${'a'.repeat(189)} and 2 more.svg`);
    expect(result.slice(0, -'.svg'.length).length).toBeLessThanOrEqual(200);
  });

  it.each([
    ['Reference', 2],
    ['a/b', 2],
    ['CON', 2],
    ['...', 3],
    ['a'.repeat(300), 3],
    ['Reference', 1],
  ])('gives a safe .svg file name for %j with %i Lanes (FR-014)', (name, laneCount) => {
    expect(isSafeFileName(sideBySideFileName(name, laneCount, more), 'svg')).toBe(true);
  });
});
