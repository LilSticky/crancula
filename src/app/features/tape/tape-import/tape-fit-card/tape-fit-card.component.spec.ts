import {TestBed} from '@angular/core/testing';
import {
  defaultSelectedParts,
  fitAndNotesOf,
  readMidiSong,
  transposition,
  type Song,
} from '@api/index';
import {encodeSmf, type SmfTimedEvent} from '../../../../../../api/song/midi/smf-test-helper';
import {testOrgan} from '../../../../../testing/organs';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {TapeFitCardComponent} from './tape-fit-card.component';

const TICKS_PER_QUARTER = 480;

function track(channel: number, notes: readonly number[], name: string): {events: readonly SmfTimedEvent[]} {
  const events: SmfTimedEvent[] = [{delta: 0, event: {type: 'trackName', text: name}}];
  for (const note of notes) {
    events.push(
      {delta: 0, event: {type: 'noteOn', channel, note, velocity: 80}},
      {delta: TICKS_PER_QUARTER, event: {type: 'noteOff', channel, note, velocity: 0}},
    );
  }
  return {events};
}

/** On the Pipes C4, D4, E4 at Transposition 0: C3, D3 (Lead) and D3 (Bass) are moved by an octave, C#4 is Unplayable. */
function mixedSong(): Song {
  const result = readMidiSong(
    encodeSmf({
      format: 1,
      division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
      tracks: [track(0, [48, 50, 61], 'Lead'), track(1, [50], 'Bass')],
    }),
    'mixed.mid',
  );
  if (!result.ok) throw new Error(`invalid test Song: ${result.error}`);
  return result.value;
}

function fitOfMixed() {
  const song = mixedSong();
  const none = transposition(0);
  if (none === undefined) throw new Error('invalid test Transposition');
  const {fit, movedByOctaves, unplayableNotes} = fitAndNotesOf(song, defaultSelectedParts(song), testOrgan('Street organ', 3), none);
  return {fit, fitNotes: {movedByOctaves, unplayableNotes}};
}

async function render({withFit = true, notesShown = true}: {withFit?: boolean; notesShown?: boolean} = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({providers: [provideTestTranslations()]});
  const fixture = TestBed.createComponent(TapeFitCardComponent);
  const {fit, fitNotes} = fitOfMixed();
  fixture.componentRef.setInput('fit', withFit ? fit : null);
  fixture.componentRef.setInput('fitNotes', fitNotes);
  fixture.componentRef.setInput('partLabels', ['Lead', 'Bass']);
  fixture.componentRef.setInput('notesShown', notesShown);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const query = (testId: string) => element.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const button = (testId: string) => {
    const found = query(testId);
    if (!(found instanceof HTMLButtonElement)) throw new Error(`no button ${testId}`);
    return found;
  };
  const text = (testId: string) => query(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const notes = () =>
    [...element.querySelectorAll('[data-testid="fit-note"]')].map((each) => each.textContent?.replace(/\s+/g, ' ').trim());
  return {fixture, query, button, text, notes};
}

describe('TapeFitCardComponent', () => {
  it('shows the three counts of the Fit and the data attributes of the Fit', async () => {
    const {query, text} = await render();

    expect(['fit-matching', 'fit-moved', 'fit-unplayable'].map((id) => query(id)?.querySelector('[data-testid="fit-count"]')?.textContent)).toEqual(['0', '3', '1']);
    expect(text('fit-warning')).toContain('1 Unplayable Note');
    const fit = query('fit');
    expect(fit?.dataset['matchingAPipe']).toBe('0');
    expect(fit?.dataset['movedByOctaves']).toBe('3');
    expect(fit?.dataset['unplayable']).toBe('1');
  });

  it('says what it needs while there is no Fit', async () => {
    const {query, text} = await render({withFit: false});

    expect(text('fit-empty')).toBe('Choose a MIDI file and an Organ to see how the Song fits its Pipes.');
    expect(query('fit-matching')).toBeNull();
  });

  it('opens the moved Notes with the Part labels on a click and closes them on a second press', async () => {
    const {fixture, button, query, notes} = await render();
    const moved = button('fit-moved');
    expect(moved.getAttribute('aria-expanded')).toBe('false');
    expect(query('fit-notes')).toBeNull();

    moved.click();
    await fixture.whenStable();

    expect(moved.getAttribute('aria-expanded')).toBe('true');
    expect(notes()).toEqual([
      'C3 moved by 1 octave to Pipe C4 (Part Lead, Column 1)',
      'D3 moved by 1 octave to Pipe D4 (Part Lead, Column 9)',
      'D3 moved by 1 octave to Pipe D4 (Part Bass, Column 1)',
    ]);

    moved.click();
    await fixture.whenStable();
    expect(moved.getAttribute('aria-expanded')).toBe('false');
    expect(query('fit-notes')).toBeNull();
  });

  it('shows no list while the notes are not shown', async () => {
    const {fixture, button, query} = await render({notesShown: false});

    button('fit-unplayable').click();
    await fixture.whenStable();

    expect(query('fit-notes')).toBeNull();
  });
});
