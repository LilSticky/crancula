import {describe, expect, it} from 'vitest';
import {tapePieceFileNames} from './tape-piece-file-name';

const english = (number: string, count: string): string => `${number} of ${count}`;

describe('tapePieceFileNames', () => {
  it('names the Tape pieces "<tape> <n> of <count>.svg" in order', () => {
    expect(tapePieceFileNames('Waltz', 3, english)).toEqual([
      'Waltz 1 of 3.svg',
      'Waltz 2 of 3.svg',
      'Waltz 3 of 3.svg',
    ]);
  });

  it('pads the numbers with zeros to the digits of the count, so 12 pieces sort in order', () => {
    const names = tapePieceFileNames('Waltz', 12, english);

    expect(names).toHaveLength(12);
    expect(names[0]).toBe('Waltz 01 of 12.svg');
    expect(names[9]).toBe('Waltz 10 of 12.svg');
    expect(names.at(-1)).toBe('Waltz 12 of 12.svg');
  });

  it('takes the words from the label, so the numbering follows the language of the app', () => {
    expect(tapePieceFileNames('Walzer', 2, (number, count) => `${number} von ${count}`)).toEqual([
      'Walzer 1 von 2.svg',
      'Walzer 2 von 2.svg',
    ]);
  });

  it('replaces the characters the file system does not allow in the Tape name', () => {
    expect(tapePieceFileNames('Test: 1/2', 2, english)).toEqual(['Test_ 1_2 1 of 2.svg', 'Test_ 1_2 2 of 2.svg']);
  });

  it('replaces the characters the file system does not allow in the label', () => {
    expect(tapePieceFileNames('Waltz', 2, (number, count) => `${number} of ${count}?`)).toEqual([
      'Waltz 1 of 2_.svg',
      'Waltz 2 of 2_.svg',
    ]);
  });

  it('shortens a 300-character name so the label stays whole and the stem stays within 200 characters', () => {
    const name = 'a'.repeat(300);

    expect(tapePieceFileNames(name, 3, english)).toEqual([
      `${'a'.repeat(193)} 1 of 3.svg`,
      `${'a'.repeat(193)} 2 of 3.svg`,
      `${'a'.repeat(193)} 3 of 3.svg`,
    ]);
  });
});
