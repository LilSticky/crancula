import {rackColumns} from './pipe-rack';

describe('rackColumns', () => {
  it('gives the rows per column, read down then across', () => {
    expect(rackColumns(31, 3)).toEqual([11, 11, 9]);
    expect(rackColumns(31, 2)).toEqual([16, 15]);
  });

  it('gives no columns for no Pipes', () => {
    expect(rackColumns(0, 3)).toEqual([]);
  });
});
