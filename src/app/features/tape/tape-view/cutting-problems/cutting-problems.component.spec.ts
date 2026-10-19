// API: CuttingProblemsComponent (standalone); input `holes: readonly HoleCuttingProblems[]` (cut order, Columns 0-based); output `chosen: OutputEmitterRef<HoleRef>`.
import {TestBed} from '@angular/core/testing';
import {
  column,
  holesWithCuttingProblems,
  midiNoteNumber,
  type CuttingProblem,
  type HoleCuttingProblems,
  type HoleRef,
  type Millimetres,
  type MidiNoteNumber,
} from '@api/index';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {CuttingProblemsComponent} from './cutting-problems.component';

function note(value: number): MidiNoteNumber {
  const result = midiNoteNumber(value);
  if (result === undefined) throw new Error(`invalid test note ${value}`);
  return result;
}

function col(value: number) {
  const result = column(value);
  if (result === undefined) throw new Error(`invalid test Column ${value}`);
  return result;
}

const mm = (value: number): Millimetres => value as Millimetres;

const NO_PIPE: CuttingProblem = {code: 'no-pipe', pipe: note(70), start: col(4)}; // A#4, Column 5
const TOO_SHORT: CuttingProblem = {
  code: 'too-short',
  pipe: note(60), // C4
  start: col(10), // Column 11
  lengthMm: 2.5,
  minimumHoleLengthMm: mm(3.3),
};
const TOO_CLOSE: CuttingProblem = {
  code: 'too-close',
  pipe: note(62), // D4
  start: col(20), // Column 21
  nextStart: col(24), // Column 25
  gapMm: 1.2,
  minimumGapMm: mm(1.7),
};

async function render(problems: readonly CuttingProblem[], language: 'en' | 'de' = 'en') {
  TestBed.configureTestingModule({providers: [provideTestTranslations(language)]});
  const fixture = TestBed.createComponent(CuttingProblemsComponent);
  const holes: readonly HoleCuttingProblems[] = holesWithCuttingProblems(problems);
  fixture.componentRef.setInput('holes', holes);
  const chosen: HoleRef[] = [];
  fixture.componentInstance.chosen.subscribe((value) => chosen.push(value));
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const text = (testId: string): string =>
    (element.querySelector(`[data-testid="${testId}"]`)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const entries = (): string[] =>
    [...element.querySelectorAll('[data-testid="cutting-problem"]')].map((item) =>
      (item.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
  return {element, chosen, text, entries};
}

describe('CuttingProblemsComponent', () => {
  it('is the Cutting Problems section with its title', async () => {
    const {element} = await render([TOO_SHORT]);

    const section = element.querySelector('[data-testid="cutting-problems"]');
    expect(section).not.toBeNull();
    expect(section?.textContent).toContain('Cutting Problems');
  });

  it("counts the marked Holes: \"2 Holes can't be cut\"", async () => {
    const {text} = await render([TOO_SHORT, NO_PIPE]);

    expect(text('cutting-problems-count')).toBe("2 Holes can't be cut");
  });

  it("counts one marked Hole as \"1 Hole can't be cut\"", async () => {
    const {text} = await render([TOO_SHORT]);

    expect(text('cutting-problems-count')).toBe("1 Hole can't be cut");
  });

  it('counts a too-close pair as two Holes', async () => {
    const {text, entries} = await render([TOO_CLOSE]);

    expect(text('cutting-problems-count')).toBe("2 Holes can't be cut");
    expect(entries()).toHaveLength(2);
  });

  it('says "None" and lists nothing when no Hole has a Cutting Problem', async () => {
    const {text, entries} = await render([]);

    expect(text('cutting-problems-count')).toBe('None');
    expect(entries()).toHaveLength(0);
  });

  it('lists one entry per marked Hole in the given order, with note name and Column from 1', async () => {
    const {entries} = await render([TOO_SHORT, TOO_CLOSE]);

    const [tooShort, tooClose, tooClosePrevious] = entries();
    expect(tooShort).toContain('C4');
    expect(tooShort).toMatch(/\b11\b/);
    expect(tooShort).toContain('2.5');
    expect(tooShort).toContain('3.3');
    expect(tooClose).toContain('D4');
    expect(tooClose).toMatch(/\b21\b/);
    expect(tooClose).toContain('1.2');
    expect(tooClose).toContain('1.7');
    expect(tooClose).toMatch(/\b25\b/);
    expect(tooClosePrevious).toContain('D4');
    expect(tooClosePrevious).toMatch(/\b25\b/);
    expect(tooClosePrevious).toContain('previous');
    expect(tooClosePrevious).toMatch(/\b21\b/);
  });

  it('writes the mm values with the decimal comma in German', async () => {
    const {entries} = await render([TOO_SHORT, TOO_CLOSE], 'de');

    expect(entries()[0]).toContain('3,3');
    expect(entries()[0]).not.toContain('3.3');
    expect(entries()[1]).toContain('1,2');
  });

  it('shows every text translated', async () => {
    const {element} = await render([TOO_SHORT, TOO_CLOSE, NO_PIPE]);

    expect(element.textContent).not.toMatch(/TAPE\.CUTTING_PROBLEM/);
  });

  it('emits the HoleRef of the entry that is chosen', async () => {
    const {element, chosen} = await render([TOO_SHORT, TOO_CLOSE]);

    const buttons = element.querySelectorAll<HTMLButtonElement>('button[data-testid="cutting-problem"]');
    buttons[1]?.click();

    expect(chosen).toEqual([{pipe: note(62), start: col(20)}]);
  });

  it('lists a Hole without a Pipe as plain text, counted but not a button', async () => {
    const {element, text, entries} = await render([NO_PIPE]);

    expect(text('cutting-problems-count')).toBe("1 Hole can't be cut");
    expect(entries()).toHaveLength(1);
    expect(entries()[0]).toContain('A#4');
    expect(entries()[0]).toMatch(/\b5\b/);
    expect(element.querySelectorAll('button[data-testid="cutting-problem"]')).toHaveLength(0);
  });
});
