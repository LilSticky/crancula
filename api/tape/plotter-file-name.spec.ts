import {describe, expect, it} from 'vitest';
import {plotterFileName} from './plotter-file-name';

describe('plotterFileName', () => {
  it('appends .svg to a plain name', () => {
    expect(plotterFileName('Waltz')).toBe('Waltz.svg');
  });

  it('replaces path separators and the characters Windows forbids with _', () => {
    expect(plotterFileName('Test: 1/2')).toBe('Test_ 1_2.svg');
    expect(plotterFileName('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j.svg');
  });

  it('replaces control characters with _', () => {
    expect(plotterFileName('a\u0000b\u001fc\u007fd')).toBe('a_b_c_d.svg');
  });

  it('removes leading and trailing spaces and trailing dots', () => {
    expect(plotterFileName('  Waltz  ')).toBe('Waltz.svg');
    expect(plotterFileName('Waltz...')).toBe('Waltz.svg');
    expect(plotterFileName(' Waltz. . ')).toBe('Waltz.svg');
  });

  it.each(['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM9', 'LPT1', 'LPT9', 'con', 'Nul', 'com3', 'lpt7'])(
    'puts a _ in front of the Windows device name %s',
    (name) => {
      expect(plotterFileName(name)).toBe(`_${name}.svg`);
    },
  );

  it('puts a _ in front of a device name before a dot', () => {
    expect(plotterFileName('CON.txt')).toBe('_CON.txt.svg');
    expect(plotterFileName('aux.v2')).toBe('_aux.v2.svg');
  });

  it('leaves names that only start with a device name alone', () => {
    expect(plotterFileName('CONCERT')).toBe('CONCERT.svg');
    expect(plotterFileName('COM10')).toBe('COM10.svg');
  });

  it('cuts the name to 200 UTF-16 code units before .svg', () => {
    expect(plotterFileName('a'.repeat(300))).toBe(`${'a'.repeat(200)}.svg`);
  });

  it('does not split a surrogate pair when cutting', () => {
    const name = `${'a'.repeat(199)}\u{1D11E}tail`;

    expect(plotterFileName(name)).toBe(`${'a'.repeat(199)}.svg`);
  });

  it('keeps a surrogate pair that fits exactly', () => {
    const name = `${'a'.repeat(198)}\u{1D11E}tail`;

    expect(plotterFileName(name)).toBe(`${'a'.repeat(198)}\u{1D11E}.svg`);
  });

  it.each(['', '   ', '...', ' . '])('becomes Tape.svg when nothing is left of %j', (name) => {
    expect(plotterFileName(name)).toBe('Tape.svg');
  });

  it('never returns a path', () => {
    const result = plotterFileName('../../etc/passwd');

    expect(result).not.toMatch(/[\\/]/);
    expect(result.endsWith('.svg')).toBe(true);
  });
});
