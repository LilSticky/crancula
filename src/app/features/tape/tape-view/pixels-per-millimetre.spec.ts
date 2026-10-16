import {pixelsPerMillimetre} from './pixels-per-millimetre';

const PIXELS_PER_MILLIMETRE = 96 / 25.4;

describe('pixelsPerMillimetre', () => {
  it('is one screen millimetre (96 px per inch) at 1:1', () => {
    expect(pixelsPerMillimetre('1:1', 900, 250)).toBeCloseTo(PIXELS_PER_MILLIMETRE);
  });

  it('is twice that at 2:1', () => {
    expect(pixelsPerMillimetre('2:1', 900, 250)).toBeCloseTo(2 * PIXELS_PER_MILLIMETRE);
  });

  it('fits the Tape length into the stage width for the Whole Tape', () => {
    expect(pixelsPerMillimetre('whole', 900, 3000)).toBeCloseTo(0.3);
  });
});
