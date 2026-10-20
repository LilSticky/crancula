// API: AddHoleComponent (selector-free, standalone); inputs `organ: Organ`, `tape: Tape`, `selected: HoleRef | undefined`; output `added: OutputEmitterRef<HoleRef>` ({pipe, start: Column 0-based}); test ids on the section, the select, the input and the button.
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {TestBed, type ComponentFixture} from '@angular/core/testing';
import {MatSelectHarness} from '@angular/material/select/testing';
import {
  column,
  columnCount,
  midiNoteNumber,
  millimetres,
  organId,
  tapeId,
  transposition,
  type Hole,
  type HoleRef,
  type MidiNoteNumber,
  type Organ,
  type Tape,
} from '@api/index';
import {tapeOf} from '../../../../../../api/tape/tape-fixture';
import {testOrgan} from '../../../../../testing/organs';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {partIndex, songId} from '../../../../../../api/song/song';
import de from '../../../../../assets/i18n/de.json';
import en from '../../../../../assets/i18n/en.json';
import {AddHoleComponent} from './add-hole.component';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

const c4 = defined(midiNoteNumber(60), 'pipe');
const d4 = defined(midiNoteNumber(62), 'pipe');
const e4 = defined(midiNoteNumber(64), 'pipe');

/** Pipes C4, D4, E4 in rack order. */
const ORGAN: Organ = testOrgan('Street organ', 3);

/** A Hole as the Tape view shows it: Columns first..last, counted from 1. */
function hole(pipe: MidiNoteNumber, first: number, last: number): Hole {
  return {
    pipe,
    start: defined(column(first - 1), 'column'),
    length: defined(columnCount(last - first + 1), 'length'),
  };
}

function tapeWith(holes: readonly Hole[]): Tape {
  return tapeOf({
    id: defined(tapeId('00000000-0000-4000-8000-000000000001'), 'tape id'),
    name: 'Melody',
    organId: defined(organId('00000000-0000-4000-8000-000000000002'), 'organ id'),
    songId: defined(songId('00000000-0000-4000-8000-000000000003'), 'song id'),
    selectedParts: [defined(partIndex(1, 3), 'part')],
    transposition: defined(transposition(0), 'transposition'),
    columnLength: defined(millimetres(2.5), 'column length'),
    length: defined(columnCount(100), 'length'),
    holes,
  });
}

/** D4 on Columns 5-8 and C4 on Columns 3-4. */
const TAPE = tapeWith([hole(c4, 3, 4), hole(d4, 5, 8)]);

async function render(options: {readonly tape?: Tape; readonly selected?: HoleRef} = {}) {
  TestBed.configureTestingModule({providers: [provideTestTranslations()]});
  const fixture: ComponentFixture<AddHoleComponent> = TestBed.createComponent(AddHoleComponent);
  fixture.componentRef.setInput('organ', ORGAN);
  fixture.componentRef.setInput('tape', options.tape ?? TAPE);
  fixture.componentRef.setInput('selected', options.selected);
  const added: HoleRef[] = [];
  fixture.componentInstance.added.subscribe((value) => added.push(value));
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const loader = TestbedHarnessEnvironment.loader(fixture);

  const section = element.querySelector('[data-testid="add-hole"]');
  const columnInput = (): HTMLInputElement => {
    const input = element.querySelector<HTMLInputElement>('[data-testid="add-hole-column"]');
    if (!input) throw new Error('no Column field');
    return input;
  };
  const submit = (): HTMLButtonElement => {
    const button = element.querySelector<HTMLButtonElement>('[data-testid="add-hole-submit"]');
    if (!button) throw new Error('no submit button');
    return button;
  };
  return {
    element,
    section,
    added,
    columnInput,
    submit,
    pipeSelect: () => loader.getHarness(MatSelectHarness.with({selector: '[data-testid="add-hole-pipe"]'})),
    changeTape: async (tape: Tape) => {
      fixture.componentRef.setInput('tape', tape);
      await fixture.whenStable();
    },
    text: () => element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    typeColumn: async (value: string) => {
      const input = columnInput();
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    },
    clickSubmit: async () => {
      submit().click();
      await fixture.whenStable();
    },
  };
}

describe('AddHoleComponent', () => {
  it('is a section titled "Add a Hole"', async () => {
    const {section} = await render();

    expect(section?.textContent).toContain('Add a Hole');
  });

  it('offers the Pipes of the Organ by note name in rack order', async () => {
    const {pipeSelect} = await render();

    const select = await pipeSelect();
    await select.open();
    const options = await select.getOptions();

    expect(await Promise.all(options.map((option) => option.getText()))).toEqual(['C4', 'D4', 'E4']);
  });

  it('is prefilled with the Pipe of the selected Hole and the first free Column after it', async () => {
    const {pipeSelect, columnInput} = await render({selected: {pipe: d4, start: defined(column(4), 'column')}});

    expect(await (await pipeSelect()).getValueText()).toBe('D4');
    expect(columnInput().value).toBe('9');
  });

  it('emits the Pipe and the 0-based Column of the Column field, counted from 1', async () => {
    const {pipeSelect, typeColumn, clickSubmit, added} = await render();

    const select = await pipeSelect();
    await select.clickOptions({text: 'E4'});
    await typeColumn('12');
    await clickSubmit();

    expect(added).toEqual([{pipe: e4, start: 11}]);
  });

  it('says which Hole already covers the Column and emits nothing', async () => {
    const {pipeSelect, typeColumn, clickSubmit, text, added} = await render();

    await (await pipeSelect()).clickOptions({text: 'D4'});
    await typeColumn('6');
    await clickSubmit();

    expect(text()).toContain('A Hole of D4 already covers Column 6.');
    expect(added).toHaveLength(0);
  });

  it.each(['0', '-3', '2.5', 'abc', ''])('asks for a whole Column number from 1 when the field holds "%s"', async (value) => {
    const {pipeSelect, typeColumn, clickSubmit, text, added} = await render();

    await (await pipeSelect()).clickOptions({text: 'C4'});
    await typeColumn(value);
    await clickSubmit();

    expect(text()).toContain('Enter a whole Column number from 1.');
    expect(added).toHaveLength(0);
  });

  it('adds the first Hole to a Tape without Holes', async () => {
    const {pipeSelect, typeColumn, clickSubmit, added} = await render({tape: tapeWith([])});

    await (await pipeSelect()).clickOptions({text: 'C4'});
    await typeColumn('1');
    await clickSubmit();

    expect(added).toEqual([{pipe: c4, start: 0}]);
  });

  describe('when the Tape changes under the form', () => {
    const selectedD4 = {pipe: d4, start: defined(column(4), 'column')};

    it('keeps the typed Column and the chosen Pipe', async () => {
      const {pipeSelect, typeColumn, columnInput, changeTape} = await render({selected: selectedD4});
      await (await pipeSelect()).clickOptions({text: 'E4'});
      await typeColumn('42');

      await changeTape(tapeWith([hole(c4, 3, 4), hole(d4, 5, 9)]));

      expect(columnInput().value).toBe('42');
      expect(await (await pipeSelect()).getValueText()).toBe('E4');
    });

    it('clears the error message once the Column is edited', async () => {
      const {pipeSelect, typeColumn, clickSubmit, text} = await render();
      await (await pipeSelect()).clickOptions({text: 'D4'});
      await typeColumn('6');
      await clickSubmit();
      expect(text()).toContain('A Hole of D4 already covers Column 6.');

      await typeColumn('9');

      expect(text()).not.toContain('already covers');
    });

    it('clears the error message once another Pipe is picked', async () => {
      const {pipeSelect, typeColumn, clickSubmit, text} = await render();
      await (await pipeSelect()).clickOptions({text: 'D4'});
      await typeColumn('6');
      await clickSubmit();
      expect(text()).toContain('A Hole of D4 already covers Column 6.');

      await (await pipeSelect()).clickOptions({text: 'E4'});

      expect(text()).not.toContain('already covers');
    });
  });

  describe('layout and hint (#121 finding 16)', () => {
    it('puts the Pipe and Column fields in one row', async () => {
      const {element} = await render();

      const fields = [...element.querySelectorAll('mat-form-field')];
      expect(fields).toHaveLength(2);
      const row = fields[0]?.parentElement;
      expect(row).not.toBe(element.querySelector('form'));
      expect(row?.contains(fields[1] ?? null)).toBe(true);
      expect(row?.querySelector('button')).toBeNull();
    });

    it('hints the allowed Columns, first to last, on the Column field', async () => {
      const {element} = await render();

      const hint = element.querySelector('mat-form-field:has([data-testid="add-hole-column"]) mat-hint');
      expect(hint?.textContent?.replace(/\s+/g, ' ').trim()).toBe('1 to 100');
    });

    it('has the hint text in English and German', () => {
      for (const tree of [en, de]) {
        const text = (tree as {TAPE: {ADD_HOLE: Record<string, string>}}).TAPE.ADD_HOLE['COLUMN_HINT'];
        expect(text).toContain('{{first}}');
        expect(text).toContain('{{last}}');
      }
    });
  });
});
