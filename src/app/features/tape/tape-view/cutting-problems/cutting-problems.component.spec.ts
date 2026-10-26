// API: CuttingProblemsComponent (standalone); input `holes: readonly HoleCuttingProblems[]` (cut order, Columns 0-based); input `stretches: readonly NoJoinProblem[]` (default none); output `chosen: OutputEmitterRef<HoleRef>`; output `stretchChosen: OutputEmitterRef<NoJoinProblem>`; method `reveal()` scrolls the section into view and focuses it.
import {TestBed} from '@angular/core/testing';
import {TranslateService} from '@ngx-translate/core';
import {firstValueFrom} from 'rxjs';
import {vi} from 'vitest';
import {
  column,
  holesWithCuttingProblems,
  midiNoteNumber,
  type CuttingProblem,
  type HoleCuttingProblems,
  type HoleRef,
  type Millimetres,
  type MidiNoteNumber,
  type NoJoinProblem,
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

/** A stretch of Columns 1 to 101 that no Join cuts for a Plotter of 300 mm working length (FR-015). */
const NO_JOIN: NoJoinProblem = {code: 'no-join', start: col(0), last: col(100), plotterName: 'Cutting mat', workingLengthMm: 300};

async function render(problems: readonly CuttingProblem[], language: 'en' | 'de' = 'en', stretches: readonly NoJoinProblem[] = []) {
  TestBed.configureTestingModule({providers: [provideTestTranslations(language)]});
  const fixture = TestBed.createComponent(CuttingProblemsComponent);
  const holes: readonly HoleCuttingProblems[] = holesWithCuttingProblems(problems);
  fixture.componentRef.setInput('holes', holes);
  fixture.componentRef.setInput('stretches', stretches);
  const chosen: HoleRef[] = [];
  fixture.componentInstance.chosen.subscribe((value) => chosen.push(value));
  const chosenStretches: NoJoinProblem[] = [];
  fixture.componentInstance.stretchChosen.subscribe((value) => chosenStretches.push(value));
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const text = (testId: string): string =>
    (element.querySelector(`[data-testid="${testId}"]`)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const entries = (): string[] =>
    [...element.querySelectorAll('[data-testid="cutting-problem"]')].map((item) =>
      (item.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
  const stretchEntries = (): string[] =>
    [...element.querySelectorAll('[data-testid="cutting-problem-stretch"]')].map((item) =>
      (item.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
  return {element, component: fixture.componentInstance, chosen, chosenStretches, text, entries, stretchEntries};
}

describe('CuttingProblemsComponent', () => {
  it('is the Cutting Problems section with its title', async () => {
    const {element} = await render([TOO_SHORT]);

    const section = element.querySelector('[data-testid="cutting-problems"]');
    expect(section).not.toBeNull();
    expect(section?.textContent).toContain('Cutting Problems');
  });

  it("counts the marked Holes: \"2 Cutting Problems\"", async () => {
    const {text} = await render([TOO_SHORT, NO_PIPE]);

    expect(text('cutting-problems-count')).toBe("2 Cutting Problems");
  });

  it("counts one marked Hole as \"1 Cutting Problem\"", async () => {
    const {text} = await render([TOO_SHORT]);

    expect(text('cutting-problems-count')).toBe("1 Cutting Problem");
  });

  it('counts a too-close pair as two Holes', async () => {
    const {text, entries} = await render([TOO_CLOSE]);

    expect(text('cutting-problems-count')).toBe("2 Cutting Problems");
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

  it('follows a switch of the language', async () => {
    const {entries} = await render([TOO_SHORT]);
    expect(entries()[0]).toContain('3.3');

    await firstValueFrom(TestBed.inject(TranslateService).use('de'));
    TestBed.tick();

    expect(entries()[0]).toContain('3,3');
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

  function description(element: HTMLElement, button: HTMLButtonElement | undefined): string {
    const id = button?.getAttribute('aria-describedby') ?? '';
    return element.querySelector(`#${CSS.escape(id)}`)?.textContent?.trim() ?? '';
  }

  it('keeps the visible text as the accessible name and describes that the entry shows the Hole on the Tape', async () => {
    const {element} = await render([TOO_SHORT, TOO_CLOSE]);

    const buttons = [...element.querySelectorAll<HTMLButtonElement>('button[data-testid="cutting-problem"]')];
    expect(buttons[0]?.hasAttribute('aria-label')).toBe(false);
    expect(description(element, buttons[0])).toMatch(/^Show /);
    expect(description(element, buttons[0])).toContain('C4');
    expect(description(element, buttons[0])).toMatch(/\b11\b/);
    expect(description(element, buttons[1])).toMatch(/^Show /);
    expect(description(element, buttons[1])).toContain('D4');
    expect(description(element, buttons[1])).toMatch(/\b21\b/);
    expect(new Set(buttons.map((button) => button.getAttribute('aria-describedby'))).size).toBe(buttons.length);
  });

  it('describes the entry buttons in German', async () => {
    const {element} = await render([TOO_SHORT], 'de');

    const text = description(element, element.querySelector<HTMLButtonElement>('button[data-testid="cutting-problem"]') ?? undefined);
    expect(text).toMatch(/^Zeige /);
    expect(text).toContain('C4');
  });

  it('lists a Hole without a Pipe as plain text, counted but not a button', async () => {
    const {element, text, entries} = await render([NO_PIPE]);

    expect(text('cutting-problems-count')).toBe("1 Cutting Problem");
    expect(entries()).toHaveLength(1);
    expect(entries()[0]).toContain('A#4');
    expect(entries()[0]).toMatch(/\b5\b/);
    expect(element.querySelectorAll('button[data-testid="cutting-problem"]')).toHaveLength(0);
  });

  it('holds no paragraph inside its buttons, so that the buttons are valid HTML', async () => {
    const {element} = await render([TOO_SHORT], 'en', [NO_JOIN]);

    expect(element.querySelectorAll('button p')).toHaveLength(0);
    expect(element.querySelectorAll('button[data-testid="cutting-problem"], button[data-testid="cutting-problem-stretch"]')).toHaveLength(2);
  });

  it('scrolls the section to the top of the view and focuses it when revealed', async () => {
    const {element, component} = await render([TOO_SHORT], 'en', [NO_JOIN]);
    const section = element.querySelector('[data-testid="cutting-problems"]');
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => undefined);

    try {
      component.reveal();

      expect(scrollIntoView.mock.contexts).toContain(section);
      expect(scrollIntoView.mock.calls[scrollIntoView.mock.contexts.indexOf(section)]).toEqual([{block: 'start'}]);
      expect(document.activeElement).toBe(section);
    } finally {
      scrollIntoView.mockRestore();
    }
  });

  describe('stretches with no place for a Join (T042, US3 scenario 3)', () => {
    it('lists a stretch as a button naming its Columns from 1, the Plotter and its working length', async () => {
      const {element, stretchEntries} = await render([], 'en', [NO_JOIN]);

      expect(stretchEntries()).toEqual([
        'Columns 1–101 are longer than the working length of Cutting mat (300 mm) with no place for a Join',
      ]);
      expect(element.querySelectorAll('button[data-testid="cutting-problem-stretch"]')).toHaveLength(1);
    });

    it('counts a stretch with the Holes, so a Hole and a stretch are two entries', async () => {
      const {text, entries, stretchEntries} = await render([TOO_SHORT], 'en', [NO_JOIN]);

      expect(text('cutting-problems-count')).toMatch(/^2\b/);
      expect(entries()).toHaveLength(1);
      expect(stretchEntries()).toHaveLength(1);
    });

    it('counts a stretch alone as one entry, and does not say None', async () => {
      const {text, stretchEntries} = await render([], 'en', [NO_JOIN]);

      expect(text('cutting-problems-count')).toMatch(/^1\b/);
      expect(text('cutting-problems-count')).not.toBe('None');
      expect(stretchEntries()).toHaveLength(1);
    });

    it('emits the stretch when it is chosen, and no Hole', async () => {
      const {element, chosen, chosenStretches} = await render([TOO_SHORT], 'en', [NO_JOIN]);

      element.querySelector<HTMLButtonElement>('button[data-testid="cutting-problem-stretch"]')?.click();

      expect(chosenStretches).toEqual([NO_JOIN]);
      expect(chosen).toEqual([]);
    });

    it('lists each stretch on its own, in the given order', async () => {
      const later: NoJoinProblem = {...NO_JOIN, start: col(119), last: col(199)};

      const {stretchEntries} = await render([], 'en', [NO_JOIN, later]);

      expect(stretchEntries()).toHaveLength(2);
      expect(stretchEntries()[0]).toContain('Columns 1–101');
      expect(stretchEntries()[1]).toContain('Columns 120–200');
    });

    it('writes the stretch in German with the Join as Klebestelle', async () => {
      const {stretchEntries} = await render([], 'de', [NO_JOIN]);

      expect(stretchEntries()[0]).toContain('Spalten 1–101');
      expect(stretchEntries()[0]).toContain('Klebestelle');
      expect(stretchEntries()[0]).toContain('Cutting mat');
    });
  });
});
