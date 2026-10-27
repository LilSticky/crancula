import {describe, expect, it} from 'vitest';
import {DEFAULT_OVERLAP, DEFAULT_TAPE_SPACING, newPlotterId, plotterId} from './plotter';

describe('plotterId', () => {
  it('accepts a UUID', () => {
    expect(plotterId('3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f')).toBe('3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f');
  });

  it.each(['', 'plotter-1'])('rejects "%s"', (value) => {
    expect(plotterId(value)).toBeUndefined();
  });
});

describe('newPlotterId', () => {
  it('creates a UUID', () => {
    const id = newPlotterId();
    expect(plotterId(id)).toBe(id);
  });

  it('creates a new id each time', () => {
    expect(newPlotterId()).not.toBe(newPlotterId());
  });
});

describe('DEFAULT_OVERLAP', () => {
  it('is 20 mm', () => {
    expect(DEFAULT_OVERLAP).toBe(20);
  });
});

describe('DEFAULT_TAPE_SPACING', () => {
  it('is 3 mm', () => {
    expect(DEFAULT_TAPE_SPACING).toBe(3);
  });
});
