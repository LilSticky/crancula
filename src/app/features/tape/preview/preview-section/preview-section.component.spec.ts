import {type ComponentFixture, TestBed} from '@angular/core/testing';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {MatSliderHarness} from '@angular/material/slider/testing';
import {columnCount, millimetres, type Organ, organId, tapeId, transposition, type Tape} from '@api/index';
import {tapeOf} from '@api/tape/tape-fixture';
import {partIndex, songId} from '@api/song/song';
import {testOrgan} from '../../../../../testing/organs';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {PreviewSectionComponent} from './preview-section.component';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

/** An Organ with one Pipe (note 60), `tapePerCrankTurn` mm of Tape per Crank turn and the Crank speed range given (30 to 120 by default). */
function organWith(tapePerCrankTurn: number, range: {readonly slowest: number; readonly fastest: number} = {slowest: 30, fastest: 120}): Organ {
  return testOrgan('Fairground', 1, {tapePerCrankTurn, slowestCrankSpeed: range.slowest, fastestCrankSpeed: range.fastest});
}

/**
 * A Tape with the given Column length in mm and number of Columns, at a Crank speed of 60 turns per minute.
 * At 60 turns per minute, one Column of 5 mm on an Organ of 10 mm per Crank turn takes 0.5 seconds.
 */
function tapeWith(columns: number, columnLength = 5): Tape {
  return tapeOf({
    id: defined(tapeId('00000000-0000-4000-8000-000000000001'), 'tape id'),
    name: 'Melody',
    organId: defined(organId('00000000-0000-4000-8000-000000000002'), 'organ id'),
    songId: defined(songId('00000000-0000-4000-8000-000000000003'), 'song id'),
    selectedParts: [defined(partIndex(1, 3), 'part')],
    transposition: defined(transposition(0), 'transposition'),
    columnLength: defined(millimetres(columnLength), 'column length'),
    length: defined(columnCount(columns), 'length'),
    holes: [],
  });
}

async function render(
  options: {
    readonly tape?: Tape;
    readonly organ?: Organ;
    readonly playing?: boolean;
    /** The Column under the playhead, 0-based; the start field shows it when stopped. */
    readonly playhead?: number;
  } = {},
) {
  TestBed.configureTestingModule({
    providers: [provideTestTranslations('en')],
  });
  const fixture: ComponentFixture<PreviewSectionComponent> = TestBed.createComponent(PreviewSectionComponent);
  fixture.componentRef.setInput('tape', options.tape ?? tapeWith(10));
  fixture.componentRef.setInput('organ', options.organ ?? organWith(10));
  fixture.componentRef.setInput('playing', options.playing ?? false);
  if (options.playhead !== undefined) fixture.componentRef.setInput('playhead', options.playhead);
  const emitted: Tape[] = [];
  fixture.componentInstance.crankSpeedChange.subscribe((changed: Tape) => emitted.push(changed));
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const field = (): HTMLInputElement => {
    const input = element.querySelector<HTMLInputElement>('[data-testid="crank-speed-input"]');
    if (input === null) throw new Error('no Crank speed field');
    return input;
  };
  const apply = (): HTMLButtonElement => {
    const button = element.querySelector<HTMLButtonElement>('[data-testid="crank-speed-apply"]');
    if (button === null) throw new Error('no Apply button');
    return button;
  };
  /** Types into the field the way a user does, then lets the view catch up. */
  const type = async (text: string): Promise<void> => {
    field().value = text;
    field().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  /** Presses a key in the field, then lets the view catch up. */
  const press = async (key: string): Promise<void> => {
    field().dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true}));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  /** Moves the focus out of the field, to `next` if given. */
  const blur = async (next?: HTMLElement): Promise<void> => {
    field().dispatchEvent(new FocusEvent('blur', {relatedTarget: next ?? null}));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const text = (testId: string): string | undefined => element.querySelector(`[data-testid="${testId}"]`)?.textContent?.trim();
  return {element, fixture, component: fixture.componentInstance, field, apply, type, press, blur, text, emitted};
}

describe('PreviewSectionComponent', () => {
  it('shows the title of the Preview section', async () => {
    const {element} = await render();

    expect(element.querySelector('h2')?.textContent?.trim()).toBe('Preview');
  });

  it('shows the Crank speed of the Tape in the field', async () => {
    const {field} = await render();

    expect(field().value).toBe('60');
  });

  it('shows how long the Tape plays, in minutes and seconds', async () => {
    // 10 Columns of 0.5 seconds: 5 seconds
    const {text} = await render({tape: tapeWith(10), organ: organWith(10)});

    expect(text('preview-length')).toBe('Plays for 0:05');
  });

  it('shows minutes and seconds with the seconds padded to two digits', async () => {
    // 250 Columns of 0.5 seconds: 125 seconds
    const {text} = await render({tape: tapeWith(250), organ: organWith(10)});

    expect(text('preview-length')).toBe('Plays for 2:05');
  });

  it('keeps Apply disabled while the typed Crank speed is the Crank speed of the Tape', async () => {
    const {apply, type} = await render();

    await type('60');

    expect(apply().disabled).toBe(true);
  });

  it('enables Apply for a valid different Crank speed', async () => {
    const {apply, type} = await render();

    await type('120');

    expect(apply().disabled).toBe(false);
  });

  it.each(['abc', '0', '301'])('shows the crank-speed-error with the range and keeps Apply disabled for "%s"', async (typed) => {
    const {apply, type, text, emitted} = await render();

    await type(typed);

    expect(text('crank-speed-error')).toBe('Enter 1 to 300 turns per minute');
    expect(apply().disabled).toBe(true);
    expect(emitted).toHaveLength(0);
  });

  it('shows no error for a valid Crank speed', async () => {
    const {type, text} = await render();

    await type('120');

    expect(text('crank-speed-error')).toBeUndefined();
  });

  it('emits the Tape with the typed Crank speed when Enter is pressed in the field', async () => {
    const {type, press, emitted} = await render();

    await type('120');
    await press('Enter');

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.crankSpeed).toBe(120);
    expect(emitted[0]?.length).toBe(10);
  });

  it('emits the Tape with the typed Crank speed when Apply is pressed', async () => {
    const {apply, type, emitted} = await render();

    await type('120');
    apply().click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.crankSpeed).toBe(120);
  });

  it('reads a decimal comma as the decimal separator', async () => {
    const {type, press, emitted} = await render();

    await type('90,5');
    await press('Enter');

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.crankSpeed).toBe(90.5);
  });

  it('emits nothing when Enter is pressed with an invalid Crank speed', async () => {
    const {type, press, emitted} = await render();

    await type('0');
    await press('Enter');

    expect(emitted).toHaveLength(0);
  });

  it('keeps the Crank speed field and Apply enabled while the Preview plays', async () => {
    const {field, apply, type, emitted} = await render({playing: true});

    expect(field().disabled).toBe(false);
    await type('120');

    expect(apply().disabled).toBe(false);
    apply().click();
    expect(emitted).toHaveLength(1);
  });

  it('puts the Crank speed of the Tape back when the field loses focus without applying', async () => {
    const {field, type, blur, emitted} = await render();

    await type('120');
    await blur();

    expect(field().value).toBe('60');
    expect(emitted).toHaveLength(0);
  });

  describe('the start Column (T036)', () => {
    const startField = (element: HTMLElement): HTMLInputElement => {
      const input = element.querySelector<HTMLInputElement>('[data-testid="preview-start-column"]');
      if (input === null) throw new Error('no start Column field');
      return input;
    };
    /** Types a Column into the start field the way a user does, then presses Enter. */
    const typeStartColumn = async (element: HTMLElement, fixture: ComponentFixture<PreviewSectionComponent>, text: string) => {
      const field = startField(element);
      field.value = text;
      field.dispatchEvent(new Event('input', {bubbles: true}));
      field.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
      fixture.detectChanges();
      await fixture.whenStable();
    };

    it('shows the Column of the playhead in the start field when stopped, counting Columns from 1', async () => {
      const {element} = await render({playhead: 36});

      expect(startField(element).value).toBe('37');
    });

    it('emits the typed Column counted from 0 when Enter is pressed in the start field', async () => {
      const {element, fixture, component} = await render({tape: tapeWith(50)});
      const emitted: number[] = [];
      component.startColumnChange.subscribe((column: number) => emitted.push(column));

      await typeStartColumn(element, fixture, '38');

      expect(emitted).toEqual([37]);
    });

    it.each(['0', '11'])('emits nothing for "%s", which is no Column of a 10-Column Tape', async (typed) => {
      const {element, fixture, component} = await render({tape: tapeWith(10)});
      const emitted: number[] = [];
      component.startColumnChange.subscribe((column: number) => emitted.push(column));

      await typeStartColumn(element, fixture, typed);

      expect(emitted).toEqual([]);
    });
  });

  describe('the Crank speed slider (T028)', () => {
    /** The Crank speed slider, found as a Material slider harness finds it. */
    const sliderOf = (fixture: ComponentFixture<PreviewSectionComponent>) =>
      TestbedHarnessEnvironment.loader(fixture).getHarness(MatSliderHarness.with({selector: '[data-testid="crank-speed-slider"]'}));
    /** The native input of the slider's thumb, for a move the user has not released yet. */
    const thumbOf = (element: HTMLElement): HTMLInputElement => {
      const input = element.querySelector<HTMLInputElement>('[data-testid="crank-speed-slider"] input');
      if (input === null) throw new Error('no thumb in the Crank speed slider');
      return input;
    };

    it('spans the Crank speed range of the Organ, from its slowest to its fastest', async () => {
      const {fixture} = await render({organ: organWith(10, {slowest: 40, fastest: 200})});

      const slider = await sliderOf(fixture);

      expect(await slider.getMinValue()).toBe(40);
      expect(await slider.getMaxValue()).toBe(200);
    });

    it('steps by 1 turn per minute', async () => {
      const {fixture} = await render();

      expect(await (await sliderOf(fixture)).getStep()).toBe(1);
    });

    it('emits crankSpeedTrial while the slider moves, and no crankSpeedChange', async () => {
      const {element, fixture, component, emitted} = await render();
      const trials: number[] = [];
      component.crankSpeedTrial.subscribe((speed: number) => trials.push(speed));

      const thumb = thumbOf(element);
      thumb.value = '90';
      thumb.dispatchEvent(new Event('input', {bubbles: true}));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(trials).toEqual([90]);
      expect(emitted).toEqual([]);
    });

    it('emits one crankSpeedChange with the Tape at the Crank speed the slider is released at', async () => {
      const {fixture, emitted} = await render();

      await (await (await sliderOf(fixture)).getEndThumb()).setValue(90);

      expect(emitted).toHaveLength(1);
      expect(emitted[0]?.crankSpeed).toBe(90);
    });

    it('puts the slider at the nearest end of the range for a Tape speed outside it', async () => {
      // The Tape runs at 60 turns per minute, below the slowest of 70.
      const {fixture} = await render({organ: organWith(10, {slowest: 70, fastest: 120})});

      expect(await (await (await sliderOf(fixture)).getEndThumb()).getValue()).toBe(70);
    });

    it('names the range in a hint for a Tape speed outside it', async () => {
      const {text} = await render({organ: organWith(10, {slowest: 70, fastest: 120})});

      expect(text('crank-speed-outside-range')).toBe("Outside this Organ's Crank speed range (70–120 turns/min).");
    });

    it('still accepts a typed Crank speed from 1 to 300 beyond the range of the Organ', async () => {
      const {apply, type, text} = await render({organ: organWith(10, {slowest: 40, fastest: 200})});

      await type('250');

      expect(text('crank-speed-error')).toBeUndefined();
      expect(apply().disabled).toBe(false);
    });
  });
});
