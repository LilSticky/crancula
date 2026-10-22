import {provideRouter} from '@angular/router';
import {type ComponentFixture, TestBed} from '@angular/core/testing';
import {columnCount, millimetres, organId, tapeId, transposition, type Tape} from '@api/index';
import {tapeOf} from '../../../../../../api/tape/tape-fixture';
import {partIndex, songId} from '../../../../../../api/song/song';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {TapeSectionComponent, type TapeSectionView} from './tape-section.component';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

const VIEW: TapeSectionView = {
  organId: 'organ-1',
  organName: 'Fairground',
  columnLengthText: '2.5',
  lengthText: '100',
  lengthMmText: '250',
  leadInMm: 30,
  leadInText: '30',
  holesText: '12',
  partNames: [
    {index: 0, name: 'Melody'},
    {index: 2, name: undefined},
  ],
};

/** A Tape of 100 Columns without Holes, with the given Column length in mm. */
function tapeWith(columnLength: number): Tape {
  return tapeOf({
    id: defined(tapeId('00000000-0000-4000-8000-000000000001'), 'tape id'),
    name: 'Melody',
    organId: defined(organId('00000000-0000-4000-8000-000000000002'), 'organ id'),
    songId: defined(songId('00000000-0000-4000-8000-000000000003'), 'song id'),
    selectedParts: [defined(partIndex(1, 3), 'part')],
    transposition: defined(transposition(0), 'transposition'),
    columnLength: defined(millimetres(columnLength), 'column length'),
    length: defined(columnCount(100), 'length'),
    holes: [],
  });
}

async function render(options: {readonly view?: TapeSectionView; readonly columnLength?: number; readonly language?: 'en' | 'de'} = {}) {
  TestBed.configureTestingModule({
    providers: [provideTestTranslations(options.language ?? 'en'), provideRouter([])],
  });
  const fixture: ComponentFixture<TapeSectionComponent> = TestBed.createComponent(TapeSectionComponent);
  fixture.componentRef.setInput('view', options.view ?? VIEW);
  fixture.componentRef.setInput('tape', tapeWith(options.columnLength ?? 2.5));
  const emitted: Tape[] = [];
  fixture.componentInstance.columnLengthChange.subscribe((changed: Tape) => emitted.push(changed));
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const section = element.querySelector('[data-testid="tape-section"]');
  const field = (): HTMLInputElement => {
    const input = element.querySelector<HTMLInputElement>('[data-testid="column-length-input"]');
    if (input === null) throw new Error('no Column length field');
    return input;
  };
  const apply = (): HTMLButtonElement => {
    const button = element.querySelector<HTMLButtonElement>('[data-testid="column-length-apply"]');
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
  const blur = async (): Promise<void> => {
    field().dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return {element, section, field, apply, type, press, blur, emitted};
}

describe('TapeSectionComponent', () => {
  it('lists Organ, Column length, Columns, length, Lead-in and Holes as a definition list', async () => {
    const {section, field} = await render();

    expect([...(section?.querySelectorAll('dd') ?? [])].slice(0, 6).filter((_, index) => index !== 1).map((value) => value.textContent?.trim())).toEqual([
      'Fairground',
      '100',
      '250 mm',
      '30 mm',
      '12',
    ]);
    expect(field().value).toBe('2.5');
  });

  it('links the Organ to the Organ editor', async () => {
    const {section} = await render();

    expect(section?.querySelector('a')?.getAttribute('href')).toBe('/organs/organ-1');
  });

  it('says None for a Lead-in of 0', async () => {
    const {section} = await render({view: {...VIEW, leadInMm: 0, leadInText: '0'}});

    expect(section?.textContent).toContain('None');
  });

  it('lists the selected Parts, naming unnamed ones by number', async () => {
    const {element} = await render();

    expect([...element.querySelectorAll('[data-testid="selected-part"]')].map((part) => part.textContent?.trim())).toEqual([
      'Melody',
      'Part 3',
    ]);
  });

  describe('changing the Column length (T006)', () => {
    it('shows the current Column length in the field, with a point as decimal separator in English', async () => {
      const {field} = await render({columnLength: 2.5});

      expect(field().value).toBe('2.5');
    });

    it('emits the changed Tape when Enter is pressed in the field', async () => {
      const {type, press, emitted} = await render({columnLength: 2.5});

      await type('5');
      await press('Enter');

      expect(emitted).toHaveLength(1);
      expect(emitted[0]?.columnLength).toBe(5);
      expect(emitted[0]?.length).toBe(100);
    });

    it('emits the changed Tape when the Apply button is pressed', async () => {
      const {apply, type, emitted} = await render({columnLength: 2.5});

      await type('5');
      expect(apply().disabled).toBe(false);
      apply().click();

      expect(emitted).toHaveLength(1);
      expect(emitted[0]?.columnLength).toBe(5);
    });

    it.each(['5', '5,0'])('keeps Apply disabled and emits nothing for "%s" when the Column length is 5 mm', async (typed) => {
      const {apply, type, press, emitted} = await render({columnLength: 5});

      await type(typed);
      expect(apply().disabled).toBe(true);
      await press('Enter');

      expect(emitted).toHaveLength(0);
    });

    it.each(['abc', '0', '-1'])('shows the column-length-error and keeps Apply disabled for "%s", emitting nothing', async (typed) => {
      const {element, apply, type, press, emitted} = await render({columnLength: 2.5});

      await type(typed);

      expect(element.querySelector('[data-testid="column-length-error"]')?.textContent?.trim()).toBe(
        'The Column length must be greater than 0.',
      );
      expect(apply().disabled).toBe(true);
      await press('Enter');
      expect(emitted).toHaveLength(0);
    });

    it('puts the current Column length back when Escape is pressed', async () => {
      const {field, type, press, emitted} = await render({columnLength: 2.5});

      await type('7');
      await press('Escape');

      expect(field().value).toBe('2.5');
      expect(emitted).toHaveLength(0);
    });

    it('puts the current Column length back when the field loses focus without applying', async () => {
      const {field, type, blur, emitted} = await render({columnLength: 2.5});

      await type('7');
      await blur();

      expect(field().value).toBe('2.5');
      expect(emitted).toHaveLength(0);
    });
  });
});
