import {describe, expect, it} from 'vitest';
import {DEVICE_NAME, safeFileName} from './safe-file-name';

describe('DEVICE_NAME', () => {
  it.each(['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT9', 'COM0', 'LPT0', 'COM¹', 'COM²', 'COM³', 'LPT¹', 'LPT²', 'LPT³'])(
    'matches the device name %j',
    (name) => {
      expect(DEVICE_NAME.test(name)).toBe(true);
    },
  );

  it.each(['CONIN$', 'CONOUT$', 'conin$', 'conout$', 'CONIN$.svg', 'com¹.svg', 'LPT0.txt'])('matches %j with or without an extension', (name) => {
    expect(DEVICE_NAME.test(name)).toBe(true);
  });

  it.each(['COM10', 'COM¹⁰', 'LPT¹⁰', 'CONIN', 'CONOUT', 'CONIN$x', 'COM', 'Waltz', 'CONX'])('does not match %j', (name) => {
    expect(DEVICE_NAME.test(name)).toBe(false);
  });
});

describe('safeFileName', () => {
  it.each(['COM0', 'LPT0', 'COM¹', 'LPT³', 'CONIN$', 'conout$'])('prefixes the device name %j with an underscore', (name) => {
    expect(safeFileName(name)).toBe(`_${name}`);
  });
});
