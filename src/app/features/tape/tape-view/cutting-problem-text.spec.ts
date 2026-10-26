import {column, type Column, type NoJoinProblem} from '@api/index';
import {cuttingProblemText} from './cutting-problem-text';

function col(value: number): Column {
  const result = column(value);
  if (result === undefined) throw new Error(`invalid test Column ${value}`);
  return result;
}

/** A stretch of Columns 1 to 101 that no Join cuts for a Plotter of 300 mm working length. */
const NO_JOIN: NoJoinProblem = {code: 'no-join', start: col(0), last: col(100), plotterName: 'Cutting mat', workingLengthMm: 300};

describe('cuttingProblemText', () => {
  it('names a stretch by its Columns counted from 1, the Plotter and its working length in mm', () => {
    expect(cuttingProblemText(NO_JOIN, 'en')).toEqual({
      key: 'TAPE.CUTTING_PROBLEM.NO_JOIN',
      params: {first: '1', last: '101', plotter: 'Cutting mat', length: '300'},
    });
  });

  it('writes the working length of a stretch with the decimal comma in German', () => {
    const {params} = cuttingProblemText({...NO_JOIN, workingLengthMm: 300.5}, 'de');

    expect(params['length']).toBe('300,5');
  });

  it('counts the first and last Column of a later stretch from 1 as well', () => {
    const later: NoJoinProblem = {...NO_JOIN, start: col(119), last: col(199)};

    expect(cuttingProblemText(later, 'en').params).toMatchObject({first: '120', last: '200'});
  });
});
