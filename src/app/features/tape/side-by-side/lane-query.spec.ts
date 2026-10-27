import {convertToParamMap} from '@angular/router';
import {tapeId, type TapeId} from '@api/index';
import {laneQueryParams, laneTapeIds} from './lane-query';

const FIRST_ID = '00000000-0000-4000-8000-000000000001';
const SECOND_ID = '00000000-0000-4000-8000-000000000002';

function idOf(value: string): TapeId {
  const id = tapeId(value);
  if (id === undefined) throw new Error(`invalid test Tape id: ${value}`);
  return id;
}

const first = idOf(FIRST_ID);
const second = idOf(SECOND_ID);

describe('laneTapeIds', () => {
  it('reads the Tape ids of the repeated tape parameters in their order', () => {
    expect(laneTapeIds(convertToParamMap({tape: [SECOND_ID, FIRST_ID]}))).toEqual([second, first]);
  });

  it('keeps a Tape id that is given twice, for the same Tape in two Lanes', () => {
    expect(laneTapeIds(convertToParamMap({tape: [FIRST_ID, FIRST_ID]}))).toEqual([first, first]);
  });

  it('drops the values that are not Tape ids and keeps the others in order', () => {
    expect(laneTapeIds(convertToParamMap({tape: [FIRST_ID, 'not-a-tape', SECOND_ID]}))).toEqual([first, second]);
  });

  it('reads no Tape ids without a tape parameter', () => {
    expect(laneTapeIds(convertToParamMap({}))).toEqual([]);
  });
});

describe('laneQueryParams', () => {
  it('writes the Tape ids back as repeated tape parameters in their order', () => {
    expect(laneQueryParams([second, first, second])).toEqual({tape: [SECOND_ID, FIRST_ID, SECOND_ID]});
  });

  it('writes no parameter for no Lanes', () => {
    expect(laneQueryParams([])).toEqual({tape: []});
  });
});
