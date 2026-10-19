import {TestBed} from '@angular/core/testing';
import {type CranculaApi, parseTapeLibrarySnapshot, renameTape, type Song, type Tape} from '@api/index';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../../core/crancula-api.token';
import {TapeLibrary} from '../tape-library.store';
import {TapeEditor} from './tape-editor';

const SONG_ID = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e01';
const TAPE_ID = '11111111-2222-4333-8444-555555555551';
const ORGAN_ID = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';

function opened(): {tape: Tape; song: Song} {
  const parsed = parseTapeLibrarySnapshot({
    version: 1,
    songs: [{id: SONG_ID, name: 'Fur Elise', ticksPerQuarter: 480, parts: [{percussion: false, notes: [[60, 0, 240]]}]}],
    tapes: [{
      id: TAPE_ID, name: 'Opened', organId: ORGAN_ID, songId: SONG_ID, selectedParts: [0],
      transposition: 0, columnLength: 2.5, length: 10, holes: [[60, 0, 2]],
    }],
  });
  if (!parsed.ok) throw new Error(`invalid test library: ${parsed.error}`);
  const [tape] = parsed.value.tapes;
  const [song] = parsed.value.songs;
  if (tape === undefined || song === undefined) throw new Error('invalid test library');
  return {tape, song};
}

function named(tape: Tape, name: string): Tape {
  const renamed = renameTape(tape, name);
  if (!renamed.ok) throw new Error('invalid test name');
  return renamed.value;
}

async function setup() {
  const inMemory = createInMemoryCranculaApi();
  let saves = 0;
  const api: CranculaApi = {
    ...inMemory,
    tapes: {
      load: () => inMemory.tapes.load(),
      save: (snapshot) => {
        saves += 1;
        return inMemory.tapes.save(snapshot);
      },
    },
  };
  TestBed.configureTestingModule({providers: [{provide: CRANCULA_API, useValue: api}, TapeEditor]});
  const library = TestBed.inject(TapeLibrary);
  const {tape, song} = opened();
  await library.create(tape, song);
  saves = 0;
  const editor = TestBed.inject(TapeEditor);
  editor.open(tape);
  return {editor, library, tape, saves: () => saves};
}

describe('TapeEditor', () => {
  it('starts with the Tape as opened and nothing to undo or redo', async () => {
    const {editor, tape} = await setup();

    expect(editor.tape()).toBe(tape);
    expect(editor.selection()).toBeUndefined();
    expect(editor.canUndo()).toBe(false);
    expect(editor.canRedo()).toBe(false);
  });

  it('apply makes the entry present, can be undone and saves once through TapeLibrary.update', async () => {
    const {editor, library, tape, saves} = await setup();
    const edited = named(tape, 'Edited');

    expect(await editor.apply({tape: edited, selection: {row: 1, start: 3}})).toBe(true);

    expect(editor.tape()).toBe(edited);
    expect(editor.selection()).toEqual({row: 1, start: 3});
    expect(editor.canUndo()).toBe(true);
    expect(library.tapeEntityMap()[tape.id]).toBe(edited);
    expect(saves()).toBe(1);
  });

  it('undo restores the earlier Tape and its selection, saves once, and enables redo', async () => {
    const {editor, library, tape, saves} = await setup();
    await editor.apply({tape: named(tape, 'Edited'), selection: {row: 1, start: 3}});

    await editor.undo();

    expect(editor.tape()).toBe(tape);
    expect(editor.selection()).toBeUndefined();
    expect(library.tapeEntityMap()[tape.id]).toBe(tape);
    expect(editor.canUndo()).toBe(false);
    expect(editor.canRedo()).toBe(true);
    expect(saves()).toBe(2);
  });

  it('redo brings the undone entry back with its selection and saves once', async () => {
    const {editor, library, tape, saves} = await setup();
    const edited = named(tape, 'Edited');
    await editor.apply({tape: edited, selection: {row: 1, start: 3}});
    await editor.undo();

    await editor.redo();

    expect(editor.tape()).toBe(edited);
    expect(editor.selection()).toEqual({row: 1, start: 3});
    expect(library.tapeEntityMap()[tape.id]).toBe(edited);
    expect(editor.canRedo()).toBe(false);
    expect(saves()).toBe(3);
  });

  it('apply after undo clears redo', async () => {
    const {editor, tape} = await setup();
    await editor.apply({tape: named(tape, 'First'), selection: undefined});
    await editor.undo();

    await editor.apply({tape: named(tape, 'Second'), selection: undefined});

    expect(editor.canRedo()).toBe(false);
  });

  it('undo and redo with nothing to move change and save nothing', async () => {
    const {editor, tape, saves} = await setup();

    expect(await editor.undo()).toBe(false);
    expect(await editor.redo()).toBe(false);

    expect(editor.tape()).toBe(tape);
    expect(saves()).toBe(0);
  });

  it('resets the history to the TapeLibrary Tape when that is no longer the present', async () => {
    const {editor, library, tape} = await setup();
    await editor.apply({tape: named(tape, 'Edited'), selection: undefined});
    const elsewhere = named(tape, 'Changed elsewhere');
    await library.update(elsewhere);

    await editor.apply({tape: named(elsewhere, 'Edited again'), selection: undefined});
    await editor.undo();

    expect(editor.tape()).toBe(elsewhere);
    expect(editor.canUndo()).toBe(false);
  });
});
