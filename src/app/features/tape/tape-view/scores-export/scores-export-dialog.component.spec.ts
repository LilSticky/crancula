import {type ComponentFixture, TestBed} from '@angular/core/testing';
import {type HarnessLoader} from '@angular/cdk/testing';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {By} from '@angular/platform-browser';
import {MatButtonHarness} from '@angular/material/button/testing';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {MatFormField} from '@angular/material/form-field';
import {MatTooltip} from '@angular/material/tooltip';
import {MatInputHarness} from '@angular/material/input/testing';
import {MatRadioButtonHarness} from '@angular/material/radio/testing';
import {MatSelectHarness} from '@angular/material/select/testing';
import {TranslateService} from '@ngx-translate/core';
import {midiNoteNumber, noteName, scoresTempo, type Organ, type ScoresChoices} from '@api/index';
import {referenceTape} from '@api/tape/tape-fixture';
import {fifthsOf, note, part, song, songId, tick, ticksPerQuarter, type BeatType, type Key, type Song} from '@api/song/song';
import {vi} from 'vitest';
import {testOrgan} from '../../../../../testing/organs';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {provideFormFieldDefaults} from '../../../shared/form-field-defaults';
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

/** A Song in 3/4 from Tick 0 in G major from Tick 0, with no upbeat. */
function songInGMajor(): Song {
  const major: Key = {start: defined(tick(0), 'start'), fifths: defined(fifthsOf(1), 'fifths'), mode: 'major'};
  return songWithMetre(3, 4, undefined, [major]);
}

/** A Song in the given Time signature from Tick 0 with the given upbeat in Ticks (a quarter is 480), if any. */
function songWithMetre(beats: number, beatType: BeatType, upbeat?: number, keys: readonly Key[] = []): Song {
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
      keys,
    }),
    'song',
  );
}

/** An Organ with a Pipe below middle C and one at or above it, so the split note C4 is prefilled. */
function organAcrossMiddleC(): Organ {
  return testOrgan('Street organ', 2, {pipes: [{note: 52}, {note: 72}]});
}

async function render(songOf: Song | undefined, organ: Organ, lang: 'en' | 'de' = 'en') {
  // Renders the dialog with no remembered split notes; the prefill comes from the Organ (FR-005).
  const close = vi.fn<(result?: ScoresChoices) => void>();
  TestBed.configureTestingModule({
    providers: [
      provideTestTranslations(lang),
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

/** The lines of the staves, from the top. */
function staffLines(element: HTMLElement): HTMLElement[] {
  return [...element.querySelectorAll<HTMLElement>('[data-testid="scores-staff"]')];
}

/** The name of the icon an element shows, or undefined when it shows none. */
function iconName(element: Element | undefined): string | undefined {
  return element?.querySelector('mat-icon')?.textContent?.trim();
}

describe('ScoresExportDialogComponent shows the Pipes each staff plays (FR-005, UX must 1)', () => {
  it('shows the lowest and highest Pipe of a staff and how many Pipes it holds, not the MIDI extremes', async () => {
    const organ = testOrgan('Street organ', 4, {pipes: [{note: 48}, {note: 60}, {note: 62}, {note: 84}]});
    const {element} = await render(songIn3Four(), organ);

    const [top] = staffLines(element);
    expect(top?.textContent).toContain('C4 to C6');
    expect(top?.textContent).toContain('3 Pipes');
    expect(top?.textContent).not.toContain('G9');
  });

  it('warns with an icon and a text on a staff that holds no Pipe, and keeps Export enabled', async () => {
    const organ = testOrgan('High organ', 2, {pipes: [{note: 72}, {note: 74}]});
    const {fixture, element, press, translate} = await render(songIn3Four(), organ);
    press('scores-split-add');
    await fixture.whenStable();

    const [top, bottom] = staffLines(element);
    expect(bottom?.textContent).toContain(String(translate.instant('TAPE.SCORES.STAFF_EMPTY')));
    expect(iconName(bottom)).toBe('warning');
    expect(iconName(top)).toBeUndefined();
    expect(exportDisabled(element)).toBe(false);
  });
});

describe('ScoresExportDialogComponent names the dialog after its action and marks its icon buttons (UX should 2)', () => {
  it('titles the dialog with the name of the menu item, Export as Scores', async () => {
    const {element, translate} = await render(songIn3Four(), organAcrossMiddleC());

    const title = required(element.querySelector('h2'), 'dialog title');
    expect(title.textContent?.trim()).toBe(String(translate.instant('TAPE.VIEW.EXPORT_SCORES')));
  });

  it('marks the Add of a split note with a plus icon', async () => {
    const {element} = await render(songIn3Four(), organAcrossMiddleC());

    expect(iconName(required(element.querySelector('[data-testid="scores-split-add"]'), 'Add a split note'))).toBe('add');
  });

  it('shows the removal of a split note as an icon button labelled with its text', async () => {
    const {element, translate} = await render(songIn3Four(), organAcrossMiddleC());
    const remove = required(element.querySelector<HTMLButtonElement>('[data-testid="scores-split-remove"]'), 'removal');

    expect(remove.getAttribute('aria-label')).toBe(String(translate.instant('TAPE.SCORES.SPLIT_REMOVE')));
    const icon = iconName(remove);
    expect(icon).toBeTruthy();
    expect(remove.textContent?.trim()).toBe(icon);
  });

  it('gives the removal of a split note the tooltip with its text', async () => {
    const {fixture, translate} = await render(songIn3Four(), organAcrossMiddleC());
    const remove = fixture.debugElement.query(By.css('[data-testid="scores-split-remove"]'));

    expect(remove.injector.get(MatTooltip).message).toBe(String(translate.instant('TAPE.SCORES.SPLIT_REMOVE')));
  });
});

/** The subscript sizing the mat-form-field around the control with the test id gives its error line. */
function subscriptSizingOf(fixture: ComponentFixture<ScoresExportDialogComponent>, testId: string): string {
  return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`)).injector.get(MatFormField).subscriptSizing;
}

describe('ScoresExportDialogComponent lays out the Time signature fields so they do not jump (UX should 2)', () => {
  beforeEach(() => {
    // The app's form field defaults: the error line of a field takes its room only when the error shows.
    TestBed.configureTestingModule({providers: [provideFormFieldDefaults()]});
  });

  it('puts Beats and Beat type in two columns of one grid', async () => {
    const {element, loader} = await render(songIn3Four(), organAcrossMiddleC());
    const another = await loader.getHarness(MatRadioButtonHarness.with({selector: '[data-testid="scores-time-other"]'}));
    await another.check();

    const fields = required(element.querySelector<HTMLElement>('[data-testid="scores-time-fields"]'), 'Beats and Beat type');
    expect(getComputedStyle(fields).gridTemplateColumns.split(' ')).toHaveLength(2);
  });

  it('reserves the error line of Beats and Beat type', async () => {
    const {fixture, loader} = await render(songIn3Four(), organAcrossMiddleC());
    const another = await loader.getHarness(MatRadioButtonHarness.with({selector: '[data-testid="scores-time-other"]'}));
    await another.check();

    expect(subscriptSizingOf(fixture, 'scores-beats')).toBe('fixed');
    expect(subscriptSizingOf(fixture, 'scores-beat-type')).toBe('fixed');
  });
});

describe('ScoresExportDialogComponent puts the split notes in one row per staff (UX should 3, 5)', () => {
  it('shows the split note of a staff in the row of that staff', async () => {
    const {element} = await render(songIn3Four(), organAcrossMiddleC());

    const [top] = staffLines(element);
    expect(top?.querySelector('[data-testid="scores-split-note"]')).not.toBeNull();
  });

  it('shows Add a split note as an outlined button', async () => {
    const {loader} = await render(songIn3Four(), organAcrossMiddleC());

    await loader.getHarness(MatButtonHarness.with({selector: '[data-testid="scores-split-add"]', appearance: 'outlined'}));
  });
});

describe('ScoresExportDialogComponent summarises the Key and the tempo the Scores carry (UX should 7)', () => {
  it('shows the Key of the Song and the tempo of the Crank speed in a summary line', async () => {
    const organ = testOrgan('Street organ', 2, {pipes: [{note: 52}, {note: 72}], tapePerCrankTurn: 100});
    const {element, translate} = await render(songInGMajor(), organ);

    const summary = required(element.querySelector('[data-testid="scores-summary"]'), 'summary line');
    const key = String(translate.instant('TAPE.METRE.MAJOR', {key: translate.instant('TAPE.METRE.TONIC.MAJOR.1')}));
    expect(summary.textContent).toContain(key);
    expect(summary.textContent).toContain(String(defined(scoresTempo(referenceTape(organ), organ), 'tempo')));
  });
});

describe('ScoresExportDialogComponent words "Another one" as a Time signature (UX nit 9)', () => {
  it('names the choice "Another time signature" in English', async () => {
    const {element} = await render(songIn3Four(), organAcrossMiddleC());

    const choice = required(element.querySelector('[data-testid="scores-time-other"]'), 'Another choice');
    expect(choice.textContent?.trim()).toBe('Another time signature');
  });

  it('names the choice "Andere Taktart" in German', async () => {
    const {element} = await render(songIn3Four(), organAcrossMiddleC(), 'de');

    const choice = required(element.querySelector('[data-testid="scores-time-other"]'), 'Andere choice');
    expect(choice.textContent?.trim()).toBe('Andere Taktart');
  });
});
