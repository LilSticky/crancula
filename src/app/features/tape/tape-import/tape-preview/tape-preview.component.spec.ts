import {TestBed} from '@angular/core/testing';
import {
  createTape,
  type Organ,
  readMidiSong,
  type PartIndex,
  type Tape,
  tapeGeometry,
  transposition,
} from '@api/index';
import {encodeSmf, type SmfTimedEvent} from '../../../../../../api/song/midi/smf-test-helper';
import {testOrgan} from '../../../../../testing/organs';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {TapePreviewComponent} from './tape-preview.component';

const TICKS_PER_QUARTER = 480;
/** The strip has a fixed height: the Tape is drawn 160 px tall, however wide it is. */
const STRIP_HEIGHT_PX = 160;
const scaleOf = (organ: Organ) => STRIP_HEIGHT_PX / organ.tapeBed.tapeWidth;

/** Forty Notes, one per quarter, over the Pipes 60, 62, 64: far more Columns than a strip shows. */
function longTape(organ: Organ): Tape {
  const events: SmfTimedEvent[] = [{delta: 0, event: {type: 'trackName', text: 'Lead'}}];
  for (let index = 0; index < 40; index++) {
    const note = 60 + 2 * (index % 3);
    events.push(
      {delta: 0, event: {type: 'noteOn', channel: 0, note, velocity: 80}},
      {delta: TICKS_PER_QUARTER, event: {type: 'noteOff', channel: 0, note, velocity: 0}},
    );
  }
  const song = readMidiSong(
    encodeSmf({format: 1, division: {ticksPerQuarterNote: TICKS_PER_QUARTER}, tracks: [{events}]}),
    'long.mid',
  );
  const none = transposition(0);
  if (!song.ok || none === undefined) throw new Error('invalid test Song');
  const created = createTape({
    song: song.value,
    organ,
    selectedParts: new Set<PartIndex>([0 as PartIndex]),
    transposition: none,
    name: 'Long',
    columnLength: 2.5,
  });
  if (!created.ok) throw new Error(`invalid test Tape: ${JSON.stringify(created.error)}`);
  return created.value.tape;
}

function render(organ: Organ, tape: Tape, widthPx: number, language: 'en' | 'de' = 'en') {
  TestBed.configureTestingModule({providers: [provideTestTranslations(language)]});
  const fixture = TestBed.createComponent(TapePreviewComponent);
  fixture.componentRef.setInput('tape', tape);
  fixture.componentRef.setInput('organ', organ);
  fixture.componentRef.setInput('widthPx', widthPx);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const holes = () => [...element.querySelectorAll<SVGElement>('[data-testid="preview-hole"]')];
  return {fixture, element, holes, svg: element.querySelector<SVGSVGElement>('svg[data-testid="tape-preview"]')};
}

describe('TapePreviewComponent', () => {
  const organ = testOrgan('Street organ', 3);

  it('is an svg image named "Preview of the first Columns of the Tape"', () => {
    const {svg} = render(organ, longTape(organ), 400);

    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('Preview of the first Columns of the Tape');
  });

  it('names the image in German', () => {
    const {svg} = render(organ, longTape(organ), 400, 'de');

    expect(svg?.getAttribute('aria-label')).toBe('Vorschau der ersten Spalten des Lochbands');
  });

  it('draws the Holes whose slot starts inside the strip width and none beyond it', () => {
    const tape = longTape(organ);
    const slots = tapeGeometry(tape, organ).slots;
    const inside = slots.filter((slot) => slot.x * scaleOf(organ) < 400);
    expect(inside.length).toBeGreaterThan(0);
    expect(inside.length).toBeLessThan(slots.length);

    const {holes} = render(organ, tape, 400);

    expect(holes()).toHaveLength(inside.length);
  });

  it('draws each Hole at the strip scale: its millimetres times 160 px / tape width', () => {
    const tape = longTape(organ);
    const [first] = tapeGeometry(tape, organ).slots;
    if (!first) throw new Error('no slot');

    const {holes} = render(organ, tape, 400);

    const hole = holes()[0];
    expect(Number(hole?.getAttribute('width'))).toBeCloseTo(first.width * scaleOf(organ), 3);
    expect(Number(hole?.getAttribute('height'))).toBeCloseTo(first.height * scaleOf(organ), 3);
  });

  it.each([120, 60])('draws the Tape body 160 px tall for a %s mm wide Tape', (tapeWidth) => {
    const narrow = testOrgan('Narrow', 3, {tapeBed: {tapeWidth, holeDiameter: 2.5, rowSpacing: 3.5}});

    const {element} = render(narrow, longTape(narrow), 400);

    expect(Number(element.querySelector('rect.tape')?.getAttribute('height'))).toBeCloseTo(STRIP_HEIGHT_PX, 3);
  });

  it('shows more Holes in a wider strip', () => {
    const tape = longTape(organ);

    const {fixture, holes} = render(organ, tape, 300);
    const narrow = holes().length;

    fixture.componentRef.setInput('widthPx', 600);
    fixture.detectChanges();

    expect(holes().length).toBeGreaterThan(narrow);
  });

  it('draws the Lead-in when the Organ has one', () => {
    const {element} = render(organ, longTape(organ), 400);

    expect(element.querySelector('[data-testid="preview-lead-in"]')).not.toBeNull();
  });

  it('draws no Lead-in when the Organ has none', () => {
    const flat = testOrgan('Flat', 3, {leadIn: 0});

    const {element} = render(flat, longTape(flat), 400);

    expect(element.querySelector('[data-testid="preview-lead-in"]')).toBeNull();
  });
});
