import {TestBed} from '@angular/core/testing';
import {type HarnessLoader} from '@angular/cdk/testing';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {MatInputHarness} from '@angular/material/input/testing';
import {MatRadioButtonHarness} from '@angular/material/radio/testing';
import {MatSelectHarness} from '@angular/material/select/testing';
import {TranslateService} from '@ngx-translate/core';
import {midiNoteNumber, noteName, type Organ, type ScoresChoices} from '@api/index';
import {referenceTape} from '@api/tape/tape-fixture';
import {note, part, song, songId, tick, ticksPerQuarter, type BeatType, type Song} from '@api/song/song';
import {vi} from 'vitest';
import {testOrgan} from '../../../../../testing/organs';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {ScoresExportDialogComponent} from './scores-export-dialog.component';

const QUARTER = 480;

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`missing ${what}`);
  return value;
}

/** A Song in 3/4 from Tick 0 with the given upbeat in Ticks (a quarter is 480), if any. */
function songIn3Four(upbeat?: number): Song {
  return songWithMetre(3, 4, upbeat);
}

/** A Song in the given Time signature from Tick 0 with the given upbeat in Ticks (a quarter is 480), if any. */
function songWithMetre(beats: number, beatType: BeatType, upbeat?: number): Song {
  const melody = defined(
    part({
      name: 'Melody',
      percussion: false,
      notes: [
        defined(
          note({
            noteNumber: defined(midiNoteNumber(61), 'note number'),
            start: defined(tick(0), 'start'),
            duration: defined(tick(QUARTER), 'duration'),
          }),
          'note',
        ),
      ],
    }),
    'part',
  );
  return defined(
    song({
      id: defined(songId('3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f'), 'song id'),
      name: 'Waltz',
      ticksPerQuarter: defined(ticksPerQuarter(QUARTER), 'ticks per quarter'),
      parts: [melody],
      timeSignatures: [{start: defined(tick(0), 'start'), beats, beatType}],
      upbeat: upbeat === undefined ? undefined : defined(tick(upbeat), 'upbeat'),
    }),
    'song',
  );
}

/** An Organ with a Pipe below middle C and one at or above it, so the split note C4 is prefilled. */
function organAcrossMiddleC(): Organ {
  return testOrgan('Street organ', 2, {pipes: [{note: 52}, {note: 72}]});
}

async function render(songOf: Song | undefined, organ: Organ) {
  // Renders the dialog with no remembered split notes; the prefill comes from the Organ (FR-005).
  const close = vi.fn<(result?: ScoresChoices) => void>();
  TestBed.configureTestingModule({
    providers: [
      provideTestTranslations('en'),
      {provide: MatDialogRef, useValue: {close}},
      {
        provide: MAT_DIALOG_DATA,
        useValue: {tape: referenceTape(organ), organ, song: songOf, rememberedSplitNotes: undefined},
      },
    ],
  });
  const fixture = TestBed.createComponent(ScoresExportDialogComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    element,
    close,
    translate: TestBed.inject(TranslateService),
    loader: TestbedHarnessEnvironment.loader(fixture),
    press: (testId: string) => required(element.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`), testId).click(),
  };
}

describe('ScoresExportDialogComponent', () => {
  it('offers the Time signature of the Song as "As in the Song" with its metre', async () => {
    const {element, translate} = await render(songIn3Four(), organAcrossMiddleC());

    const choice = required(element.querySelector('[data-testid="scores-time-song"]'), 'As in the Song choice');
    expect(choice.textContent).toContain(String(translate.instant('TAPE.SCORES.TIME_SONG', {metre: '3/4'})));
  });

  it('prefills the upbeat of the Song as one quarter', async () => {
    const {loader} = await render(songIn3Four(QUARTER), organAcrossMiddleC());

    const count = await loader.getHarness(MatInputHarness.with({selector: '[data-testid="scores-upbeat-count"]'}));
    const value = await loader.getHarness(MatSelectHarness.with({selector: '[data-testid="scores-upbeat-value"]'}));
    expect(await count.getValue()).toBe('1');
    expect(await value.getValueText()).toBe('Quarter');
  });

  it('shows one staff per range, the treble above the split note and the bass below it', async () => {
    const {element, translate} = await render(songIn3Four(), organAcrossMiddleC());

    const staves = [...element.querySelectorAll('[data-testid="scores-staff"]')].map((staff) => staff.textContent ?? '');
    expect(staves).toHaveLength(2);
    expect(staves[0]).toContain(String(translate.instant('TAPE.SCORES.CLEF.TREBLE')));
    expect(staves[1]).toContain(String(translate.instant('TAPE.SCORES.CLEF.BASS')));
  });

  it('closes with no choices when Cancel is pressed', async () => {
    const {close, press} = await render(songIn3Four(), organAcrossMiddleC());

    press('scores-cancel');

    expect(close.mock.calls).toEqual([[undefined]]);
  });

  it('closes with the prefilled choices when Export is pressed', async () => {
    const {close, press} = await render(songIn3Four(QUARTER), organAcrossMiddleC());

    press('scores-confirm');

    // The Song's 3/4 and its upbeat of one quarter (8 Columns), with the split note C4 the Organ is prefilled with.
    expect(close).toHaveBeenCalledWith({timeSignature: 'song', upbeat: 8, splitNotes: [60]});
  });
});

/** The note names the split note selects show, from the highest split note at the top. */
async function splitNoteNames(loader: HarnessLoader): Promise<string[]> {
  const selects = await loader.getAllHarnesses(MatSelectHarness.with({selector: '[data-testid="scores-split-note"]'}));
  return Promise.all(selects.map((select) => select.getValueText()));
}

function staffCount(element: HTMLElement): number {
  return element.querySelectorAll('[data-testid="scores-staff"]').length;
}

describe('ScoresExportDialogComponent edits the split notes (FR-005, Story 3)', () => {
  it('adds a split note an octave below the lowest one, shown above the others', async () => {
    const {fixture, loader, press} = await render(songIn3Four(), organAcrossMiddleC());

    press('scores-split-add');
    await fixture.whenStable();

    expect(await splitNoteNames(loader)).toEqual(['C4', 'C3']);
  });

  it('adds C4 as the split note when the Organ has no split note to start from', async () => {
    const {fixture, loader, press} = await render(songIn3Four(), testOrgan('Plain organ', 2));

    press('scores-split-add');
    await fixture.whenStable();

    expect(await splitNoteNames(loader)).toEqual(['C4']);
  });

  it('removes a split note, which leaves one staff less', async () => {
    const {fixture, element, loader, press} = await render(songIn3Four(), organAcrossMiddleC());

    press('scores-split-remove');
    await fixture.whenStable();

    expect(await splitNoteNames(loader)).toEqual([]);
    expect(staffCount(element)).toBe(1);
  });

  it('moves a split note to another note, which keeps one staff per range', async () => {
    const {fixture, element, loader} = await render(songIn3Four(), organAcrossMiddleC());
    const select = await loader.getHarness(MatSelectHarness.with({selector: '[data-testid="scores-split-note"]'}));

    await select.clickOptions({text: 'D4'});
    await fixture.whenStable();

    expect(await splitNoteNames(loader)).toEqual(['D4']);
    expect(staffCount(element)).toBe(2);
  });

  it('closes with the moved split note when Export is pressed', async () => {
    const {fixture, close, loader, press} = await render(songIn3Four(), organAcrossMiddleC());
    const select = await loader.getHarness(MatSelectHarness.with({selector: '[data-testid="scores-split-note"]'}));
    await select.clickOptions({text: 'D4'});
    await fixture.whenStable();

    press('scores-confirm');

    expect(close).toHaveBeenCalledWith({timeSignature: 'song', upbeat: 0, splitNotes: [62]});
  });

  it('disables Export while two split notes are the same note', async () => {
    const {fixture, element, loader, press} = await render(songIn3Four(), organAcrossMiddleC());
    press('scores-split-add');
    await fixture.whenStable();
    const [top] = await loader.getAllHarnesses(MatSelectHarness.with({selector: '[data-testid="scores-split-note"]'}));
    await top?.clickOptions({text: 'C3'});
    await fixture.whenStable();

    expect(await splitNoteNames(loader)).toEqual(['C3', 'C3']);
    expect(required(element.querySelector<HTMLButtonElement>('[data-testid="scores-confirm"]'), 'Export').disabled).toBe(true);
  });
});

describe('ScoresExportDialogComponent offers split notes from MIDI 1 up (FR-005)', () => {
  it('offers no split note at MIDI 0, since the staff below it would be empty', async () => {
    const {loader} = await render(songIn3Four(), organAcrossMiddleC());
    const select = await loader.getHarness(MatSelectHarness.with({selector: '[data-testid="scores-split-note"]'}));

    await select.open();
    const names = await Promise.all((await select.getOptions()).map((option) => option.getText()));
    await select.close();

    expect(names).not.toContain(noteName(defined(midiNoteNumber(0), 'MIDI 0')));
    expect(names[0]).toBe(noteName(defined(midiNoteNumber(1), 'MIDI 1')));
  });
});

/** The texts of the validation messages the dialog shows under its fields. */
function errorTexts(element: HTMLElement): string[] {
  return [...element.querySelectorAll('mat-error')].map((error) => error.textContent ?? '');
}

function exportDisabled(element: HTMLElement): boolean {
  return required(element.querySelector<HTMLButtonElement>('[data-testid="scores-confirm"]'), 'Export').disabled;
}

describe('ScoresExportDialogComponent asks the Time signature and upbeat (FR-004, Story 4)', () => {
  it('without a Song offers only the fields, prefilled with 4/4 and no upbeat', async () => {
    const {element, loader, translate} = await render(undefined, organAcrossMiddleC());

    expect(element.querySelector('[data-testid="scores-time-song"]')).toBeNull();
    const beats = await loader.getHarness(MatInputHarness.with({selector: '[data-testid="scores-beats"]'}));
    const beatType = await loader.getHarness(MatSelectHarness.with({selector: '[data-testid="scores-beat-type"]'}));
    const upbeat = await loader.getHarness(MatInputHarness.with({selector: '[data-testid="scores-upbeat-count"]'}));
    expect(await beats.getValue()).toBe('4');
    expect(await beatType.getValueText()).toBe(String(translate.instant('TAPE.SCORES.NOTE_VALUE.4')));
    expect(await upbeat.getValue()).toBe('0');
  });

  it('exports the Time signature and upbeat the user chose with "Another one": 6/8 with an upbeat of one eighth', async () => {
    const {close, loader, press, translate} = await render(songIn3Four(), organAcrossMiddleC());
    const another = await loader.getHarness(MatRadioButtonHarness.with({selector: '[data-testid="scores-time-other"]'}));
    await another.check();
    const beats = await loader.getHarness(MatInputHarness.with({selector: '[data-testid="scores-beats"]'}));
    await beats.setValue('6');
    const beatType = await loader.getHarness(MatSelectHarness.with({selector: '[data-testid="scores-beat-type"]'}));
    await beatType.clickOptions({text: String(translate.instant('TAPE.SCORES.NOTE_VALUE.8'))});
    const count = await loader.getHarness(MatInputHarness.with({selector: '[data-testid="scores-upbeat-count"]'}));
    await count.setValue('1');
    const value = await loader.getHarness(MatSelectHarness.with({selector: '[data-testid="scores-upbeat-value"]'}));
    await value.clickOptions({text: String(translate.instant('TAPE.SCORES.NOTE_VALUE.8'))});

    press('scores-confirm');

    expect(close).toHaveBeenCalledWith({timeSignature: {beats: 6, beatType: 8}, upbeat: 4, splitNotes: [60]});
  });

  it('starts "Another one" from the Song Time signature when it lies on Columns, 3/4 with a quarter', async () => {
    const {loader, translate} = await render(songIn3Four(), organAcrossMiddleC());
    const another = await loader.getHarness(MatRadioButtonHarness.with({selector: '[data-testid="scores-time-other"]'}));
    await another.check();

    const beats = await loader.getHarness(MatInputHarness.with({selector: '[data-testid="scores-beats"]'}));
    const beatType = await loader.getHarness(MatSelectHarness.with({selector: '[data-testid="scores-beat-type"]'}));
    expect(await beats.getValue()).toBe('3');
    expect(await beatType.getValueText()).toBe(String(translate.instant('TAPE.SCORES.NOTE_VALUE.4')));
  });

  it('shows the error of a beat count of 0 under its field and disables Export', async () => {
    const {element, loader, translate} = await render(undefined, organAcrossMiddleC());
    const beats = await loader.getHarness(MatInputHarness.with({selector: '[data-testid="scores-beats"]'}));

    await beats.setValue('0');

    expect(errorTexts(element)).toContain(String(translate.instant('TAPE.SCORES.ERROR.BEATS')));
    expect(exportDisabled(element)).toBe(true);
  });

  it('shows the error of a negative upbeat count under its field and disables Export', async () => {
    const {element, loader, translate} = await render(undefined, organAcrossMiddleC());
    const count = await loader.getHarness(MatInputHarness.with({selector: '[data-testid="scores-upbeat-count"]'}));

    await count.setValue('-1');

    expect(errorTexts(element)).toContain(String(translate.instant('TAPE.SCORES.ERROR.UPBEAT')));
    expect(exportDisabled(element)).toBe(true);
  });

  it('shows the error of an upbeat as long as the first Bar under its field and disables Export', async () => {
    const {element, loader, translate} = await render(undefined, organAcrossMiddleC());
    const count = await loader.getHarness(MatInputHarness.with({selector: '[data-testid="scores-upbeat-count"]'}));
    await count.setValue('1');
    const value = await loader.getHarness(MatSelectHarness.with({selector: '[data-testid="scores-upbeat-value"]'}));
    await value.clickOptions({text: String(translate.instant('TAPE.SCORES.NOTE_VALUE.1'))});

    expect(errorTexts(element)).toContain(String(translate.instant('TAPE.SCORES.ERROR.UPBEAT_TOO_LONG')));
    expect(exportDisabled(element)).toBe(true);
  });

  it('shows the error of two equal split notes under the staves and disables Export', async () => {
    const {fixture, element, loader, press, translate} = await render(songIn3Four(), organAcrossMiddleC());
    press('scores-split-add');
    await fixture.whenStable();
    const [top] = await loader.getAllHarnesses(MatSelectHarness.with({selector: '[data-testid="scores-split-note"]'}));
    await top?.clickOptions({text: 'C3'});
    await fixture.whenStable();

    expect(errorTexts(element)).toContain(String(translate.instant('TAPE.SCORES.ERROR.SPLIT_NOTES')));
    expect(exportDisabled(element)).toBe(true);
  });

  it('says why a Song Time signature that cannot lie on Columns is not offered, and prefills 4/4', async () => {
    const {element, loader, translate} = await render(songWithMetre(3, 64), organAcrossMiddleC());
    const beats = await loader.getHarness(MatInputHarness.with({selector: '[data-testid="scores-beats"]'}));
    const beatType = await loader.getHarness(MatSelectHarness.with({selector: '[data-testid="scores-beat-type"]'}));

    expect(element.textContent).toContain(String(translate.instant('TAPE.SCORES.SONG_METRE_NOT_ON_COLUMNS')));
    expect(element.querySelector('[data-testid="scores-time-song"]')).toBeNull();
    expect(await beats.getValue()).toBe('4');
    expect(await beatType.getValueText()).toBe(String(translate.instant('TAPE.SCORES.NOTE_VALUE.4')));
  });

  it('prefills 4/4 again when the dialog is opened again, as the choice of an export is not stored', async () => {
    const first = await render(undefined, organAcrossMiddleC());
    const beats = await first.loader.getHarness(MatInputHarness.with({selector: '[data-testid="scores-beats"]'}));
    await beats.setValue('6');
    first.press('scores-confirm');
    expect(first.close).toHaveBeenCalledWith({timeSignature: {beats: 6, beatType: 4}, upbeat: 0, splitNotes: [60]});

    TestBed.resetTestingModule();
    const second = await render(undefined, organAcrossMiddleC());
    const again = await second.loader.getHarness(MatInputHarness.with({selector: '[data-testid="scores-beats"]'}));

    expect(await again.getValue()).toBe('4');
  });
});
