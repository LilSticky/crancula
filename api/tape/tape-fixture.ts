import {DEFAULT_CRANK_SPEED, type CrankSpeed} from './crank-speed';
import {validTape, type Column, type ColumnCount, type Hole, type Tape, type TapeFields} from './tape';
import {midiNoteNumber} from '../organ/midi-note-number';
import type {Millimetres, Organ} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';

/** The fields of a Tape for specs; the Crank speed defaults to {@link DEFAULT_CRANK_SPEED}. */
export type TapeFixtureFields = Omit<TapeFields, 'crankSpeed'> & { readonly crankSpeed?: CrankSpeed };

/** For specs: the Tape for fields that are valid together, Holes sorted for convenience; throws otherwise. */
export function tapeOf(fields: TapeFixtureFields): Tape {
  const holes = [...fields.holes].sort((a, b) => a.pipe - b.pipe || a.start - b.start);
  const result = validTape({...fields, crankSpeed: fields.crankSpeed ?? DEFAULT_CRANK_SPEED, holes});
  if (!result.ok) throw new Error(`invalid Tape fixture: ${result.error.code}`);
  return result.value;
}

/** For specs: the reference Organ of spec 003: 100 mm tape, 3 mm holes, 4 mm rows, 10 Pipes, Minimum Gap 2 mm, Lead-in 50 mm. */
export function referenceOrgan(): Organ {
  const result = validateOrgan({
    name: 'Reference organ',
    tapeBed: {tapeWidth: 100, holeDiameter: 3, rowSpacing: 4},
    minimumGap: 2,
    leadIn: 50,
    slowestCrankSpeed: 30,
    fastestCrankSpeed: 120,
    tapePerCrankTurn: null,
    pipes: Array.from({length: 10}, (_, row) => ({note: 60 + row})),
  });
  if (!result.ok) throw new Error('invalid reference Organ');
  return result.value;
}

/** For specs: the reference Tape of spec 003: Column length 3 mm, 200 Columns (652 mm with Lead-in and end gap), 60 Holes. */
export function referenceTape(organ: Organ): Tape {
  const holes: Hole[] = [];
  for (let row = 0; row < 10; row += 1) {
    const note = midiNoteNumber(60 + row);
    if (note === undefined) throw new Error('not a note');
    for (let k = 0; k < 6; k += 1) {
      holes.push({pipe: note, start: (k * 32 + row * 3) as Column, length: (2 + ((k + row) % 3)) as ColumnCount});
    }
  }
  return tapeOf({
    id: '00000000-0000-4000-8000-0000000000aa' as Tape['id'],
    name: 'Reference',
    organId: organ.id,
    songId: undefined,
    selectedParts: undefined,
    transposition: 0 as Tape['transposition'],
    columnLength: 3 as Millimetres,
    length: 200 as ColumnCount,
    holes,
  });
}
