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
  it('numbers every 10 mm from 0 up to the length', () => {
    expect(rulerNumbers(35)).toEqual([0, 10, 20, 30]);
  });

  it('includes the length when it is a multiple of 10', () => {
    expect(rulerNumbers(30)).toEqual([0, 10, 20, 30]);
  });
});
