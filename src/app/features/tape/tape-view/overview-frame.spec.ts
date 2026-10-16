import {overviewFrame, scrollLeftFor} from './overview-frame';

// A drawing of 2000 px seen through a stage of 500 px, mirrored in an overview strip of 400 px.
describe('overviewFrame', () => {
  it('frames the visible part of the drawing, scaled to the overview', () => {
    expect(overviewFrame(0, 500, 2000, 400)).toEqual({x: 0, width: 100});
    expect(overviewFrame(1000, 500, 2000, 400)).toEqual({x: 200, width: 100});
  });

  it('frames the whole overview when the drawing fits the stage', () => {
    expect(overviewFrame(0, 500, 400, 400)).toEqual({x: 0, width: 400});
    expect(overviewFrame(0, 500, 500, 400)).toEqual({x: 0, width: 400});
  });
});

describe('scrollLeftFor', () => {
  it('centres the clicked point in the stage', () => {
    // 200 of 400 px is 1000 of 2000 px; centred in 500 px that scrolls to 750.
    expect(scrollLeftFor(200, 400, 2000, 500)).toBe(750);
  });

  it('does not scroll before the start', () => {
    expect(scrollLeftFor(10, 400, 2000, 500)).toBe(0);
  });

  it('does not scroll past the end', () => {
    expect(scrollLeftFor(400, 400, 2000, 500)).toBe(1500);
  });

  it('stays at 0 when the drawing fits the stage', () => {
    expect(scrollLeftFor(200, 400, 400, 500)).toBe(0);
  });
});
