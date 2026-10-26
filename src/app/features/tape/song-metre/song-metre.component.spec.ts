// API: SongMetreComponent (standalone, OnPush, selector `cranc-song-metre`); input `metre = input.required<SongMetre>()`,
// SongMetre and songMetre from `@api/index` (api/song/song-metre.ts). Presentational: it renders the parts of the
// metre the Song keeps, read-only, inside an element with data-testid "song-metre", and nothing when it keeps none.
import {TestBed} from '@angular/core/testing';
import type {SongMetre} from '@api/index';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {SongMetreComponent} from './song-metre.component';

async function render(metre: SongMetre, language: 'en' | 'de' = 'en') {
  TestBed.configureTestingModule({providers: [provideTestTranslations(language)]});
  const fixture = TestBed.createComponent(SongMetreComponent);
  fixture.componentRef.setInput('metre', metre);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const text = (): string =>
    (element.querySelector('[data-testid="song-metre"]')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  return {element, text};
}

const THREE_FOUR = {beats: 3, beatType: 4} as const;
const G_MAJOR = {fifths: 1, mode: 'major'} as const;
const QUARTER_UPBEAT = {numerator: 1, denominator: 4} as const;

describe('SongMetreComponent', () => {
  it('renders the Time signature, the Key and the upbeat in English: "3/4, G major, upbeat 1/4"', async () => {
    const {text} = await render({timeSignature: THREE_FOUR, key: G_MAJOR, upbeat: QUARTER_UPBEAT});

    expect(text()).toBe('3/4, G major, upbeat 1/4');
  });

  it('renders the same parts in German: "3/4, G-Dur, Auftakt 1/4"', async () => {
    const {text} = await render({timeSignature: THREE_FOUR, key: G_MAJOR, upbeat: QUARTER_UPBEAT}, 'de');

    expect(text()).toBe('3/4, G-Dur, Auftakt 1/4');
  });

  it('renders only the parts the Song keeps: a Time signature and an upbeat, no Key', async () => {
    const {text} = await render({timeSignature: THREE_FOUR, upbeat: QUARTER_UPBEAT});

    expect(text()).toBe('3/4, upbeat 1/4');
  });

  it('names a Key with flats by its M number: three flats in major is "E♭ major"', async () => {
    const {text} = await render({key: {fifths: -3, mode: 'major'}});

    expect(text()).toBe('E♭ major');
  });

  it('names a minor Key: no sharp or flat in minor is "A minor"', async () => {
    const {text} = await render({key: {fifths: 0, mode: 'minor'}});

    expect(text()).toBe('A minor');
  });

  it('renders nothing when the Song keeps no Time signature, upbeat or Key', async () => {
    const {element, text} = await render({});

    expect(element.querySelector('[data-testid="song-metre"]')).toBeNull();
    expect(text()).toBe('');
  });
});
