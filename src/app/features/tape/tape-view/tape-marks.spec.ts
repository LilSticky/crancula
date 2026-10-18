import {columnLines, columnNumbers, rulerNumbers} from './tape-marks';

describe('columnLines', () => {
  it('draws a line at every 8th Column, strong at every 32nd, starting at Column 1', () => {
    expect(columnLines(70)).toEqual([
      {column: 0, strong: true},
      {column: 8, strong: false},
      {column: 16, strong: false},
      {column: 24, strong: false},
      {column: 32, strong: true},
      {column: 40, strong: false},
      {column: 48, strong: false},
      {column: 56, strong: false},
      {column: 64, strong: true},
    ]);
  });

  it('draws none at or past the end of the Tape', () => {
    expect(columnLines(16).map((line) => line.column)).toEqual([0, 8]);
    expect(columnLines(17).map((line) => line.column)).toEqual([0, 8, 16]);
  });
});

describe('columnNumbers', () => {
  it('numbers the Columns from 1 under every 8-Column line', () => {
    expect(columnNumbers(30, 5).map((mark) => mark.number)).toEqual([1, 9, 17, 25]);
  });

  it('puts each number at the line of its Column', () => {
    expect(columnNumbers(20, 10)).toEqual([
      {column: 0, number: 1},
      {column: 8, number: 9},
      {column: 16, number: 17},
    ]);
  });

  it('numbers only the 32-Column lines when 8 Columns are narrower than 40 px', () => {
    expect(columnNumbers(70, 4.9).map((mark) => mark.number)).toEqual([1, 33, 65]);
  });

  it('keeps every 8-Column line numbered when 8 Columns are exactly 40 px', () => {
    expect(columnNumbers(20, 5).map((mark) => mark.number)).toEqual([1, 9, 17]);
  });
});

describe('rulerNumbers', () => {
  it('numbers every 10 mm from 0 up to the length when 10 mm are at least 40 px', () => {
    expect(rulerNumbers(35, 4)).toEqual([0, 10, 20, 30]);
  });

  it('includes the length when it is a multiple of the step', () => {
    expect(rulerNumbers(30, 4)).toEqual([0, 10, 20, 30]);
  });

  it('numbers every 50 mm for a 635 mm Tape at 1.6 px per mm', () => {
    expect(rulerNumbers(635, 1.6)).toEqual([0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600]);
  });

  it('continues with 1, 2 and 5 times 10^n mm beyond 500 mm', () => {
    expect(rulerNumbers(3000, 0.05)).toEqual([0, 1000, 2000, 3000]);
    expect(rulerNumbers(10000, 0.01)).toEqual([0, 5000, 10000]);
    expect(rulerNumbers(6000, 0.03)).toEqual([0, 2000, 4000, 6000]);
  });

  it('returns just 0 when there are no pixels per mm yet', () => {
    expect(rulerNumbers(635, 0)).toEqual([0]);
  }, 1000);

  it('takes the smallest step whose spacing is at least 40 px', () => {
    expect(rulerNumbers(100, 2)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(rulerNumbers(100, 1.99)).toEqual([0, 50, 100]);
    expect(rulerNumbers(1000, 0.5)).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
    expect(rulerNumbers(1000, 0.2)).toEqual([0, 200, 400, 600, 800, 1000]);
    expect(rulerNumbers(1000, 0.1)).toEqual([0, 500, 1000]);
  });
});
