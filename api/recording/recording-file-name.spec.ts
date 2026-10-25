import {describe, expect, it} from 'vitest';
import {recordingFileName} from './recording-file-name';

describe('recordingFileName', () => {
  it('keeps a plain name without an extension', () => {
    expect(recordingFileName('Waltz')).toBe('Waltz');
  });

  it('replaces path separators and the characters Windows forbids with _', () => {
    expect(recordingFileName('Test: 1/2')).toBe('Test_ 1_2');
    expect(recordingFileName('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });

  it('replaces control characters with _', () => {
    expect(recordingFileName('a\u0000b\u001fc\u007fd')).toBe('a_b_c_d');
  });

  it('removes leading and trailing spaces and trailing dots', () => {
    expect(recordingFileName('  Waltz  ')).toBe('Waltz');
    expect(recordingFileName('Waltz...')).toBe('Waltz');
    expect(recordingFileName(' Waltz. . ')).toBe('Waltz');
  });

  it.each(['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT9', 'con', 'Nul'])(
    'puts a _ in front of the Windows device name %s',
    (name) => {
      expect(recordingFileName(name)).toBe(`_${name}`);
    },
  );

  it('leaves names that only start with a device name alone', () => {
    expect(recordingFileName('CONCERT')).toBe('CONCERT');
    expect(recordingFileName('COM10')).toBe('COM10');
  });

  it('cuts the name to 200 UTF-16 code units', () => {
    expect(recordingFileName('a'.repeat(300))).toBe('a'.repeat(200));
  });

  it('does not split a surrogate pair when cutting', () => {
    const name = `${'a'.repeat(199)}\u{1D11E}tail`;

    expect(recordingFileName(name)).toBe('a'.repeat(199));
  });

  it.each(['', '   ', '...', ' . '])('becomes Tape when nothing is left of %j', (name) => {
    expect(recordingFileName(name)).toBe('Tape');
  });

  it('keeps dots inside the name, because the dialog adds the extension', () => {
    expect(recordingFileName('Waltz No. 2')).toBe('Waltz No. 2');
  });

  it('never returns a path', () => {
    const result = recordingFileName('../../etc/passwd');

    expect(result).not.toMatch(/[\\/]/);
  });
});
