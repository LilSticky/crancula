import {describe, expect, it} from 'vitest';
import {parseTapeLibrarySnapshot, toTapeLibrarySnapshot} from './tape-library-snapshot';

const SONG_A = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';
const SONG_B = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const TAPE_A = '11111111-2222-4333-8444-555555555555';
const TAPE_B = '66666666-7777-4888-8999-aaaaaaaaaaaa';
const ORGAN = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
const TICK_LIMIT = 2 ** 31;

function songSnapshot(id = SONG_A) {
  return {
    id,
    name: 'Fur Elise',
    ticksPerQuarter: 480,
    parts: [
      {name: 'Right hand', percussion: false, notes: [[64, 0, 240], [60, 240, 240], [64, 240, 240]]},
      {percussion: true, notes: [[36, 0, 0]]},
    ],
  };
}

/** A Tape as stored in version 2, with its Crank speed. */
function tapeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: TAPE_A,
    name: 'Fur Elise on Street organ',
    organId: ORGAN,
    songId: SONG_A,
    selectedParts: [0, 1],
    transposition: -2,
    columnLength: 2.5,
    crankSpeed: 60,
    length: 10,
    holes: [[60, 0, 2], [60, 4, 1], [64, 2, 3]],
    ...overrides,
  };
}

/** A Tape as stored in version 1, which has no Crank speed. */
function tapeSnapshotV1(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const tape: Record<string, unknown> = {...tapeSnapshot(overrides)};
  delete tape['crankSpeed'];
  return tape;
}

function snapshot(overrides: Record<string, unknown> = {}) {
  return {version: 2, songs: [songSnapshot()], tapes: [tapeSnapshot()], ...overrides};
}

function withSong(song: Record<string, unknown>) {
  // The Tape keeps referencing the changed Song, selecting all of its Parts, so a case tests only its own change.
  const changed = {...songSnapshot(), ...song};
  const parts = Array.isArray(changed.parts) ? changed.parts : [];
  return snapshot({
    songs: [changed],
    tapes: [tapeSnapshot({songId: changed.id, selectedParts: parts.map((_, index) => index)})],
  });
}

function withNotes(notes: unknown[]) {
  return withSong({parts: [{percussion: false, notes}]});
}

function withHoles(holes: unknown[]) {
  return snapshot({tapes: [tapeSnapshot({holes})]});
}

describe('parseTapeLibrarySnapshot', () => {
  it('reads Songs and Tapes in their order', () => {
    const result = parseTapeLibrarySnapshot(
      snapshot({
        songs: [songSnapshot(SONG_A), songSnapshot(SONG_B)],
        tapes: [tapeSnapshot(), tapeSnapshot({id: TAPE_B, name: 'Second', songId: SONG_B})],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.songs.map((song) => song.id)).toEqual([SONG_A, SONG_B]);
    expect(result.value.tapes.map((tape) => tape.name)).toEqual(['Fur Elise on Street organ', 'Second']);
    expect(result.value.tapes[0].selectedParts).toEqual([0, 1]);
    expect(result.value.tapes[0].holes.map((hole) => [hole.pipe, hole.start, hole.length])).toEqual([
      [60, 0, 2],
      [60, 4, 1],
      [64, 2, 3],
    ]);
  });

  it('reads the Crank speed of each Tape', () => {
    const result = parseTapeLibrarySnapshot(snapshot({tapes: [tapeSnapshot({crankSpeed: 72.5})]}));

    expect(result.ok && result.value.tapes[0].crankSpeed).toBe(72.5);
  });

  it('reads a version 1 snapshot with every Tape at the default Crank speed of 60', () => {
    const result = parseTapeLibrarySnapshot({
      version: 1,
      songs: [songSnapshot()],
      tapes: [tapeSnapshotV1(), tapeSnapshotV1({id: TAPE_B, name: 'Second'})],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tapes.map((tape) => tape.crankSpeed)).toEqual([60, 60]);
  });

  it('reads a version 1 Tape exactly as a version 2 Tape with Crank speed 60', () => {
    const fromVersion1 = parseTapeLibrarySnapshot({version: 1, songs: [songSnapshot()], tapes: [tapeSnapshotV1()]});
    const fromVersion2 = parseTapeLibrarySnapshot(snapshot());

    expect(fromVersion1).toEqual(fromVersion2);
  });

  it.each([
    ['missing', undefined],
    ['0', 0],
    ['301', 301],
    ['a string', '60'],
  ])('rejects a version 2 Tape whose Crank speed is %s', (_, crankSpeedInput) => {
    const result = parseTapeLibrarySnapshot(snapshot({tapes: [tapeSnapshot({crankSpeed: crankSpeedInput})]}));

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('crankSpeed');
  });

  it('reads an empty library', () => {
    const result = parseTapeLibrarySnapshot({version: 2, songs: [], tapes: []});
    expect(result).toEqual({ok: true, value: {songs: [], tapes: []}});
  });

  it('accepts a Tape with no Holes', () => {
    expect(parseTapeLibrarySnapshot(withHoles([])).ok).toBe(true);
  });

  it('accepts a Tape whose Organ is unknown and never checks Organ-relative rules', () => {
    // Pipe 5 and a Hole of length 1 need not fit any Organ; the Organ is not known here.
    expect(parseTapeLibrarySnapshot(snapshot({tapes: [tapeSnapshot({holes: [[5, 0, 1]]})]})).ok).toBe(true);
  });

  it('accepts a Hole that ends exactly at the end of the Tape', () => {
    expect(parseTapeLibrarySnapshot(withHoles([[60, 8, 2]])).ok).toBe(true);
  });

  it('accepts Notes that share a start when ordered by note number, and a Note of duration 0', () => {
    expect(parseTapeLibrarySnapshot(withNotes([[60, 0, 0], [64, 0, 10], [60, 5, 5]])).ok).toBe(true);
  });

  it.each([
    ['not an object', 'oops'],
    ['null', null],
    ['a missing version', {songs: [], tapes: []}],
    ['an unknown version', {version: 3, songs: [], tapes: []}],
    ['songs that are not a list', snapshot({songs: {}})],
    ['tapes that are not a list', snapshot({tapes: 'none'})],
    ['a Tape that is not an object', snapshot({tapes: [42]})],
    ['a Song that is not an object', snapshot({songs: [42]})],
    ['a non-UUID Song id', withSong({id: 'song-1'})],
    ['a duplicate Song id', snapshot({songs: [songSnapshot(), songSnapshot()]})],
    ['a blank Song name', withSong({name: '   '})],
    ['ticksPerQuarter 0', withSong({ticksPerQuarter: 0})],
    ['ticksPerQuarter above 32767', withSong({ticksPerQuarter: 32768})],
    ['a fractional ticksPerQuarter', withSong({ticksPerQuarter: 480.5})],
    ['a Song without Parts', withSong({parts: []})],
    ['a Part without Notes', withSong({parts: [{percussion: false, notes: []}]})],
    ['a blank Part name', withSong({parts: [{name: ' ', percussion: false, notes: [[60, 0, 1]]}]})],
    ['a Part without percussion flag', withSong({parts: [{notes: [[60, 0, 1]]}]})],
    ['a note number above 127', withNotes([[128, 0, 1]])],
    ['a negative note number', withNotes([[-1, 0, 1]])],
    ['a negative Note start', withNotes([[60, -1, 1]])],
    ['a fractional Note duration', withNotes([[60, 0, 1.5]])],
    ['a Note with start + duration at 2^31', withNotes([[60, TICK_LIMIT - 10, 10]])],
    ['Notes sorted by note number but not by start', withNotes([[60, 10, 1], [60, 0, 1]])],
    ['Notes with equal start sorted wrongly by note number', withNotes([[64, 0, 1], [60, 0, 1]])],
    ['a non-UUID Tape id', snapshot({tapes: [tapeSnapshot({id: 'tape-1'})]})],
    ['a duplicate Tape id', snapshot({tapes: [tapeSnapshot(), tapeSnapshot()]})],
    ['a blank Tape name', snapshot({tapes: [tapeSnapshot({name: ''})]})],
    ['a non-UUID organId', snapshot({tapes: [tapeSnapshot({organId: 'organ-1'})]})],
    ['a songId that names no Song', snapshot({tapes: [tapeSnapshot({songId: SONG_B})]})],
    ['a songId without selectedParts', snapshot({tapes: [tapeSnapshot({selectedParts: undefined})]})],
    ['selectedParts without a songId', snapshot({tapes: [tapeSnapshot({songId: undefined})]})],
    ['empty selectedParts', snapshot({tapes: [tapeSnapshot({selectedParts: []})]})],
    ['unsorted selectedParts', snapshot({tapes: [tapeSnapshot({selectedParts: [1, 0]})]})],
    ['duplicate selectedParts', snapshot({tapes: [tapeSnapshot({selectedParts: [0, 0]})]})],
    ['a PartIndex outside the Song', snapshot({tapes: [tapeSnapshot({selectedParts: [0, 2]})]})],
    ['a negative PartIndex', snapshot({tapes: [tapeSnapshot({selectedParts: [-1, 0]})]})],
    ['a transposition above +127', snapshot({tapes: [tapeSnapshot({transposition: 128})]})],
    ['a transposition below -127', snapshot({tapes: [tapeSnapshot({transposition: -128})]})],
    ['a fractional transposition', snapshot({tapes: [tapeSnapshot({transposition: 1.5})]})],
    ['a columnLength of 0', snapshot({tapes: [tapeSnapshot({columnLength: 0})]})],
    ['a negative columnLength', snapshot({tapes: [tapeSnapshot({columnLength: -1})]})],
    ['an infinite columnLength', snapshot({tapes: [tapeSnapshot({columnLength: Infinity})]})],
    ['a columnLength that is not a number', snapshot({tapes: [tapeSnapshot({columnLength: '2.5'})]})],
    ['a length below 1', snapshot({tapes: [tapeSnapshot({length: 0, holes: []})]})],
    ['a fractional length', snapshot({tapes: [tapeSnapshot({length: 10.5})]})],
    ['holes that are not a list', snapshot({tapes: [tapeSnapshot({holes: 'none'})]})],
    ['a Hole with a pipe above 127', withHoles([[128, 0, 1]])],
    ['a Hole with a negative start', withHoles([[60, -1, 1]])],
    ['a Hole with length 0', withHoles([[60, 0, 0]])],
    ['a Hole beyond the end of the Tape', withHoles([[60, 9, 2]])],
    ['Holes not sorted by pipe', withHoles([[64, 0, 1], [60, 0, 1]])],
    ['Holes in a row not sorted by start', withHoles([[60, 4, 1], [60, 0, 1]])],
    ['overlapping Holes in a row', withHoles([[60, 0, 3], [60, 2, 2]])],
    ['a Song that no Tape references', snapshot({songs: [songSnapshot(SONG_A), songSnapshot(SONG_B)]})],
  ])('rejects %s', (_, input) => {
    const result = parseTapeLibrarySnapshot(input);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).not.toBe('');
  });
});

describe('toTapeLibrarySnapshot', () => {
  it('round-trips through the parser', () => {
    const parsed = parseTapeLibrarySnapshot(snapshot());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const written = toTapeLibrarySnapshot(parsed.value.tapes, parsed.value.songs);

    expect(written).toEqual(snapshot());
    expect(parseTapeLibrarySnapshot(JSON.parse(JSON.stringify(written)))).toEqual(parsed);
  });

  it('writes version 2 with the Crank speed of each Tape', () => {
    const parsed = parseTapeLibrarySnapshot(snapshot({tapes: [tapeSnapshot({crankSpeed: 72.5})]}));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const written = toTapeLibrarySnapshot(parsed.value.tapes, parsed.value.songs);

    expect(written.version).toBe(2);
    expect(written.tapes[0].crankSpeed).toBe(72.5);
  });

  it('upgrades a version 1 snapshot: the next save writes version 2 with Crank speed 60', () => {
    const parsed = parseTapeLibrarySnapshot({version: 1, songs: [songSnapshot()], tapes: [tapeSnapshotV1()]});
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const written = toTapeLibrarySnapshot(parsed.value.tapes, parsed.value.songs);

    expect(written.version).toBe(2);
    expect(written.tapes[0].crankSpeed).toBe(60);
  });

  it('writes only the Songs that a Tape references, and Tapes in their order', () => {
    const parsed = parseTapeLibrarySnapshot(
      snapshot({
        songs: [songSnapshot(SONG_A), songSnapshot(SONG_B)],
        tapes: [tapeSnapshot({songId: SONG_B}), tapeSnapshot({id: TAPE_B, songId: SONG_A})],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const written = toTapeLibrarySnapshot([parsed.value.tapes[1]], parsed.value.songs);

    expect(written.songs.map((song) => song.id)).toEqual([SONG_A]);
    expect(written.tapes.map((tape) => tape.id)).toEqual([TAPE_B]);
  });

  it('omits absent optional fields', () => {
    const parsed = parseTapeLibrarySnapshot(snapshot());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const written = toTapeLibrarySnapshot(
      [{...parsed.value.tapes[0], songId: undefined, selectedParts: undefined}],
      parsed.value.songs,
    );

    expect(written.songs).toEqual([]);
    expect('songId' in written.tapes[0]).toBe(false);
    expect('selectedParts' in written.tapes[0]).toBe(false);
  });

  it('omits the name of an unnamed Part', () => {
    const parsed = parseTapeLibrarySnapshot(snapshot());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const written = toTapeLibrarySnapshot(parsed.value.tapes, parsed.value.songs);

    expect('name' in written.songs[0].parts[1]).toBe(false);
  });

  it('writes Holes sorted by pipe, then start', () => {
    const parsed = parseTapeLibrarySnapshot(snapshot());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const tape = parsed.value.tapes[0];

    const written = toTapeLibrarySnapshot([{...tape, holes: [...tape.holes].reverse()}], parsed.value.songs);

    expect(written.tapes[0].holes).toEqual([[60, 0, 2], [60, 4, 1], [64, 2, 3]]);
  });
});
